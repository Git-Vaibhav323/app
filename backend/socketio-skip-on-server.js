/**
 * Socket.IO Server for Skip On Chat Feature
 * Production-ready 1-to-1 anonymous chat with matchmaking
 * 
 * Features:
 * - WebSocket-only transport (no polling fallback for better performance)
 * - Stable matchmaking queue (FIFO)
 * - One room per user only (prevents duplicates)
 * - Instant message delivery (peer-to-peer relay)
 * - Automatic cleanup on skip/disconnect
 * - Comprehensive logging for debugging
 * 
 * Run with: node socketio-skip-on-server.js
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: '*', // In production, replace with your app's origins
  credentials: true,
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // FORCE WebSocket-only transport (no polling fallback)
  transports: ['websocket'],
  // Connection settings
  pingTimeout: 60000,      // 60 seconds
  pingInterval: 25000,     // 25 seconds
  // Upgrade settings
  allowUpgrades: false,    // Disable transport upgrades (keep WebSocket)
  // Per-message deflation
  perMessageDeflation: false,
});

// ====================================
// IN-MEMORY DATA STRUCTURES
// ====================================

/**
 * Matchmaking queue: Array of { clientId, socketId, timestamp }
 * FIFO queue - first user in is first matched
 */
const matchmakingQueue = [];

/**
 * Active rooms: Map of roomId -> { user1, user2, socket1, socket2, createdAt }
 * Tracks which users are in which room with their socket IDs
 */
const activeRooms = new Map();

/**
 * User to room mapping: Map of clientId -> roomId
 * Quick lookup to find which room a user is in
 * Ensures one room per user only
 */
const userToRoom = new Map();

/**
 * Socket to clientId mapping: Map of socketId -> clientId
 * Used to identify users when they disconnect
 */
const socketToClientId = new Map();

/**
 * ClientId to socketId mapping: Map of clientId -> socketId
 * Reverse lookup for faster socket finding
 */
const clientIdToSocketId = new Map();

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Generate a unique room ID
 */
function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add user to matchmaking queue
 * Prevents duplicates - removes user if already in queue
 */
function addToQueue(clientId, socketId) {
  // Remove from queue if already there (prevent duplicates)
  const existingIndex = matchmakingQueue.findIndex(item => item.clientId === clientId);
  if (existingIndex > -1) {
    matchmakingQueue.splice(existingIndex, 1);
    console.log(`[QUEUE] Removed duplicate entry for ${clientId}`);
  }
  
  // Add to end of queue
  matchmakingQueue.push({
    clientId,
    socketId,
    timestamp: Date.now(),
  });
  
  console.log(`[QUEUE] User ${clientId} added to queue. Queue length: ${matchmakingQueue.length}`);
}

/**
 * Remove user from matchmaking queue
 */
function removeFromQueue(clientId) {
  const index = matchmakingQueue.findIndex(item => item.clientId === clientId);
  if (index > -1) {
    matchmakingQueue.splice(index, 1);
    console.log(`[QUEUE] User ${clientId} removed from queue. Queue length: ${matchmakingQueue.length}`);
    return true;
  }
  return false;
}

/**
 * Try to match two users from the queue
 * Returns match object if successful, null otherwise
 * FIFO matching - first two users in queue are matched
 */
function tryMatchUsers() {
  if (matchmakingQueue.length < 2) {
    return null;
  }

  // Take first two users from queue (FIFO)
  const user1 = matchmakingQueue.shift();
  const user2 = matchmakingQueue.shift();

  // Generate unique room ID
  const roomId = generateRoomId();

  // Create room with both users and their sockets
  activeRooms.set(roomId, {
    user1: user1.clientId,
    user2: user2.clientId,
    socket1: user1.socketId,
    socket2: user2.socketId,
    createdAt: new Date().toISOString(),
  });

  // Map users to room (ensures one room per user)
  userToRoom.set(user1.clientId, roomId);
  userToRoom.set(user2.clientId, roomId);

  console.log(`[MATCH] ✅ Match created! Room: ${roomId}`);
  console.log(`[MATCH]   User1: ${user1.clientId} (socket: ${user1.socketId})`);
  console.log(`[MATCH]   User2: ${user2.clientId} (socket: ${user2.socketId})`);
  console.log(`[MATCH]   Queue remaining: ${matchmakingQueue.length} users`);

  return {
    roomId,
    user1: user1.clientId,
    user2: user2.clientId,
    socket1: user1.socketId,
    socket2: user2.socketId,
  };
}

/**
 * Get the peer (other user) in the room
 */
function getPeerInRoom(clientId, roomId) {
  const room = activeRooms.get(roomId);
  if (!room) return null;

  if (room.user1 === clientId) {
    return { clientId: room.user2, socketId: room.socket2 };
  } else if (room.user2 === clientId) {
    return { clientId: room.user1, socketId: room.socket1 };
  }
  return null;
}

/**
 * Clean up a room and notify peer
 * Removes room from all data structures
 */
