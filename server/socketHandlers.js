const { 
  createRoom, joinRoom, getRoom, deleteRoom, removePlayerFromRoom,
  trackConnection, removeConnection, getConnection, getConnectionsInRoom 
} = require("./roomManager");
const gameEngine = require("./gameEngine");

function handlePlayerLeave(io, socket, roomId, playerId) {
  const { room, removed, empty } = removePlayerFromRoom(roomId, playerId);
  
  socket.leave(roomId);
  removeConnection(socket.id);
  socket.emit("room:left");
  
  if (empty) {
    // Room is gone, nothing to broadcast
    return;
  }
  
  if (removed && room) {
    if (room.roomStatus === "playing") {
      const canAct = p => p.inCurrentHand !== false && !p.isSittingOut && p.status === "active" && p.stack > 0;
      let loops = 0;
      while (room.players.length > 0 && !canAct(room.players[room.gameState.activePlayerIndex]) && loops < room.players.length) {
        room.gameState.activePlayerIndex = (room.gameState.activePlayerIndex + 1) % room.players.length;
        loops++;
      }
    }
    // Broadcast updated state to remaining players
    if (room.roomStatus === "playing") {
      io.to(roomId).emit("game:stateUpdate", room);
    } else {
      io.to(roomId).emit("room:updated", room);
    }
  }
}

