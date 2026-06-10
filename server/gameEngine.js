// Pure functions that mutate room state

function takeSnapshot(room) {
  // Deep copy the current relevant game state to history
  const snapshot = JSON.parse(JSON.stringify({
    players: room.players,
    gameState: {
      currentRound: room.gameState.currentRound,
      pot: room.gameState.pot,
      currentRoundHighestBet: room.gameState.currentRoundHighestBet,
      activePlayerIndex: room.gameState.activePlayerIndex,
      turnVersion: room.gameState.turnVersion
    }
  }));
  room.gameState.roundHistory.push(snapshot);
}

function undoRound(room) {
  if (room.gameState.roundHistory.length === 0) return false;
  
  // Pop the most recent snapshot
  const snapshot = room.gameState.roundHistory.pop();
  
  // Replace current state
  room.players = snapshot.players;
  room.gameState.currentRound = snapshot.gameState.currentRound;
  room.gameState.pot = snapshot.gameState.pot;
  room.gameState.currentRoundHighestBet = snapshot.gameState.currentRoundHighestBet;
  room.gameState.activePlayerIndex = snapshot.gameState.activePlayerIndex;
  room.gameState.turnVersion = (room.gameState.turnVersion || 0) + 1;
  
  return true;
}

function resetRoundContributions(room) {
  room.players.forEach(p => {
    p.currentRoundContribution = 0;
    p.hasActedThisRound = false;
  });
  room.gameState.currentRoundHighestBet = 0;
}

function getMinimumStackForHand(room) {
    if (room.settings.blindMode === "ante_all") {
        return room.settings.ante;
    }
    return 1;
}

function isEligibleForNextHand(room, player) {
    return player.stack >= getMinimumStackForHand(room);
}

function isInCurrentHand(player) {
    return player.inCurrentHand !== false && !player.isSittingOut;
}

function determineActivePlayers(room) {
    return room.players.filter(p => isInCurrentHand(p) && p.status === "active" && p.stack > 0);
}

function determinePlayersInHand(room) {
    return room.players.filter(p => isInCurrentHand(p) && p.status === "active");
}

function startHand(room) {
  room.roomStatus = "playing";
  room.gameState.gameNumber += 1;
  room.gameState.currentRound = "pre-flop";
  room.gameState.pot = 0;
  room.gameState.roundHistory = [];
  room.gameState.showdownVotes = [];
  room.gameState.lastHandWinners = [];
  room.gameState.turnVersion = (room.gameState.turnVersion || 0) + 1;
  
  // Lock the participant set for this hand. Rebuys during the hand do not change this.
  room.players.forEach(p => {
    const canPlayThisHand = isEligibleForNextHand(room, p);
    p.inCurrentHand = canPlayThisHand;
    p.isSittingOut = !canPlayThisHand;
    if (canPlayThisHand) {
      p.status = "active";
    } else {
      p.status = "waiting";
    }
    p.currentRoundContribution = 0;
    p.totalHandContribution = 0;
    p.hasActedThisRound = false;
  });

  const activePlayers = determineActivePlayers(room);
  if (activePlayers.length < 2) return false;

  // Move dealer button logic
  if (room.gameState.gameNumber > 1) {
     if (room.settings.sequenceMode === "standard") {
        room.gameState.dealerIndex = (room.gameState.dealerIndex + 1) % room.players.length;
        // Skip players who are not locked into this hand
        while (!isInCurrentHand(room.players[room.gameState.dealerIndex]) || room.players[room.gameState.dealerIndex].status === "waiting") {
           room.gameState.dealerIndex = (room.gameState.dealerIndex + 1) % room.players.length;
        }
     }
  } else {
     room.gameState.dealerIndex = room.players.findIndex(p => p.isDealer);
  }
  
  // Update UI dealer indicators
  room.players.forEach((p, i) => p.isDealer = (i === room.gameState.dealerIndex));

  // Note: Here we assume sequential layout in standard setup
  resetRoundContributions(room);

  // Take initial snapshot before blind collection
  takeSnapshot(room);

  // Collect Antes/Blinds
  let firstActorIndex = -1;
  const numPlayers = room.players.length;

  if (room.settings.blindMode === "ante_all") {
    // Everyone pays ante
    room.players.forEach(p => {
      if (isInCurrentHand(p) && p.status === "active" && p.stack > 0) {
        const anteAmt = Math.min(p.stack, room.settings.ante);
        p.stack -= anteAmt;
        p.currentRoundContribution += anteAmt;
        p.totalHandContribution += anteAmt;
        room.gameState.pot += anteAmt;
      }
    });
    room.gameState.currentRoundHighestBet = room.settings.ante;
    // Action starts from dealer in ante-all mode
    firstActorIndex = room.gameState.dealerIndex;
  } else {
    // Standard Small / Big Blind
    let sbIndex = (room.gameState.dealerIndex + 1) % numPlayers;
    // ensure active
    while(!isInCurrentHand(room.players[sbIndex]) || room.players[sbIndex].status !== 'active') { sbIndex = (sbIndex + 1) % numPlayers; }
    
    let bbIndex = (sbIndex + 1) % numPlayers;
    while(!isInCurrentHand(room.players[bbIndex]) || room.players[bbIndex].status !== 'active') { bbIndex = (bbIndex + 1) % numPlayers; }

    const sbPlayer = room.players[sbIndex];
    if (sbPlayer) {
       let sbAmt = Math.min(sbPlayer.stack, room.settings.smallBlind);
       sbPlayer.stack -= sbAmt;
       sbPlayer.currentRoundContribution += sbAmt;
       sbPlayer.totalHandContribution += sbAmt;
       room.gameState.pot += sbAmt;
    }

    const bbPlayer = room.players[bbIndex];
    if (bbPlayer) {
       let bbAmt = Math.min(bbPlayer.stack, room.settings.bigBlind);
       bbPlayer.stack -= bbAmt;
       bbPlayer.currentRoundContribution += bbAmt;
       bbPlayer.totalHandContribution += bbAmt;
       room.gameState.pot += bbAmt;
    }
    
    room.gameState.currentRoundHighestBet = room.settings.bigBlind;
    firstActorIndex = (bbIndex + 1) % numPlayers;
  }

  const playersWhoCanActAfterForcedBets = determineActivePlayers(room);
  if (playersWhoCanActAfterForcedBets.length === 0) {
     room.gameState.activePlayerIndex = room.gameState.dealerIndex;
     room.gameState.currentRound = "showdown";
     room.gameState.roundHistory = [];
     takeSnapshot(room);
     return true;
  }

  // Find next valid actor
  let actorLoops = 0;
  while ((!isInCurrentHand(room.players[firstActorIndex]) || room.players[firstActorIndex].status !== "active" || room.players[firstActorIndex].stack <= 0) && actorLoops < numPlayers) {
     firstActorIndex = (firstActorIndex + 1) % numPlayers;
     actorLoops++;
  }
  room.gameState.activePlayerIndex = firstActorIndex;

  // After blinds, update snapshot or take another? Let's treat preflop start as post-blinds
  // so undoing restores to right before the first player acts, but resets contributions?
  // Actually taking snapshot here is better. We replace history.
  room.gameState.roundHistory = [];
  takeSnapshot(room);

  return true;
}