function cleanupRoom(roomId, clientId, notifyPeer = true) {
  const room = activeRooms.get(roomId);
  if (!room) {
    console.log(`[CLEANUP] Room ${roomId} not found, skipping cleanup`);
    return;
  }

  // Get peer before cleanup
  const peer = getPeerInRoom(clientId, roomId);

  // Remove room
  activeRooms.delete(roomId);
  
  // Remove user mappings (ensures one room per user)
  userToRoom.delete(room.user1);
  userToRoom.delete(room.user2);

  console.log(`[CLEANUP] Room ${roomId} cleaned up`);
  console.log(`[CLEANUP]   Users: ${room.user1}, ${room.user2}`);

  // Notify peer if requested
  if (notifyPeer && peer) {
    const peerSocket = io.sockets.sockets.get(peer.socketId);
    if (peerSocket) {
      peerSocket.emit('peer_skipped');
      console.log(`[CLEANUP] ✅ Notified peer ${peer.clientId} (socket: ${peer.socketId}) that user ${clientId} left`);
    } else {
      console.log(`[CLEANUP] ⚠️ Peer socket ${peer.socketId} not found (may have disconnected)`);
    }
  }
}

/**
 * Handle user disconnection
 * Removes user from queue, cleans up room, removes mappings
 */
function handleDisconnect(socketId, clientId) {
  console.log(`[DISCONNECT] User ${clientId} disconnected (socket: ${socketId})`);

  // Remove from queue if present
  removeFromQueue(clientId);

  // Check if user is in a room
  const roomId = userToRoom.get(clientId);
  if (roomId) {
    // Clean up room and notify peer
    cleanupRoom(roomId, clientId, true);
  }

  // Remove socket mappings
  socketToClientId.delete(socketId);
  clientIdToSocketId.delete(clientId);
  
  console.log(`[DISCONNECT] ✅ Cleanup complete for ${clientId}`);
}

// ====================================
// SOCKET.IO EVENT HANDLERS
// ====================================

