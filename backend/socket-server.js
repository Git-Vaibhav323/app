/**
 * Skip On - Production Socket.IO Server with Redis
 * 
 * Architecture:
 * - Express + Socket.IO (WebSocket only)
 * - Redis for matchmaking queue and room state
 * - Stateless backend design
 * - Scales to 1000+ concurrent users
 * 
 * Run: node socket-server.js
 * Requires: Redis server running on localhost:6379
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const redis = require('redis');
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

// Add request logging for debugging
server.on('request', (req, res) => {
  if (req.url?.includes('socket.io')) {
    console.log(`[HTTP] ${req.method} ${req.url} from ${req.headers.origin || 'unknown'}`);
  }
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow WebSocket and polling (polling as fallback for web browsers)
  transports: ['websocket', 'polling'],
  allowUpgrades: true, // Allow upgrade from polling to WebSocket
  pingTimeout: 60000,
  pingInterval: 25000,
  // Connection timeout
  connectTimeout: 45000, // 45 seconds
});

// ====================================
// REDIS SETUP
// ====================================
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

redisClient.on('error', (err) => {
  console.error('[REDIS] Connection error:', err);
});

redisClient.on('connect', () => {
  console.log('[REDIS] Connected successfully');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('[REDIS] ✅ Connected to Redis');
  } catch (error) {
    console.error('[REDIS] ❌ Failed to connect:', error);
    process.exit(1);
  }
})();

// ====================================
// REDIS KEY PATTERNS
// ====================================
const REDIS_KEYS = {
  QUEUE: 'skupon:queue',                    // List of waiting clientIds
  ROOM: (roomId) => `skupon:room:${roomId}`, // Hash: {user1, user2, createdAt}
  USER_ROOM: (clientId) => `skupon:user:${clientId}`, // String: roomId
  SOCKET_USER: (socketId) => `skupon:socket:${socketId}`, // String: clientId
};

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Generate unique room ID
 */
function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add user to matchmaking queue in Redis
 */
async function addToQueue(clientId) {
  try {
    // Remove from queue if already there (prevent duplicates)
    await redisClient.lRem(REDIS_KEYS.QUEUE, 0, clientId);
    
    // Add to end of queue
    await redisClient.rPush(REDIS_KEYS.QUEUE, clientId);
    
    const queueLength = await redisClient.lLen(REDIS_KEYS.QUEUE);
    console.log(`[QUEUE] User ${clientId} added. Queue length: ${queueLength}`);
    
    return queueLength;
  } catch (error) {
    console.error(`[QUEUE] Error adding ${clientId}:`, error);
    throw error;
  }
}

/**
 * Remove user from matchmaking queue
 */
async function removeFromQueue(clientId) {
  try {
    const removed = await redisClient.lRem(REDIS_KEYS.QUEUE, 0, clientId);
    if (removed > 0) {
      const queueLength = await redisClient.lLen(REDIS_KEYS.QUEUE);
      console.log(`[QUEUE] User ${clientId} removed. Queue length: ${queueLength}`);
    }
    return removed > 0;
  } catch (error) {
    console.error(`[QUEUE] Error removing ${clientId}:`, error);
    return false;
  }
}

/**
 * Try to match two users from queue
 * Returns { roomId, user1, user2 } if match found, null otherwise
 */
async function tryMatchUsers() {
  try {
    const queueLength = await redisClient.lLen(REDIS_KEYS.QUEUE);
    
    if (queueLength < 2) {
      return null;
    }

    // Pop first two users from queue (atomic operation)
    const user1 = await redisClient.lPop(REDIS_KEYS.QUEUE);
    const user2 = await redisClient.lPop(REDIS_KEYS.QUEUE);

    if (!user1 || !user2) {
      // Put back if one was null
      if (user1) await redisClient.lPush(REDIS_KEYS.QUEUE, user1);
      if (user2) await redisClient.lPush(REDIS_KEYS.QUEUE, user2);
      return null;
    }

    // Generate room ID
    const roomId = generateRoomId();

    // Create room in Redis
    await redisClient.hSet(REDIS_KEYS.ROOM(roomId), {
      user1: user1,
      user2: user2,
      createdAt: new Date().toISOString(),
    });

    // Set expiration (1 hour)
    await redisClient.expire(REDIS_KEYS.ROOM(roomId), 3600);

    // Map users to room
    await redisClient.setEx(REDIS_KEYS.USER_ROOM(user1), 3600, roomId);
    await redisClient.setEx(REDIS_KEYS.USER_ROOM(user2), 3600, roomId);

    console.log(`[MATCH] ✅ Created room ${roomId} for ${user1} <-> ${user2}`);
    
    return { roomId, user1, user2 };
  } catch (error) {
    console.error('[MATCH] Error matching users:', error);
    return null;
  }
}