function mountSocketHandlers(io) {
  io.on("connection", (socket) => {
    // ROOM: CREATE
    socket.on("room:create", ({ adminId, adminName }, callback) => {
      const room = createRoom(adminId, adminName);
      socket.join(room.roomId);
      trackConnection(socket.id, room.roomId, adminId);
      io.to(room.roomId).emit("room:updated", room);
      if(callback) callback({ success: true, room });
    });

    // ROOM: JOIN
    socket.on("room:join", ({ roomId, playerId, playerName }, callback) => {
      const room = joinRoom(roomId, playerId, playerName);
      if (!room) {
        if(callback) callback({ success: false, message: "Room not found" });
        return;
      }
      socket.join(roomId);
      trackConnection(socket.id, roomId, playerId);
      io.to(roomId).emit("room:updated", room);
      if(callback) callback({ success: true, room });
    });

    // ROOM: RECONNECT / REJOIN EXISTING PLAYER
    socket.on("room:reconnect", ({ roomId, playerId, playerName }, callback) => {
      const room = getRoom(roomId);
      if (!room) {
        if(callback) callback({ success: false, message: "Room not found" });
        return;
      }

      const player = room.players.find(p => p.id === playerId);
      if (!player) {
        if(callback) callback({ success: false, message: "Player not found in room" });
        return;
      }

      if (playerName) {
        player.name = playerName;
      }

      socket.join(roomId);
      trackConnection(socket.id, roomId, playerId);
      io.to(roomId).emit("room:updated", room);
      if(callback) callback({ success: true, room });
    });

    // ROOM: LEAVE (explicit quit)
    socket.on("room:leave", ({ roomId, playerId }) => {
      handlePlayerLeave(io, socket, roomId, playerId);
    });

    // ROOM: DISSOLVE (Admin only)
    socket.on("room:dissolve", ({ roomId, playerId }) => {
      const room = getRoom(roomId);
      if (!room || room.adminId !== playerId) return;

      const sockets = getConnectionsInRoom(roomId);
      io.to(roomId).emit("room:dissolved");
      sockets.forEach(socketId => {
        const memberSocket = io.sockets.sockets.get(socketId);
        if (memberSocket) {
          memberSocket.leave(roomId);
        }
        removeConnection(socketId);
      });
      deleteRoom(roomId);
    });

    // ROOM: REORDER (Admin only)
    socket.on("room:reorder", ({ roomId, newPlayersOrder }) => {
      const room = getRoom(roomId);
      if(room && room.roomStatus === "lobby") {
         room.players = newPlayersOrder;
         io.to(roomId).emit("room:updated", room);
      }
    });

    // ROOM: SETTINGS
    socket.on("room:settings", ({ roomId, settings }) => {
      const room = getRoom(roomId);
      if(room && room.roomStatus === "lobby") {
         room.settings = { ...room.settings, ...settings };
         io.to(roomId).emit("room:updated", room);
      }
    });

    // PLAYER: BUY IN
    socket.on("player:buyIn", ({ roomId, playerId, amount }) => {
       const room = getRoom(roomId);
       if(room && room.roomStatus === "lobby") {
          const player = room.players.find(p => p.id === playerId);
          if (player) {
             player.stack = amount;
             player.totalBoughtIn = amount;
             player.isSittingOut = false;
             player.inCurrentHand = false;
             io.to(roomId).emit("room:updated", room);
          }
       }
    });

    // GAME: START HAND
    socket.on("game:start", ({ roomId }) => {
       const room = getRoom(roomId);
       if(room) {
          gameEngine.startHand(room);
          io.to(roomId).emit("game:stateUpdate", room);
          
          // Trigger initial BGM synchronization for all clients
          room.bgmState.startTime = Date.now();
          io.to(roomId).emit("bgm:syncTrack", room.bgmState);
       }
    });

    // GAME: ACTION (Bet, Call, Fold, Check)
    socket.on("game:action", ({ roomId, playerId, action, amount }, callback) => {
       const room = getRoom(roomId);
       if(!room) {
          if (callback) callback({ success: false, message: "Room not found" });
          return;
       }
       
       const success = gameEngine.handleAction(room, playerId, action, amount);
       if (success) {
           // Check if there's only one player left
           const remaining = gameEngine.checkOnlyOnePlayerLeft(room);
           if (remaining) {
               // Auto win
               gameEngine.resolveShowdown(room, [remaining.id]);
               room.gameState.currentRound = "showdown";
               io.to(roomId).emit("game:stateUpdate", room);
               if (callback) callback({ success: true });
               return;
           }

           if (gameEngine.isRoundComplete(room)) {
               gameEngine.advanceRound(room);
           } else {
               gameEngine.advanceTurn(room);
           }
           io.to(roomId).emit("game:stateUpdate", room);
           if (callback) callback({ success: true });
       } else if (callback) {
           callback({ success: false, message: "Invalid or stale action" });
       }
    });

    // GAME: SHOWDOWN VOTE
    socket.on("game:showdownVote", ({ roomId, playerId, vote }, callback) => {
       const room = getRoom(roomId);
       if(!room) {
          if (callback) callback({ success: false, message: "Room not found" });
          return;
       }

       const result = gameEngine.handleShowdownVote(room, playerId, vote);
       if (result === "ALL_LOST") {
           io.to(roomId).emit("game:stateUpdate", room);
           if (callback) callback({ success: true, result });
       } else if (result === "WINNER_CONSENSUS") {
           const winners = room.gameState.showdownVotes.filter(v => v.vote === "WON").map(v => v.playerId);
           gameEngine.resolveShowdown(room, winners);
           io.to(roomId).emit("game:stateUpdate", room);
           if (callback) callback({ success: true, result });
       } else if (result === "TIE_CONSENSUS") {
           const winners = room.gameState.showdownVotes.filter(v => v.vote === "WON").map(v => v.playerId);
           gameEngine.resolveShowdown(room, winners);
           io.to(roomId).emit("game:stateUpdate", room);
           if (callback) callback({ success: true, result });
       } else if (result === "DUPLICATE" || result === "REJECTED") {
           if (callback) callback({ success: false, result });
       } else {
           io.to(roomId).emit("game:stateUpdate", room);
           if (callback) callback({ success: true, result });
       }
    });

    // GAME: UNDO WINNER
    socket.on("game:undoWinner", ({ roomId }) => {
       const room = getRoom(roomId);
       if(!room) return;
       gameEngine.undoRound(room);
       room.gameState.showdownVotes = [];
       room.gameState.lastHandWinners = [];
       room.gameState.currentRound = "showdown";
       io.to(roomId).emit("game:stateUpdate", room);
    });

    // GAME: UNDO ROUND
    socket.on("game:undoRound", ({ roomId }) => {
       const room = getRoom(roomId);
       if(!room) return;
       gameEngine.undoRound(room);
       io.to(roomId).emit("game:stateUpdate", room);
    });

    // GAME: NEXT HAND
    socket.on("game:nextHand", ({ roomId }) => {
       const room = getRoom(roomId);
       if(!room) return;
       const success = gameEngine.startHand(room);
       if (success) {
           io.to(roomId).emit("game:stateUpdate", room);
       }
    });

    // GAME: CONCLUDE
    socket.on("game:conclude", ({ roomId }) => {
       const room = getRoom(roomId);
       if(!room) return;
       gameEngine.concludeGame(room);
       io.to(roomId).emit("game:stateUpdate", room);
    });

    // GAME: REBUY
    socket.on("game:rebuy", ({ roomId, playerId, amount }) => {
       const room = getRoom(roomId);
       if(!room) return;
       gameEngine.rebuy(room, playerId, amount);
       io.to(roomId).emit("game:stateUpdate", room);
    });

    // BGM: Admin DJ track ended — rotate to next track
    socket.on("bgm:trackEnded", ({ roomId }) => {
       const room = getRoom(roomId);
       if (!room) return;
       room.bgmState.currentTrackIndex = (room.bgmState.currentTrackIndex % room.bgmState.totalTracks) + 1;
       room.bgmState.startTime = Date.now();
       io.to(roomId).emit("bgm:syncTrack", room.bgmState);
    });

    // DISCONNECT (tab close, network drop, etc.)
    socket.on("disconnect", () => {
      const conn = getConnection(socket.id);
      if (conn) {
        removeConnection(socket.id);
      }
    });
  });
}

module.exports = { mountSocketHandlers };