function handleAction(room, playerId, action, amount = 0) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !isInCurrentHand(player) || player.status !== "active" || player.stack <= 0) return false;
  if (room.gameState.currentRound === "showdown") return false;

  const activePlayer = room.players[room.gameState.activePlayerIndex];
  if (!activePlayer || activePlayer.id !== playerId) return false;

  const highestBet = room.gameState.currentRoundHighestBet;
  const amountToCall = Math.max(0, highestBet - player.currentRoundContribution);

  switch (action) {
    case "fold":
      player.status = "folded";
      break;
    case "check":
      // Valid if player.currentRoundContribution === highestBet
      if (amountToCall !== 0) return false;
      break;
    case "call":
      {
        if (amountToCall <= 0) return false;
        const actualCall = Math.min(player.stack, amountToCall);
        player.stack -= actualCall;
        player.currentRoundContribution += actualCall;
        player.totalHandContribution += actualCall;
        room.gameState.pot += actualCall;
      }
      break;
    case "raise":
    case "bet":
      {
         if (!Number.isFinite(amount) || amount <= 0 || amount > player.stack) return false;
         if (action === "bet" && amountToCall !== 0) return false;
         if (action === "raise" && amountToCall <= 0) return false;
         const totalContributed = player.currentRoundContribution + amount;
         player.stack -= amount;
         player.currentRoundContribution += amount;
         player.totalHandContribution += amount;
         room.gameState.pot += amount;
         if (totalContributed > highestBet) {
             room.gameState.currentRoundHighestBet = totalContributed;
             // A raise reopens action for everyone else
             room.players.forEach(p => {
               if (p.id !== playerId && isInCurrentHand(p) && p.status === "active" && p.stack > 0) {
                 p.hasActedThisRound = false;
               }
             });
         }
      }
      break;
  }

  // Mark this player as having acted
  player.hasActedThisRound = true;

  return true;
}

function advanceTurn(room) {
  const numPlayers = room.players.length;
  let nextIndex = (room.gameState.activePlayerIndex + 1) % numPlayers;
  
  // Loop until we find active player who hasn't folded and has stack > 0
  let loops = 0;
  while ((!isInCurrentHand(room.players[nextIndex]) || room.players[nextIndex].status !== "active" || room.players[nextIndex].stack <= 0) && loops < numPlayers) {
     nextIndex = (nextIndex + 1) % numPlayers;
     loops++;
  }
  room.gameState.activePlayerIndex = nextIndex;
}

function isRoundComplete(room) {
  const playersInHand = determinePlayersInHand(room);
  
  if (playersInHand.length <= 1) return true; // Everyone folded but one
  
  const highestBet = room.gameState.currentRoundHighestBet;
  
  // BOTH conditions must be true for a round to complete:
  // 1. Every player who can still act has contributed === highestBet
  // 2. Every player who can still act has acted this round
  const playersWhoCanAct = determineActivePlayers(room);
  if (playersWhoCanAct.length === 0) return true;
  
  const allContributionsMatch = playersWhoCanAct.every(
    p => p.currentRoundContribution === highestBet
  );
  
  const allHaveActed = playersWhoCanAct.every(
    p => p.hasActedThisRound === true
  );
  
  return allContributionsMatch && allHaveActed;
}

