/**
 * ENGAGE Feature - Socket.IO Server
 * 
 * Handles:
 * - Watch Along (YouTube sync)
 * - Play Along (Real-time Chess)
 * - Sing Along (Phase 1: same as Watch Along)
 * 
 * Architecture:
 * - Separate Socket.IO namespaces for each feature
 * - Redis for room state (ephemeral)
 * - No database for realtime state
 * - Auth required (checked via token)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const redis = require('redis');
const cors = require('cors');
const { Chess } = require('chess.js');

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
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
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
  WATCH_ROOM: (roomId) => `watchalong:room:${roomId}`,
  CHESS_ROOM: (roomId) => `chess:room:${roomId}`,
  SING_ROOM: (roomId) => `singalong:room:${roomId}`, // Phase 1: same as watch
};

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Generate unique room ID
 * Format: room_timestamp_randomString
 * The randomString part can be used as a room code
 */
function generateRoomId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `room_${timestamp}_${random}`;
}

/**
 * Generate a short room code from roomId
 * Uses the random part of the roomId
 */
function getRoomCodeFromId(roomId) {
  const parts = roomId.split('_');
  if (parts.length >= 3) {
    return parts[2].substring(0, 6).toUpperCase();
  }
  return roomId.slice(-6).toUpperCase();
}

/**
 * Generate a short room code from roomId
 * Uses the random part of the roomId
 */
function getRoomCodeFromId(roomId) {
  const parts = roomId.split('_');
  if (parts.length >= 3) {
    return parts[2].substring(0, 6).toUpperCase();
  }
  return roomId.slice(-6).toUpperCase();
}

/**
 * Verify user is authenticated (basic check)
 * In production, verify JWT token here
 */
function isAuthenticated(socket) {
  // For now, check if user data exists
  // In production, verify JWT token from handshake
  return socket.handshake.auth?.token || socket.handshake.auth?.userId;
}

/**
 * Get user ID from socket
 */
function getUserId(socket) {
  return socket.handshake.auth?.userId || socket.handshake.auth?.token || socket.id;
}

// ====================================
// WATCH ALONG NAMESPACE
// ====================================
const watchAlongNamespace = io.of('/watch-along');

watchAlongNamespace.use((socket, next) => {
  // Auth check - reject guests
  if (!isAuthenticated(socket)) {
    console.log(`[WATCH-ALONG] ❌ Unauthenticated connection attempt from ${socket.id}`);
    return next(new Error('Authentication required'));
  }
  next();
});