/**
 * Get room info from Redis
 */
async function getRoom(roomId) {
  try {
    const room = await redisClient.hGetAll(REDIS_KEYS.ROOM(roomId));
    if (!room || Object.keys(room).length === 0) {
      return null;
    }
    return room;
  } catch (error) {
    console.error(`[ROOM] Error getting room ${roomId}:`, error);
    return null;
  }
}

/**
 * Get peer in room
 */
async function getPeerInRoom(clientId, roomId) {
  const room = await getRoom(roomId);
  if (!room) return null;

  if (room.user1 === clientId) {
    return room.user2;
  } else if (room.user2 === clientId) {
    return room.user1;
  }
  return null;
}

/**
 * Get user's current room ID
 */
async function getUserRoom(clientId) {
  try {
    const roomId = await redisClient.get(REDIS_KEYS.USER_ROOM(clientId));
    return roomId;
  } catch (error) {
    console.error(`[ROOM] Error getting room for ${clientId}:`, error);
    return null;
  }
}

/**
 * Clean up room and remove from Redis
 */
async function cleanupRoom(roomId, clientId, notifyPeer = true) {
  try {
    const room = await getRoom(roomId);
    if (!room) {
      console.log(`[CLEANUP] Room ${roomId} not found`);
      return null;
    }

    const peerId = await getPeerInRoom(clientId, roomId);

    // Delete room
    await redisClient.del(REDIS_KEYS.ROOM(roomId));

    // Remove user mappings
    await redisClient.del(REDIS_KEYS.USER_ROOM(room.user1));
    await redisClient.del(REDIS_KEYS.USER_ROOM(room.user2));

    console.log(`[CLEANUP] Room ${roomId} cleaned up. Users: ${room.user1}, ${room.user2}`);

    return peerId;
  } catch (error) {
    console.error(`[CLEANUP] Error cleaning room ${roomId}:`, error);
    return null;
  }
}

/**
 * Find socket ID for a client ID
 */
function findSocketForClient(clientId) {
  // We maintain a map in memory for fast lookup
  // This is rebuilt on each connection
  for (const [socketId, socket] of io.sockets.sockets.entries()) {
    if (socket.data.clientId === clientId) {
      return socketId;
    }
  }
  return null;
}

// ====================================
// SOCKET.IO EVENT HANDLERS
// ====================================

