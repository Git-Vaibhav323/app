/**
 * Skip On - Socket.IO Server WITHOUT Redis (In-Memory)
 * 
 * This version works without Redis for testing/development
 * For production, use socket-server.js with Redis
 * 
 * Run: node socket-server-no-redis.js
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// ====================================
// EXPRESS SETUP
// ====================================
const app = express();
app.use(cors({
  origin: '*',
  credentials: true,
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // FORCE WebSocket-only (no polling)
  transports: ['websocket'],
  allowUpgrades: false,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ====================================
// IN-MEMORY DATA STRUCTURES
// ====================================

/**
 * Matchmaking queue: Array of { clientId, socketId, timestamp }
 */
const matchmakingQueue = [];

/**
 * Active rooms: Map of roomId -> { user1, user2, socket1, socket2, createdAt }
 */
const activeRooms = new Map();

/**
 * User to room mapping: Map of clientId -> roomId
 */
const userToRoom = new Map();

/**
 * Socket to clientId mapping: Map of socketId -> clientId
 */
const socketToClientId = new Map();

/**
 * ClientId to socketId mapping: Map of clientId -> socketId
 */
const clientIdToSocketId = new Map();

// ====================================
// HELPER FUNCTIONS
// ====================================

function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function addToQueue(clientId, socketId) {
  // Remove if already in queue
  const existingIndex = matchmakingQueue.findIndex(item => item.clientId === clientId);
  if (existingIndex > -1) {
    matchmakingQueue.splice(existingIndex, 1);
  }
  
  matchmakingQueue.push({ clientId, socketId, timestamp: Date.now() });
  console.log(`[QUEUE] User ${clientId} added. Queue length: ${matchmakingQueue.length}`);
}

function removeFromQueue(clientId) {
  const index = matchmakingQueue.findIndex(item => item.clientId === clientId);
  if (index > -1) {
    matchmakingQueue.splice(index, 1);
    console.log(`[QUEUE] User ${clientId} removed. Queue length: ${matchmakingQueue.length}`);
    return true;
  }
  return false;
}

function tryMatchUsers() {
  if (matchmakingQueue.length < 2) {
    return null;
  }

  const user1 = matchmakingQueue.shift();
  const user2 = matchmakingQueue.shift();

  const roomId = generateRoomId();

  activeRooms.set(roomId, {
    user1: user1.clientId,
    user2: user2.clientId,
    socket1: user1.socketId,
    socket2: user2.socketId,
    createdAt: new Date().toISOString(),
  });

  userToRoom.set(user1.clientId, roomId);
  userToRoom.set(user2.clientId, roomId);

  console.log(`[MATCH] ✅ Created room ${roomId} for ${user1.clientId} <-> ${user2.clientId}`);

  return {
    roomId,
    user1: user1.clientId,
    user2: user2.clientId,
    socket1: user1.socketId,
    socket2: user2.socketId,
  };
}

function getRoom(roomId) {
  return activeRooms.get(roomId) || null;
}

function getPeerInRoom(clientId, roomId) {
  const room = getRoom(roomId);
  if (!room) return null;

  if (room.user1 === clientId) {
    return { clientId: room.user2, socketId: room.socket2 };
  } else if (room.user2 === clientId) {
    return { clientId: room.user1, socketId: room.socket1 };
  }
  return null;
}

function getUserRoom(clientId) {
  return userToRoom.get(clientId) || null;
}

function cleanupRoom(roomId, clientId) {
  const room = getRoom(roomId);
  if (!room) {
    return null;
  }

  const peer = getPeerInRoom(clientId, roomId);

  activeRooms.delete(roomId);
  userToRoom.delete(room.user1);
  userToRoom.delete(room.user2);

  console.log(`[CLEANUP] Room ${roomId} cleaned up`);

  return peer;
}

function findSocketForClient(clientId) {
  const socketId = clientIdToSocketId.get(clientId);
  return socketId || null;
}

// ====================================
// SOCKET.IO EVENT HANDLERS
// ====================================

