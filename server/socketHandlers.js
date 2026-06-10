const { 
  createRoom, joinRoom, getRoom, deleteRoom, removePlayerFromRoom,
  trackConnection, removeConnection, getConnection, getConnectionsInRoom 
} = require("./roomManager");
const gameEngine = require("./gameEngine");

function reply(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

function bumpTurnVersion(room) {
  room.gameState.turnVersion = (room.gameState.turnVersion || 0) + 1;
}

function takeRoomSnapshot(room) {
  return JSON.parse(JSON.stringify({
    roomStatus: room.roomStatus,
    players: room.players,
    gameState: room.gameState,
    bgmState: room.bgmState,
  }));
}

function restoreRoomSnapshot(room, snapshot) {
  room.roomStatus = snapshot.roomStatus;
  room.players = snapshot.players;
  room.gameState = snapshot.gameState;
  room.bgmState = snapshot.bgmState;
}

function handlePlayerLeave(io, socket, roomId, playerId) {
  const { room, removed, empty } = removePlayerFromRoom(roomId, playerId);

  if (!removed) {
    return { success: false, message: room ? "Player not found in room" : "Room not found" };
  }
  
  socket.leave(roomId);
  removeConnection(socket.id);
  socket.emit("room:left");
  
  if (empty) {
    // Room is gone, nothing to broadcast
    return { success: true };
  }
  
  if (removed && room) {
    if (room.roomStatus === "playing") {
      bumpTurnVersion(room);
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

  return { success: true };
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
    socket.on("room:leave", ({ roomId, playerId }, callback) => {
      try {
        const result = handlePlayerLeave(io, socket, roomId, playerId);
        reply(callback, result);
      } catch (error) {
        console.error("[room:leave] failed", { roomId, playerId, error: error.message });
        reply(callback, { success: false, message: "Leave failed" });
      }
    });

    // ROOM: DISSOLVE (Admin only)
    socket.on("room:dissolve", ({ roomId, playerId }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) {
          reply(callback, { success: false, message: "Room not found" });
          return;
        }
        if (room.adminId !== playerId) {
          reply(callback, { success: false, message: "Only the host can dissolve this room" });
          return;
        }

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
        reply(callback, { success: true });
      } catch (error) {
        console.error("[room:dissolve] failed", { roomId, playerId, error: error.message });
        reply(callback, { success: false, message: "Dissolve failed" });
      }
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
    socket.on("game:start", ({ roomId }, callback) => {
       let snapshot = null;
       try {
          const room = getRoom(roomId);
          if(!room) {
             reply(callback, { success: false, message: "Room not found" });
             return;
          }
          snapshot = takeRoomSnapshot(room);
          const success = gameEngine.startHand(room);
          if (!success) {
             restoreRoomSnapshot(room, snapshot);
             reply(callback, { success: false, message: "Not enough eligible players" });
             return;
          }

          room.bgmState.startTime = Date.now();
          io.to(roomId).emit("game:stateUpdate", room);
          io.to(roomId).emit("bgm:syncTrack", room.bgmState);
          reply(callback, { success: true });
       } catch (error) {
          const room = getRoom(roomId);
          if (room && snapshot) restoreRoomSnapshot(room, snapshot);
          console.error("[game:start] failed", { roomId, error: error.message });
          reply(callback, { success: false, message: "Start hand failed" });
       }
    });

    // GAME: ACTION (Bet, Call, Fold, Check)
    socket.on("game:action", ({ roomId, playerId, action, amount }, callback) => {
       const room = getRoom(roomId);
       if(!room) {
          if (callback) callback({ success: false, message: "Room not found" });
          return;
       }
       
       let success = false;
       const snapshot = takeRoomSnapshot(room);
       try {
          success = gameEngine.handleAction(room, playerId, action, amount);
       } catch (error) {
          restoreRoomSnapshot(room, snapshot);
          console.error("[game:action] failed", {
             roomId,
             playerId,
             action,
             activePlayerIndex: room.gameState.activePlayerIndex,
             activePlayerId: room.players[room.gameState.activePlayerIndex]?.id,
             error: error.message,
          });
          if (callback) callback({ success: false, message: "Action failed" });
          return;
       }
       if (success) {
         try {
           // Check if there's only one player left
           const remaining = gameEngine.checkOnlyOnePlayerLeft(room);
           if (remaining) {
               // Auto win
               const resolved = gameEngine.resolveShowdown(room, [remaining.id]);
               if (!resolved) {
                  restoreRoomSnapshot(room, snapshot);
                  if (callback) callback({ success: false, message: "Showdown resolution failed" });
                  return;
               }
               room.gameState.currentRound = "showdown";
               bumpTurnVersion(room);
               io.to(roomId).emit("game:stateUpdate", room);
               if (callback) callback({ success: true });
               return;
           }

           if (gameEngine.isRoundComplete(room)) {
               gameEngine.advanceRound(room);
           } else {
               gameEngine.advanceTurn(room);
           }
           bumpTurnVersion(room);
           io.to(roomId).emit("game:stateUpdate", room);
           if (callback) callback({ success: true });
         } catch (error) {
           restoreRoomSnapshot(room, snapshot);
           console.error("[game:action] transition failed", {
             roomId,
             playerId,
             action,
             activePlayerIndex: room.gameState.activePlayerIndex,
             error: error.message,
           });
           if (callback) callback({ success: false, message: "Action transition failed" });
         }
       } else if (callback) {
           callback({ success: false, message: "Invalid or stale action" });
       }
    });

    // GAME: SHOWDOWN VOTE
    socket.on("game:showdownVote", ({ roomId, playerId, vote }, callback) => {
       let snapshot = null;
       try {
          const room = getRoom(roomId);
          if(!room) {
             reply(callback, { success: false, message: "Room not found" });
             return;
          }

          snapshot = takeRoomSnapshot(room);
          const result = gameEngine.handleShowdownVote(room, playerId, vote);
          if (result === "ALL_LOST") {
              bumpTurnVersion(room);
              io.to(roomId).emit("game:stateUpdate", room);
              reply(callback, { success: true, result });
          } else if (result === "WINNER_CONSENSUS" || result === "TIE_CONSENSUS") {
              const winners = room.gameState.showdownVotes.filter(v => v.vote === "WON").map(v => v.playerId);
              const resolved = gameEngine.resolveShowdown(room, winners);
              if (!resolved) {
                 restoreRoomSnapshot(room, snapshot);
                 reply(callback, { success: false, message: "Showdown resolution failed" });
                 return;
              }
              bumpTurnVersion(room);
              io.to(roomId).emit("game:stateUpdate", room);
              reply(callback, { success: true, result });
          } else if (result === "DUPLICATE" || result === "REJECTED") {
              reply(callback, { success: false, result });
          } else {
              bumpTurnVersion(room);
              io.to(roomId).emit("game:stateUpdate", room);
              reply(callback, { success: true, result });
          }
       } catch (error) {
          const room = getRoom(roomId);
          if (room && snapshot) restoreRoomSnapshot(room, snapshot);
          console.error("[game:showdownVote] failed", { roomId, playerId, vote, error: error.message });
          reply(callback, { success: false, message: "Showdown vote failed" });
       }
    });

    // GAME: UNDO WINNER
    socket.on("game:undoWinner", ({ roomId }, callback) => {
       try {
          const room = getRoom(roomId);
          if(!room) {
             reply(callback, { success: false, message: "Room not found" });
             return;
          }
          const success = gameEngine.undoRound(room);
          if (!success) {
             reply(callback, { success: false, message: "No round to undo" });
             return;
          }
          room.gameState.showdownVotes = [];
          room.gameState.lastHandWinners = [];
          room.gameState.currentRound = "showdown";
          bumpTurnVersion(room);
          io.to(roomId).emit("game:stateUpdate", room);
          reply(callback, { success: true });
       } catch (error) {
          console.error("[game:undoWinner] failed", { roomId, error: error.message });
          reply(callback, { success: false, message: "Undo winner failed" });
       }
    });

    // GAME: UNDO ROUND
    socket.on("game:undoRound", ({ roomId }, callback) => {
       try {
          const room = getRoom(roomId);
          if(!room) {
             reply(callback, { success: false, message: "Room not found" });
             return;
          }
          const success = gameEngine.undoRound(room);
          if (!success) {
             reply(callback, { success: false, message: "No round to undo" });
             return;
          }
          io.to(roomId).emit("game:stateUpdate", room);
          reply(callback, { success: true });
       } catch (error) {
          console.error("[game:undoRound] failed", { roomId, error: error.message });
          reply(callback, { success: false, message: "Undo round failed" });
       }
    });

    // GAME: NEXT HAND
    socket.on("game:nextHand", ({ roomId }, callback) => {
       let snapshot = null;
       try {
          const room = getRoom(roomId);
          if(!room) {
             reply(callback, { success: false, message: "Room not found" });
             return;
          }
          snapshot = takeRoomSnapshot(room);
          const success = gameEngine.startHand(room);
          if (!success) {
              restoreRoomSnapshot(room, snapshot);
              reply(callback, { success: false, message: "Not enough eligible players" });
              return;
          }
          io.to(roomId).emit("game:stateUpdate", room);
          reply(callback, { success: true });
       } catch (error) {
          const room = getRoom(roomId);
          if (room && snapshot) restoreRoomSnapshot(room, snapshot);
          console.error("[game:nextHand] failed", { roomId, error: error.message });
          reply(callback, { success: false, message: "Next hand failed" });
       }
    });

    // GAME: CONCLUDE
    socket.on("game:conclude", ({ roomId }, callback) => {
       let snapshot = null;
       try {
          const room = getRoom(roomId);
          if(!room) {
             reply(callback, { success: false, message: "Room not found" });
             return;
          }
          snapshot = takeRoomSnapshot(room);
          gameEngine.concludeGame(room);
          bumpTurnVersion(room);
          io.to(roomId).emit("game:stateUpdate", room);
          reply(callback, { success: true });
       } catch (error) {
          const room = getRoom(roomId);
          if (room && snapshot) restoreRoomSnapshot(room, snapshot);
          console.error("[game:conclude] failed", { roomId, error: error.message });
          reply(callback, { success: false, message: "Conclude game failed" });
       }
    });

    // GAME: REBUY
    socket.on("game:rebuy", ({ roomId, playerId, amount }, callback) => {
       try {
          const room = getRoom(roomId);
          if(!room) {
             reply(callback, { success: false, message: "Room not found" });
             return;
          }
          const success = gameEngine.rebuy(room, playerId, amount);
          if (!success) {
             reply(callback, { success: false, message: "Invalid rebuy amount" });
             return;
          }
          io.to(roomId).emit("game:stateUpdate", room);
          reply(callback, { success: true });
       } catch (error) {
          console.error("[game:rebuy] failed", { roomId, playerId, amount, error: error.message });
          reply(callback, { success: false, message: "Rebuy failed" });
       }
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
