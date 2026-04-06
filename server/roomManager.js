const { v4: uuidv4 } = require("uuid");

// In-memory state: Map of roomId -> roomObject
// Note: If server restarts, all state is lost
const activeRooms = new Map();

// Map of socketId -> { roomId, playerId } for disconnect handling
const socketRegistry = new Map();

function generateRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (activeRooms.has(code));
  return code;
}

function createRoom(adminId, adminName) {
  const roomId = generateRoomCode();
  
  const room = {
    roomId,
    adminId,
    roomStatus: "lobby", // lobby | playing | stats
    settings: {
      blindMode: "standard", // standard | ante_all
      sequenceMode: "standard", // standard | winner_curse
      smallBlind: 10,
      bigBlind: 20,
      ante: 10,
    },
    players: [
      {
        id: adminId,
        name: adminName,
        stack: 0,
        status: "active", // active | folded | waiting
        currentRoundContribution: 0,
        totalHandContribution: 0,
        isDealer: true,
      }
    ],
    gameState: {
      gameNumber: 0,
      currentRound: "pre-flop", // pre-flop | flop | turn | river
      pot: 0,
      currentRoundHighestBet: 0,
      activePlayerIndex: 0,
      dealerIndex: 0,
      roundHistory: [], // For undo functionality
      showdownVotes: [], // Array of { playerId, vote: "WON" | "LOST" }
    },
    bgmState: {
      currentTrackIndex: 1,
      startTime: Date.now(),
      totalTracks: 5
    }
  };

  activeRooms.set(roomId, room);
  return room;
}

function joinRoom(roomId, playerId, playerName) {
  const room = activeRooms.get(roomId);
  if (!room) return null;

  // Check if player already in room (reconnection)
  const existingPlayer = room.players.find(p => p.id === playerId);
  if (existingPlayer) {
    existingPlayer.name = playerName; // Update name just in case
    return room;
  }

  // New player joining
  room.players.push({
    id: playerId,
    name: playerName,
    stack: 0,
    status: room.roomStatus === "lobby" ? "active" : "waiting", // Waiting if game in progress
    currentRoundContribution: 0,
    totalHandContribution: 0,
    isDealer: false,
  });

  return room;
}

function getRoom(roomId) {
  return activeRooms.get(roomId);
}

function deleteRoom(roomId) {
  activeRooms.delete(roomId);
}

function trackConnection(socketId, roomId, playerId) {
  socketRegistry.set(socketId, { roomId, playerId });
}

function removeConnection(socketId) {
  return socketRegistry.delete(socketId);
}

function getConnection(socketId) {
  return socketRegistry.get(socketId);
}

function getConnectionsInRoom(roomId) {
  const connections = [];
  socketRegistry.forEach((data, socketId) => {
    if (data.roomId === roomId) {
      connections.push(socketId);
    }
  });
  return connections;
}
function removePlayerFromRoom(roomId, playerId) {
  const room = activeRooms.get(roomId);
  if (!room) return { room: null, removed: false, empty: true };

  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx === -1) return { room, removed: false, empty: room.players.length === 0 };

  room.players.splice(idx, 1);

  // If room is now empty, delete it entirely
  if (room.players.length === 0) {
    activeRooms.delete(roomId);
    return { room: null, removed: true, empty: true };
  }

  // If the removed player was admin, promote next player
  if (room.adminId === playerId) {
    room.adminId = room.players[0].id;
  }

  // Fix activePlayerIndex if it's now out of bounds or pointing at wrong player
  if (room.gameState.activePlayerIndex >= room.players.length) {
    room.gameState.activePlayerIndex = 0;
  }
  if (room.gameState.dealerIndex >= room.players.length) {
    room.gameState.dealerIndex = 0;
  }

  return { room, removed: true, empty: false };
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom,
  removePlayerFromRoom,
  trackConnection,
  removeConnection,
  getConnection,
  getConnectionsInRoom
};