io.on('connection', (socket) => {
  const transport = socket.conn.transport.name;
  console.log(`[CONNECTION] New socket connected: ${socket.id} (transport: ${transport})`);
  
  // Send connection confirmation
  socket.emit('connected', { socketId: socket.id });

  // ====================================
  // EVENT: start_searching
  // Client sends: { clientId }
  // Server: Adds to queue, tries to match
  // ====================================
  socket.on('start_searching', ({ clientId }) => {
    if (!clientId) {
      socket.emit('error', { message: 'clientId is required' });
      console.error(`[SEARCH] ❌ start_searching called without clientId`);
      return;
    }

    console.log(`[SEARCH] User ${clientId} started searching (socket: ${socket.id})`);

    // Store socket mappings
    socketToClientId.set(socket.id, clientId);
    clientIdToSocketId.set(clientId, socket.id);

    // CRITICAL: Remove from any existing room first (one room per user)
    const existingRoomId = userToRoom.get(clientId);
    if (existingRoomId) {
      console.log(`[SEARCH] User ${clientId} already in room ${existingRoomId}, cleaning up first`);
      cleanupRoom(existingRoomId, clientId, true);
    }

    // Remove from queue if already there (prevent duplicates)
    removeFromQueue(clientId);

    // Add to matchmaking queue
    addToQueue(clientId, socket.id);

    // Try immediate match (FIFO)
    const match = tryMatchUsers();
    if (match) {
      // Notify both users of match
      const user1Socket = io.sockets.sockets.get(match.socket1);
      const user2Socket = io.sockets.sockets.get(match.socket2);

      if (user1Socket) {
        user1Socket.emit('matched', { roomId: match.roomId });
        console.log(`[MATCH] ✅ Notified ${match.user1} (socket: ${match.socket1}) of match`);
      } else {
        console.error(`[MATCH] ❌ Socket ${match.socket1} not found for user ${match.user1}`);
      }

      if (user2Socket) {
        user2Socket.emit('matched', { roomId: match.roomId });
        console.log(`[MATCH] ✅ Notified ${match.user2} (socket: ${match.socket2}) of match`);
      } else {
        console.error(`[MATCH] ❌ Socket ${match.socket2} not found for user ${match.user2}`);
      }
    } else {
      // No match yet, user is waiting
      console.log(`[SEARCH] User ${clientId} waiting in queue. Queue length: ${matchmakingQueue.length}`);
      socket.emit('searching', { message: 'Searching for a partner...' });
    }
  });

  // ====================================
  // EVENT: stop_searching
  // Client sends: { clientId }
  // Server: Removes from queue
  // ====================================
  socket.on('stop_searching', ({ clientId }) => {
    console.log(`[SEARCH] User ${clientId} stopped searching`);
    removeFromQueue(clientId);
    socket.emit('search_stopped');
  });

  // ====================================
  // EVENT: join_room
  // Client sends: { roomId, clientId }
  // Server: Joins socket to Socket.IO room, confirms
  // ====================================
  socket.on('join_room', ({ roomId, clientId }) => {
    if (!roomId || !clientId) {
      socket.emit('error', { message: 'roomId and clientId are required' });
      return;
    }

    const room = activeRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      console.error(`[ROOM] ❌ Room ${roomId} not found for user ${clientId}`);
      return;
    }

    // Verify user is part of this room
    if (room.user1 !== clientId && room.user2 !== clientId) {
      socket.emit('error', { message: 'You are not authorized for this room' });
      console.error(`[ROOM] ❌ User ${clientId} not authorized for room ${roomId}`);
      return;
    }

    // Join socket room (Socket.IO rooms for message routing)
    socket.join(roomId);
    
    // Get peer info
    const peer = getPeerInRoom(clientId, roomId);
    
    console.log(`[ROOM] ✅ User ${clientId} joined room ${roomId} (socket: ${socket.id})`);
    console.log(`[ROOM]   Peer: ${peer ? peer.clientId : 'unknown'}`);
    
    socket.emit('room_joined', { roomId, peerId: peer ? peer.clientId : null });
  });

  // ====================================
  // EVENT: send_message
  // Client sends: { roomId, clientId, message }
  // Server: Relays message ONLY to peer
  // ====================================
  socket.on('send_message', ({ roomId, clientId, message }) => {
    if (!roomId || !clientId || !message) {
      socket.emit('error', { message: 'roomId, clientId, and message are required' });
      return;
    }

    // Verify room exists
    const room = activeRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      console.error(`[MESSAGE] ❌ Room ${roomId} not found`);
      return;
    }

    // Verify user is part of this room
    if (room.user1 !== clientId && room.user2 !== clientId) {
      socket.emit('error', { message: 'You are not authorized for this room' });
      console.error(`[MESSAGE] ❌ User ${clientId} not authorized for room ${roomId}`);
      return;
    }

    // Get peer
    const peer = getPeerInRoom(clientId, roomId);
    if (!peer) {
      console.error(`[MESSAGE] ❌ No peer found for user ${clientId} in room ${roomId}`);
      socket.emit('error', { message: 'Peer not found in room' });
      return;
    }

    // Prepare message data
    const messageData = {
      roomId,
      senderId: clientId,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    // Send message directly to peer socket (excludes sender)
    const peerSocket = io.sockets.sockets.get(peer.socketId);
    if (peerSocket) {
      peerSocket.emit('message_received', messageData);
      console.log(`[MESSAGE] ✅ ${clientId} -> ${peer.clientId} in room ${roomId}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    } else {
      console.error(`[MESSAGE] ❌ Peer socket ${peer.socketId} not found (peer may have disconnected)`);
      socket.emit('error', { message: 'Peer not connected' });
      return;
    }

    // Confirm to sender (for reliability)
    socket.emit('message_sent', { roomId, timestamp: messageData.timestamp });
  });

  // ====================================
  // EVENT: skip_chat
  // Client sends: { roomId, clientId }
  // Server: Cleans up room, notifies peer, user can search again
  // ====================================
  socket.on('skip_chat', ({ roomId, clientId }) => {
    if (!roomId || !clientId) {
      socket.emit('error', { message: 'roomId and clientId are required' });
      return;
    }

    console.log(`[SKIP] User ${clientId} skipping chat in room ${roomId}`);

    // Leave socket room
    socket.leave(roomId);

    // Clean up room and notify peer
    cleanupRoom(roomId, clientId, true);

    // Confirm skip
    socket.emit('chat_skipped', { roomId });
    
    console.log(`[SKIP] ✅ User ${clientId} can now search again`);
  });

  // ====================================
  // EVENT: disconnect
  // Automatic Socket.IO event
  // Handles app close, network drop, etc.
  // ====================================
  socket.on('disconnect', (reason) => {
    const clientId = socketToClientId.get(socket.id);
    if (clientId) {
      console.log(`[DISCONNECT] User ${clientId} disconnected: ${reason}`);
      handleDisconnect(socket.id, clientId);
    } else {
      console.log(`[DISCONNECT] Socket ${socket.id} disconnected (unknown clientId): ${reason}`);
    }
  });

  // ====================================
  // EVENT: ping (health check)
  // ====================================
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
});

// ====================================
// SERVER STARTUP
// ====================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 Socket.IO Skip On Server Running`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Transport: WebSocket ONLY (no polling)`);
  console.log(`CORS: Enabled for all origins`);
  console.log(`${'='.repeat(50)}\n`);

  // Periodic cleanup of stale rooms (older than 1 hour)
  setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    
    activeRooms.forEach((room, roomId) => {
      const createdAt = new Date(room.createdAt).getTime();
      const age = now - createdAt;
      // Remove rooms older than 1 hour
      if (age > 3600000) {
        console.log(`[CLEANUP] Removing stale room: ${roomId} (age: ${Math.round(age / 1000 / 60)} minutes)`);
        cleanupRoom(roomId, room.user1, false);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`[CLEANUP] Removed ${cleanedCount} stale room(s)`);
    }
  }, 300000); // Check every 5 minutes

  // Log queue status periodically
  setInterval(() => {
    if (matchmakingQueue.length > 0) {
      console.log(`[STATUS] Queue: ${matchmakingQueue.length} user(s) waiting, Active rooms: ${activeRooms.size}`);
    }
  }, 60000); // Every minute
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SERVER] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[SERVER] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});