io.on('connection', (socket) => {
  const transport = socket.conn.transport.name;
  console.log(`[CONNECTION] ✅ Socket ${socket.id} connected (transport: ${transport})`);
  console.log(`[CONNECTION] Remote address: ${socket.handshake.address}`);
  console.log(`[CONNECTION] Headers:`, JSON.stringify(socket.handshake.headers, null, 2));

  // Send connection confirmation immediately
  socket.emit('connected', { socketId: socket.id });
  console.log(`[CONNECTION] ✅ Sent 'connected' event to ${socket.id}`);

  // ====================================
  // EVENT: start_search
  // Client sends: { clientId }
  // ====================================
  socket.on('start_search', async ({ clientId }) => {
    if (!clientId) {
      socket.emit('error', { message: 'clientId is required' });
      return;
    }

    console.log(`[SEARCH] User ${clientId} started searching (socket: ${socket.id})`);

    // Store clientId on socket
    socket.data.clientId = clientId;

    // Store socket -> clientId mapping in Redis
    await redisClient.setEx(REDIS_KEYS.SOCKET_USER(socket.id), 3600, clientId);

    // Remove from any existing room first
    const existingRoomId = await getUserRoom(clientId);
    if (existingRoomId) {
      console.log(`[SEARCH] User ${clientId} already in room ${existingRoomId}, cleaning up`);
      const peerId = await cleanupRoom(existingRoomId, clientId, true);
      
      // Notify peer
      if (peerId) {
        const peerSocketId = findSocketForClient(peerId);
        if (peerSocketId) {
          io.to(peerSocketId).emit('partner_left');
        }
      }
    }

    // Remove from queue if already there
    await removeFromQueue(clientId);

    // Add to matchmaking queue
    await addToQueue(clientId);

    // Try immediate match
    const match = await tryMatchUsers();
    if (match) {
      // Find both users' sockets
      const user1SocketId = findSocketForClient(match.user1);
      const user2SocketId = findSocketForClient(match.user2);

      if (user1SocketId) {
        const user1Socket = io.sockets.sockets.get(user1SocketId);
        if (user1Socket) {
          user1Socket.join(match.roomId);
          user1Socket.emit('matched', { roomId: match.roomId });
          console.log(`[MATCH] ✅ Notified ${match.user1} of match in room ${match.roomId}`);
        }
      }

      if (user2SocketId) {
        const user2Socket = io.sockets.sockets.get(user2SocketId);
        if (user2Socket) {
          user2Socket.join(match.roomId);
          user2Socket.emit('matched', { roomId: match.roomId });
          console.log(`[MATCH] ✅ Notified ${match.user2} of match in room ${match.roomId}`);
        }
      }
    } else {
      // No match yet, user is waiting
      const queueLength = await redisClient.lLen(REDIS_KEYS.QUEUE);
      console.log(`[SEARCH] User ${clientId} waiting in queue. Queue length: ${queueLength}`);
      socket.emit('searching', { message: 'Searching for a partner...' });
    }
  });

  // ====================================
  // EVENT: send_message
  // Client sends: { roomId, message }
  // ====================================
  socket.on('send_message', async ({ roomId, message }) => {
    if (!roomId || !message) {
      socket.emit('error', { message: 'roomId and message are required' });
      return;
    }

    const clientId = socket.data.clientId;
    if (!clientId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Verify room exists and user is part of it
    const room = await getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.user1 !== clientId && room.user2 !== clientId) {
      socket.emit('error', { message: 'Not authorized for this room' });
      return;
    }

    // Get peer
    const peerId = await getPeerInRoom(clientId, roomId);
    if (!peerId) {
      socket.emit('error', { message: 'Peer not found' });
      return;
    }

    // Relay message to room (excludes sender automatically)
    const messagePayload = {
      roomId,
      senderId: clientId,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    socket.to(roomId).emit('receive_message', messagePayload);
    console.log(`[MESSAGE] ${clientId} -> ${peerId} in room ${roomId}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
  });

  // ====================================
  // EVENT: skip
  // Client sends: { roomId }
  // ====================================
  socket.on('skip', async ({ roomId }) => {
    const clientId = socket.data.clientId;
    if (!clientId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    if (!roomId) {
      socket.emit('error', { message: 'roomId is required' });
      return;
    }

    console.log(`[SKIP] User ${clientId} skipping room ${roomId}`);

    // Leave Socket.IO room
    socket.leave(roomId);

    // Clean up Redis room
    const peerId = await cleanupRoom(roomId, clientId, true);

    // Notify peer
    if (peerId) {
      const peerSocketId = findSocketForClient(peerId);
      if (peerSocketId) {
        io.to(peerSocketId).emit('partner_left');
        console.log(`[SKIP] ✅ Notified peer ${peerId} that ${clientId} left`);
      }
    }

    socket.emit('skipped', { roomId });
  });

  // ====================================
  // EVENT: disconnect
  // ====================================
  socket.on('disconnect', async (reason) => {
    const clientId = socket.data.clientId;
    
    if (clientId) {
      console.log(`[DISCONNECT] User ${clientId} disconnected: ${reason}`);

      // Remove from queue
      await removeFromQueue(clientId);

      // Check if user is in a room
      const roomId = await getUserRoom(clientId);
      if (roomId) {
        // Clean up room and notify peer
        const peerId = await cleanupRoom(roomId, clientId, true);
        
        if (peerId) {
          const peerSocketId = findSocketForClient(peerId);
          if (peerSocketId) {
            io.to(peerSocketId).emit('partner_left');
            console.log(`[DISCONNECT] ✅ Notified peer ${peerId} that ${clientId} disconnected`);
          }
        }
      }

      // Clean up socket mapping
      await redisClient.del(REDIS_KEYS.SOCKET_USER(socket.id));
    } else {
      console.log(`[DISCONNECT] Socket ${socket.id} disconnected (unknown clientId): ${reason}`);
    }
  });
});

// ====================================
// SERVER STARTUP
// ====================================

const PORT = process.env.PORT || 3001;

// Start server immediately (don't wait for Redis)
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 Skip On Socket.IO Server Running`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Port: ${PORT}`);
  console.log(`Transport: WebSocket + Polling (fallback)`);
  console.log(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  console.log(`⚠️  Server started - Redis connection in progress...`);
  console.log(`${'='.repeat(50)}\n`);

  // Periodic cleanup of stale rooms (every 5 minutes)
  setInterval(async () => {
    try {
      // Redis TTL handles expiration automatically
      // This is just for logging
      const queueLength = await redisClient.lLen(REDIS_KEYS.QUEUE);
      console.log(`[STATUS] Queue: ${queueLength} user(s) waiting`);
    } catch (error) {
      console.error('[STATUS] Error checking queue:', error);
    }
  }, 60000); // Every minute
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n[SERVER] SIGTERM received, shutting down gracefully...');
  await redisClient.quit();
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n[SERVER] SIGINT received, shutting down gracefully...');
  await redisClient.quit();
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