io.on('connection', (socket) => {
  const transport = socket.conn.transport.name;
  console.log(`[CONNECTION] Socket ${socket.id} connected (transport: ${transport})`);

  socket.emit('connected', { socketId: socket.id });

  // ====================================
  // EVENT: start_search
  // ====================================
  socket.on('start_search', ({ clientId }) => {
    if (!clientId) {
      socket.emit('error', { message: 'clientId is required' });
      return;
    }

    console.log(`[SEARCH] User ${clientId} started searching (socket: ${socket.id})`);

    socket.data.clientId = clientId;
    socketToClientId.set(socket.id, clientId);
    clientIdToSocketId.set(clientId, socket.id);

    // Remove from existing room
    const existingRoomId = getUserRoom(clientId);
    if (existingRoomId) {
      console.log(`[SEARCH] User ${clientId} already in room ${existingRoomId}, cleaning up`);
      const peer = cleanupRoom(existingRoomId, clientId);
      
      if (peer) {
        const peerSocket = io.sockets.sockets.get(peer.socketId);
        if (peerSocket) {
          peerSocket.emit('partner_left');
        }
      }
    }

    removeFromQueue(clientId);
    addToQueue(clientId, socket.id);

    const match = tryMatchUsers();
    if (match) {
      const user1Socket = io.sockets.sockets.get(match.socket1);
      const user2Socket = io.sockets.sockets.get(match.socket2);

      if (user1Socket) {
        user1Socket.join(match.roomId);
        user1Socket.emit('matched', { roomId: match.roomId });
        console.log(`[MATCH] ✅ Notified ${match.user1} of match`);
      }

      if (user2Socket) {
        user2Socket.join(match.roomId);
        user2Socket.emit('matched', { roomId: match.roomId });
        console.log(`[MATCH] ✅ Notified ${match.user2} of match`);
      }
    } else {
      const queueLength = matchmakingQueue.length;
      console.log(`[SEARCH] User ${clientId} waiting. Queue length: ${queueLength}`);
      socket.emit('searching', { message: 'Searching for a partner...' });
    }
  });

  // ====================================
  // EVENT: send_message
  // ====================================
  socket.on('send_message', ({ roomId, message }) => {
    if (!roomId || !message) {
      socket.emit('error', { message: 'roomId and message are required' });
      return;
    }

    const clientId = socket.data.clientId;
    if (!clientId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.user1 !== clientId && room.user2 !== clientId) {
      socket.emit('error', { message: 'Not authorized for this room' });
      return;
    }

    const messagePayload = {
      roomId,
      senderId: clientId,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    socket.to(roomId).emit('receive_message', messagePayload);
    console.log(`[MESSAGE] ${clientId} -> peer in room ${roomId}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
  });

  // ====================================
  // EVENT: skip
  // ====================================
  socket.on('skip', ({ roomId }) => {
    const clientId = socket.data.clientId;
    if (!clientId || !roomId) {
      socket.emit('error', { message: 'clientId and roomId required' });
      return;
    }

    console.log(`[SKIP] User ${clientId} skipping room ${roomId}`);

    socket.leave(roomId);

    const peer = cleanupRoom(roomId, clientId);

    if (peer) {
      const peerSocket = io.sockets.sockets.get(peer.socketId);
      if (peerSocket) {
        peerSocket.emit('partner_left');
        console.log(`[SKIP] ✅ Notified peer ${peer.clientId}`);
      }
    }

    socket.emit('skipped', { roomId });
  });

  // ====================================
  // EVENT: disconnect
  // ====================================
  socket.on('disconnect', (reason) => {
    const clientId = socket.data.clientId;
    
    if (clientId) {
      console.log(`[DISCONNECT] User ${clientId} disconnected: ${reason}`);

      removeFromQueue(clientId);

      const roomId = getUserRoom(clientId);
      if (roomId) {
        const peer = cleanupRoom(roomId, clientId);
        
        if (peer) {
          const peerSocket = io.sockets.sockets.get(peer.socketId);
          if (peerSocket) {
            peerSocket.emit('partner_left');
            console.log(`[DISCONNECT] ✅ Notified peer ${peer.clientId}`);
          }
        }
      }

      socketToClientId.delete(socket.id);
      clientIdToSocketId.delete(clientId);
    }
  });
});

// ====================================
// SERVER STARTUP
// ====================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 Skip On Socket.IO Server Running (In-Memory)`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Port: ${PORT}`);
  console.log(`Transport: WebSocket ONLY`);
  console.log(`Storage: In-Memory (no Redis)`);
  console.log(`⚠️  For production, use socket-server.js with Redis`);
  console.log(`${'='.repeat(50)}\n`);

  setInterval(() => {
    const queueLength = matchmakingQueue.length;
    const roomCount = activeRooms.size;
    if (queueLength > 0 || roomCount > 0) {
      console.log(`[STATUS] Queue: ${queueLength} users, Rooms: ${roomCount}`);
    }
  }, 60000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SERVER] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\n[SERVER] SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});