function advanceRound(room) {
  const rounds = ["pre-flop", "flop", "turn", "river", "showdown"];
  const currIdx = rounds.indexOf(room.gameState.currentRound);
  
  if (currIdx < rounds.length - 1) {
     room.gameState.currentRound = rounds[currIdx + 1];
     if (room.gameState.currentRound !== "showdown") {
         resetRoundContributions(room);
         takeSnapshot(room);
         const playersWhoCanAct = determineActivePlayers(room);
         if (playersWhoCanAct.length < 2) {
            room.gameState.currentRound = "showdown";
            return;
         }
         // Set action to the street starter for the configured blind mode
         let firstActorIndex = room.settings.blindMode === "ante_all"
            ? room.gameState.dealerIndex
            : (room.gameState.dealerIndex + 1) % room.players.length;
         while (!isInCurrentHand(room.players[firstActorIndex]) || room.players[firstActorIndex].status !== "active" || room.players[firstActorIndex].stack <= 0) {
            firstActorIndex = (firstActorIndex + 1) % room.players.length;
         }
         room.gameState.activePlayerIndex = firstActorIndex;
     }
  }
}

function checkOnlyOnePlayerLeft(room) {
   const nonFolded = determinePlayersInHand(room);
   if (nonFolded.length === 1) {
       return nonFolded[0];
   }
   return null;
}

function handleShowdownVote(room, playerId, vote) {
   const player = room.players.find(p => p.id === playerId);
   if (room.gameState.currentRound !== "showdown" || room.gameState.pot <= 0) return "REJECTED";
   if (!player || !isInCurrentHand(player) || player.status !== "active") return "PENDING";
   if (vote !== "WON" && vote !== "LOST") return "REJECTED";
   if (room.gameState.showdownVotes.some(v => v.playerId === playerId)) return "DUPLICATE";

   room.gameState.showdownVotes = room.gameState.showdownVotes.filter(v => v.playerId !== playerId);
   room.gameState.showdownVotes.push({ playerId, vote });
   
   const activePlayers = determinePlayersInHand(room);
   
   if (room.gameState.showdownVotes.length === activePlayers.length) {
       // Evaluate consensus
       const winners = room.gameState.showdownVotes.filter(v => v.vote === "WON");
       if (winners.length === 0) {
           // All lost. Reset votes.
           room.gameState.showdownVotes = [];
           return "ALL_LOST";
       } else if (winners.length === 1) {
           return "WINNER_CONSENSUS";
       } else {
           return "TIE_CONSENSUS";
       }
   }
   return "PENDING";
}

function resolveShowdown(room, winners) {
   // winners is array of playerId strings
   room.gameState.lastHandWinners = winners
     .map(id => {
       const player = room.players.find(p => p.id === id);
       return player ? { id: player.id, name: player.name } : null;
     })
     .filter(Boolean);

   const splitAmount = Math.floor(room.gameState.pot / winners.length);
   
   room.players.forEach(p => {
       if (winners.includes(p.id)) {
           p.stack += splitAmount;
       }
   });
   // Leave remaining odd chips in pot, or give to first winner
   const remainder = room.gameState.pot - (splitAmount * winners.length);
   if (remainder > 0 && winners.length > 0) {
       const firstWinner = room.players.find(p => p.id === winners[0]);
       if (firstWinner) firstWinner.stack += remainder;
   }
   
  // Winner's Curse: winner becomes last in next hand sequence
  if (room.settings.sequenceMode === "winner_curse" && winners.length > 0) {
     const winnerIdx = room.players.findIndex(p => p.id === winners[0]);
     if (winnerIdx !== -1) {
       let nextDealerIndex = (winnerIdx + 1) % room.players.length;
       while ((room.players[nextDealerIndex].stack <= 0 || room.players[nextDealerIndex].status === "waiting") && nextDealerIndex !== winnerIdx) {
         nextDealerIndex = (nextDealerIndex + 1) % room.players.length;
       }
       room.gameState.dealerIndex = nextDealerIndex;
     }
  }
   
   room.gameState.pot = 0;
}

function concludeGame(room) {
  // Refund current pot based on totalHandContribution
  room.players.forEach(p => {
     p.stack += p.totalHandContribution;
  });
  room.gameState.pot = 0;
  room.roomStatus = "stats";
}

function rebuy(room, playerId, amount) {
  const p = room.players.find(p => p.id === playerId);
  if (p) {
      p.stack += amount;
      p.totalBoughtIn = (p.totalBoughtIn || 0) + amount;
      return true;
  }
  return false;
}

module.exports = {
  takeSnapshot,
  undoRound,
  startHand,
  handleAction,
  advanceTurn,
  isRoundComplete,
  advanceRound,
  checkOnlyOnePlayerLeft,
  handleShowdownVote,
  resolveShowdown,
  concludeGame,
  rebuy
};