watchAlongNamespace.on('connection', (socket) => {
  const userId = getUserId(socket);
  console.log(`[WATCH-ALONG] ✅ User ${userId} connected (socket: ${socket.id})`);

  // Create watch room
  socket.on('create_watch_room', async ({ videoId, videoUrl }) => {
    if (!videoId || !videoUrl) {
      socket.emit('error', { message: 'videoId and videoUrl are required' });
      return;
    }

    const roomId = generateRoomId();
    const roomData = {
      roomId,
      hostId: userId,
      videoId,
      videoUrl,
      isPlaying: false,
      currentTime: 0,
      createdAt: new Date().toISOString(),
      participants: [userId],
    };

    // Store in Redis (TTL: 1 hour)
    await redisClient.setEx(REDIS_KEYS.WATCH_ROOM(roomId), 3600, JSON.stringify(roomData));
    
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.isHost = true;

    console.log(`[WATCH-ALONG] ✅ Room ${roomId} created by ${userId}`);
    socket.emit('room_created', { roomId, ...roomData });
  });

  // Join watch room
  socket.on('join_watch_room', async ({ roomId }) => {
    if (!roomId) {
      socket.emit('error', { message: 'roomId is required' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.WATCH_ROOM(roomId));
    if (!roomDataStr) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const roomData = JSON.parse(roomDataStr);
    
    // Add participant
    if (!roomData.participants.includes(userId)) {
      roomData.participants.push(userId);
      await redisClient.setEx(REDIS_KEYS.WATCH_ROOM(roomId), 3600, JSON.stringify(roomData));
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.isHost = roomData.hostId === userId;

    console.log(`[WATCH-ALONG] ✅ User ${userId} joined room ${roomId} (host: ${socket.data.isHost})`);
    
    // Send current state to new participant
    socket.emit('room_joined', {
      roomId,
      ...roomData,
      isHost: socket.data.isHost,
    });

    // Notify others
    socket.to(roomId).emit('participant_joined', { userId, roomId });
  });

  // Play (only host can control)
  socket.on('play', async ({ roomId, currentTime }) => {
    if (!socket.data.isHost) {
      socket.emit('error', { message: 'Only host can control playback' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.WATCH_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.isPlaying = true;
    roomData.currentTime = currentTime || 0;
    await redisClient.setEx(REDIS_KEYS.WATCH_ROOM(roomId), 3600, JSON.stringify(roomData));

    console.log(`[WATCH-ALONG] ▶️ Play in room ${roomId} at ${currentTime}s`);
    watchAlongNamespace.to(roomId).emit('sync_play', { currentTime: roomData.currentTime });
  });

  // Pause (only host can control)
  socket.on('pause', async ({ roomId, currentTime }) => {
    if (!socket.data.isHost) {
      socket.emit('error', { message: 'Only host can control playback' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.WATCH_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.isPlaying = false;
    roomData.currentTime = currentTime || 0;
    await redisClient.setEx(REDIS_KEYS.WATCH_ROOM(roomId), 3600, JSON.stringify(roomData));

    console.log(`[WATCH-ALONG] ⏸️ Pause in room ${roomId} at ${currentTime}s`);
    watchAlongNamespace.to(roomId).emit('sync_pause', { currentTime: roomData.currentTime });
  });

  // Seek (only host can control)
  socket.on('seek', async ({ roomId, currentTime }) => {
    if (!socket.data.isHost) {
      socket.emit('error', { message: 'Only host can control playback' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.WATCH_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.currentTime = currentTime;
    await redisClient.setEx(REDIS_KEYS.WATCH_ROOM(roomId), 3600, JSON.stringify(roomData));

    console.log(`[WATCH-ALONG] ⏩ Seek in room ${roomId} to ${currentTime}s`);
    watchAlongNamespace.to(roomId).emit('sync_seek', { currentTime });
  });

  // Change video (only host can control)
  socket.on('change_video', async ({ roomId, videoId, videoUrl }) => {
    if (!socket.data.isHost) {
      socket.emit('error', { message: 'Only host can change video' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.WATCH_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.videoId = videoId;
    roomData.videoUrl = videoUrl;
    roomData.currentTime = 0;
    roomData.isPlaying = false;
    await redisClient.setEx(REDIS_KEYS.WATCH_ROOM(roomId), 3600, JSON.stringify(roomData));

    console.log(`[WATCH-ALONG] 🔄 Video changed in room ${roomId} to ${videoId}`);
    watchAlongNamespace.to(roomId).emit('sync_video', { videoId, videoUrl });
  });

  // Disconnect
  socket.on('disconnect', async (reason) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      console.log(`[WATCH-ALONG] ❌ User ${userId} disconnected from room ${roomId}: ${reason}`);
      
      // Notify others
      socket.to(roomId).emit('participant_left', { userId, roomId });
      
      // If host left, clean up room
      if (socket.data.isHost) {
        await redisClient.del(REDIS_KEYS.WATCH_ROOM(roomId));
        console.log(`[WATCH-ALONG] 🧹 Room ${roomId} cleaned up (host left)`);
      }
    }
  });
});

// ====================================
// PLAY ALONG (CHESS) NAMESPACE
// ====================================
const playAlongNamespace = io.of('/play-along');

playAlongNamespace.use((socket, next) => {
  if (!isAuthenticated(socket)) {
    console.log(`[PLAY-ALONG] ❌ Unauthenticated connection attempt from ${socket.id}`);
    return next(new Error('Authentication required'));
  }
  next();
});

playAlongNamespace.on('connection', (socket) => {
  const userId = getUserId(socket);
  console.log(`[PLAY-ALONG] ✅ User ${userId} connected (socket: ${socket.id})`);

  // Create chess room
  socket.on('create_chess_room', async () => {
    const roomId = generateRoomId();
    const game = new Chess();
    
    const roomData = {
      roomId,
      whitePlayer: userId,
      blackPlayer: null,
      fen: game.fen(),
      turn: 'white',
      status: 'waiting', // waiting, active, finished
      winner: null,
      createdAt: new Date().toISOString(),
    };

    await redisClient.setEx(REDIS_KEYS.CHESS_ROOM(roomId), 3600, JSON.stringify(roomData));
    
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.color = 'white';

    const roomCode = getRoomCodeFromId(roomId);
    console.log(`[PLAY-ALONG] ✅ Chess room ${roomId} created by ${userId} (white) - Code: ${roomCode}`);
    socket.emit('room_created', { roomId, roomCode, ...roomData });
  });

  // Join chess room (accepts roomId or roomCode)
  socket.on('join_chess_room', async ({ roomId, roomCode }) => {
    let actualRoomId = roomId;

    // If roomCode provided, try to find room by code
    if (!actualRoomId && roomCode) {
      // Search Redis for rooms matching the code
      const keys = await redisClient.keys(REDIS_KEYS.CHESS_ROOM('*'));
      for (const key of keys) {
        const roomDataStr = await redisClient.get(key);
        if (roomDataStr) {
          const roomData = JSON.parse(roomDataStr);
          const codeFromId = getRoomCodeFromId(roomData.roomId);
          if (codeFromId === roomCode.toUpperCase()) {
            actualRoomId = roomData.roomId;
            break;
          }
        }
      }
    }

    if (!actualRoomId) {
      socket.emit('error', { message: 'Room ID or code is required' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.CHESS_ROOM(actualRoomId));
    if (!roomDataStr) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const roomData = JSON.parse(roomDataStr);
    
    if (roomData.blackPlayer) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Assign black player
    roomData.blackPlayer = userId;
    roomData.status = 'active';
    await redisClient.setEx(REDIS_KEYS.CHESS_ROOM(actualRoomId), 3600, JSON.stringify(roomData));

    socket.join(actualRoomId);
    socket.data.roomId = actualRoomId;
    socket.data.color = 'black';

    const roomCodeFinal = getRoomCodeFromId(actualRoomId);
    console.log(`[PLAY-ALONG] ✅ User ${userId} joined room ${actualRoomId} (black) - Code: ${roomCodeFinal}`);
    
    // Notify both players
    playAlongNamespace.to(actualRoomId).emit('game_start', {
      roomId: actualRoomId,
      roomCode: roomCodeFinal,
      ...roomData,
    });
  });

  // Make move
  socket.on('make_move', async ({ roomId, from, to, promotion }) => {
    const roomDataStr = await redisClient.get(REDIS_KEYS.CHESS_ROOM(roomId));
    if (!roomDataStr) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const roomData = JSON.parse(roomDataStr);
    
    if (roomData.status !== 'active') {
      socket.emit('error', { message: 'Game is not active' });
      return;
    }

    // Check if it's user's turn
    const expectedColor = roomData.turn;
    if (socket.data.color !== expectedColor) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Validate move using chess.js
    const game = new Chess(roomData.fen);
    const move = { from, to };
    if (promotion) {
      move.promotion = promotion;
    }

    try {
      const result = game.move(move);
      if (!result) {
        socket.emit('error', { message: 'Invalid move' });
        return;
      }

      // Update game state
      roomData.fen = game.fen();
      roomData.turn = game.turn() === 'w' ? 'white' : 'black';

      // Check for game end
      if (game.isCheckmate()) {
        roomData.status = 'finished';
        roomData.winner = socket.data.color;
      } else if (game.isDraw() || game.isStalemate()) {
        roomData.status = 'finished';
        roomData.winner = 'draw';
      }

      await redisClient.setEx(REDIS_KEYS.CHESS_ROOM(roomId), 3600, JSON.stringify(roomData));

      console.log(`[PLAY-ALONG] ♟️ Move in room ${roomId}: ${from}→${to} by ${socket.data.color}`);
      
      // Broadcast move to all players
      playAlongNamespace.to(roomId).emit('move_update', {
        roomId,
        from,
        to,
        promotion,
        fen: roomData.fen,
        turn: roomData.turn,
        status: roomData.status,
        winner: roomData.winner,
      });

      if (roomData.status === 'finished') {
        playAlongNamespace.to(roomId).emit('game_over', {
          roomId,
          winner: roomData.winner,
          reason: game.isCheckmate() ? 'checkmate' : 'draw',
        });
      }
    } catch (error) {
      console.error(`[PLAY-ALONG] ❌ Invalid move:`, error);
      socket.emit('error', { message: 'Invalid move: ' + error.message });
    }
  });

  // Resign
  socket.on('resign', async ({ roomId }) => {
    const roomDataStr = await redisClient.get(REDIS_KEYS.CHESS_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.status = 'finished';
    roomData.winner = socket.data.color === 'white' ? 'black' : 'white';
    await redisClient.setEx(REDIS_KEYS.CHESS_ROOM(roomId), 3600, JSON.stringify(roomData));

    console.log(`[PLAY-ALONG] 🏳️ Resign in room ${roomId} by ${socket.data.color}`);
    
    playAlongNamespace.to(roomId).emit('game_over', {
      roomId,
      winner: roomData.winner,
      reason: 'resignation',
    });
  });

  // Disconnect
  socket.on('disconnect', async (reason) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      console.log(`[PLAY-ALONG] ❌ User ${userId} disconnected from room ${roomId}: ${reason}`);
      
      // Notify opponent
      socket.to(roomId).emit('opponent_left', { userId, roomId });
      
      // Clean up room
      await redisClient.del(REDIS_KEYS.CHESS_ROOM(roomId));
      console.log(`[PLAY-ALONG] 🧹 Room ${roomId} cleaned up`);
    }
  });
});

// ====================================
// SING ALONG NAMESPACE (Phase 1: same as Watch Along)
// ====================================
// Reuse Watch Along logic for Phase 1
const singAlongNamespace = io.of('/sing-along');

singAlongNamespace.use((socket, next) => {
  if (!isAuthenticated(socket)) {
    console.log(`[SING-ALONG] ❌ Unauthenticated connection attempt from ${socket.id}`);
    return next(new Error('Authentication required'));
  }
  next();
});

// Forward all events to watch-along handlers (Phase 1)
singAlongNamespace.on('connection', (socket) => {
  const userId = getUserId(socket);
  console.log(`[SING-ALONG] ✅ User ${userId} connected (Phase 1: using Watch Along logic)`);
  
  // For Phase 1, reuse Watch Along room structure
  // Just use different Redis key prefix
  socket.on('create_sing_room', async ({ videoId, videoUrl }) => {
    const roomId = generateRoomId();
    const roomData = {
      roomId,
      hostId: userId,
      videoId,
      videoUrl,
      isPlaying: false,
      currentTime: 0,
      createdAt: new Date().toISOString(),
      participants: [userId],
    };

    await redisClient.setEx(REDIS_KEYS.SING_ROOM(roomId), 3600, JSON.stringify(roomData));
    
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.isHost = true;

    socket.emit('room_created', { roomId, ...roomData });
  });

  // Join sing room
  socket.on('join_sing_room', async ({ roomId }) => {
    if (!roomId) {
      socket.emit('error', { message: 'roomId is required' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.SING_ROOM(roomId));
    if (!roomDataStr) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const roomData = JSON.parse(roomDataStr);
    
    if (!roomData.participants.includes(userId)) {
      roomData.participants.push(userId);
      await redisClient.setEx(REDIS_KEYS.SING_ROOM(roomId), 3600, JSON.stringify(roomData));
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.isHost = roomData.hostId === userId;

    console.log(`[SING-ALONG] ✅ User ${userId} joined room ${roomId} (host: ${socket.data.isHost})`);
    
    socket.emit('room_joined', {
      roomId,
      ...roomData,
      isHost: socket.data.isHost,
    });

    socket.to(roomId).emit('participant_joined', { userId, roomId });
  });

  // Play (host only)
  socket.on('play', async ({ roomId, currentTime }) => {
    if (!socket.data.isHost) {
      socket.emit('error', { message: 'Only host can control playback' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.SING_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.isPlaying = true;
    roomData.currentTime = currentTime || 0;
    await redisClient.setEx(REDIS_KEYS.SING_ROOM(roomId), 3600, JSON.stringify(roomData));

    singAlongNamespace.to(roomId).emit('sync_play', { currentTime: roomData.currentTime });
  });

  // Pause (host only)
  socket.on('pause', async ({ roomId, currentTime }) => {
    if (!socket.data.isHost) {
      socket.emit('error', { message: 'Only host can control playback' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.SING_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.isPlaying = false;
    roomData.currentTime = currentTime || 0;
    await redisClient.setEx(REDIS_KEYS.SING_ROOM(roomId), 3600, JSON.stringify(roomData));

    singAlongNamespace.to(roomId).emit('sync_pause', { currentTime: roomData.currentTime });
  });

  // Seek (host only)
  socket.on('seek', async ({ roomId, currentTime }) => {
    if (!socket.data.isHost) {
      socket.emit('error', { message: 'Only host can control playback' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.SING_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.currentTime = currentTime;
    await redisClient.setEx(REDIS_KEYS.SING_ROOM(roomId), 3600, JSON.stringify(roomData));

    singAlongNamespace.to(roomId).emit('sync_seek', { currentTime });
  });

  // Change video (host only)
  socket.on('change_video', async ({ roomId, videoId, videoUrl }) => {
    if (!socket.data.isHost) {
      socket.emit('error', { message: 'Only host can change video' });
      return;
    }

    const roomDataStr = await redisClient.get(REDIS_KEYS.SING_ROOM(roomId));
    if (!roomDataStr) return;

    const roomData = JSON.parse(roomDataStr);
    roomData.videoId = videoId;
    roomData.videoUrl = videoUrl;
    roomData.currentTime = 0;
    roomData.isPlaying = false;
    await redisClient.setEx(REDIS_KEYS.SING_ROOM(roomId), 3600, JSON.stringify(roomData));

    singAlongNamespace.to(roomId).emit('sync_video', { videoId, videoUrl });
  });

  // Disconnect
  socket.on('disconnect', async (reason) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      console.log(`[SING-ALONG] ❌ User ${userId} disconnected from room ${roomId}: ${reason}`);
      
      socket.to(roomId).emit('participant_left', { userId, roomId });
      
      if (socket.data.isHost) {
        await redisClient.del(REDIS_KEYS.SING_ROOM(roomId));
        console.log(`[SING-ALONG] 🧹 Room ${roomId} cleaned up (host left)`);
      }
    }
  });
});

// ====================================
// SERVER STARTUP
// ====================================
const PORT = process.env.ENGAGE_PORT || 3002;

server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 ENGAGE Socket.IO Server Running`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Port: ${PORT}`);
  console.log(`Namespaces:`);
  console.log(`  - /watch-along (YouTube sync)`);
  console.log(`  - /play-along (Real-time Chess)`);
  console.log(`  - /sing-along (Phase 1: YouTube sync)`);
  console.log(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  console.log(`${'='.repeat(50)}\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n[SERVER] SIGTERM received, shutting down...');
  await redisClient.quit();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('\n[SERVER] SIGINT received, shutting down...');
  await redisClient.quit();
  server.close(() => process.exit(0));
});

