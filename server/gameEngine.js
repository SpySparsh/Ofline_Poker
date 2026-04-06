// Pure functions that mutate room state

function takeSnapshot(room) {
  // Deep copy the current relevant game state to history
  const snapshot = JSON.parse(JSON.stringify({
    players: room.players,
    gameState: {
      currentRound: room.gameState.currentRound,
      pot: room.gameState.pot,
      currentRoundHighestBet: room.gameState.currentRoundHighestBet,
      activePlayerIndex: room.gameState.activePlayerIndex
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
  
  return true;
}

function resetRoundContributions(room) {
  room.players.forEach(p => {
    p.currentRoundContribution = 0;
    p.hasActedThisRound = false;
  });
  room.gameState.currentRoundHighestBet = 0;
}

function determineActivePlayers(room) {
    return room.players.filter(p => p.status === "active" && p.stack > 0);
}

function startHand(room) {
  room.roomStatus = "playing";
  room.gameState.gameNumber += 1;
  room.gameState.currentRound = "pre-flop";
  room.gameState.pot = 0;
  room.gameState.roundHistory = [];
  room.gameState.showdownVotes = [];
  
  // Bring waiting players into active
  room.players.forEach(p => {
    if (p.status === "waiting" && p.stack > 0) {
      p.status = "active";
    } else if (p.status === "folded" && p.stack > 0) {
      p.status = "active";
    }
    p.currentRoundContribution = 0;
    p.totalHandContribution = 0;
  });

  const activePlayers = determineActivePlayers(room);
  if (activePlayers.length < 2) return false;

  // Move dealer button logic
  if (room.gameState.gameNumber > 1) {
     if (room.settings.sequenceMode === "standard") {
        room.gameState.dealerIndex = (room.gameState.dealerIndex + 1) % room.players.length;
        // Skip players with 0 stack or waiting
        while (room.players[room.gameState.dealerIndex].stack <= 0 || room.players[room.gameState.dealerIndex].status === "waiting") {
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
      if (p.status === "active" && p.stack > 0) {
        const anteAmt = Math.min(p.stack, room.settings.ante);
        p.stack -= anteAmt;
        p.currentRoundContribution += anteAmt;
        p.totalHandContribution += anteAmt;
        room.gameState.pot += anteAmt;
      }
    });
    room.gameState.currentRoundHighestBet = room.settings.ante;
    // Action starts left of dealer
    firstActorIndex = (room.gameState.dealerIndex + 1) % numPlayers;
  } else {
    // Standard Small / Big Blind
    let sbIndex = (room.gameState.dealerIndex + 1) % numPlayers;
    // ensure active
    while(room.players[sbIndex].status !== 'active') { sbIndex = (sbIndex + 1) % numPlayers; }
    
    let bbIndex = (sbIndex + 1) % numPlayers;
    while(room.players[bbIndex].status !== 'active') { bbIndex = (bbIndex + 1) % numPlayers; }

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

  // Find next valid actor
  while (room.players[firstActorIndex].status !== "active" || room.players[firstActorIndex].stack <= 0) {
     firstActorIndex = (firstActorIndex + 1) % numPlayers;
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
  if (!player || player.status !== "active") return false;

  const highestBet = room.gameState.currentRoundHighestBet;

  switch (action) {
    case "fold":
      player.status = "folded";
      break;
    case "check":
      // Valid if player.currentRoundContribution === highestBet
      break;
    case "call":
      {
        const amountToCall = highestBet - player.currentRoundContribution;
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
         const totalContributed = player.currentRoundContribution + amount;
         player.stack -= amount;
         player.currentRoundContribution += amount;
         player.totalHandContribution += amount;
         room.gameState.pot += amount;
         if (totalContributed > highestBet) {
             room.gameState.currentRoundHighestBet = totalContributed;
             // A raise reopens action for everyone else
             room.players.forEach(p => {
               if (p.id !== playerId && p.status === "active" && p.stack > 0) {
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
  while ((room.players[nextIndex].status !== "active" || room.players[nextIndex].stack <= 0) && loops < numPlayers) {
     nextIndex = (nextIndex + 1) % numPlayers;
     loops++;
  }
  room.gameState.activePlayerIndex = nextIndex;
}

function isRoundComplete(room) {
  const activePlayers = determineActivePlayers(room);
  
  if (activePlayers.length <= 1) return true; // Everyone folded but one, or everyone all-in
  
  const highestBet = room.gameState.currentRoundHighestBet;
  
  // BOTH conditions must be true for a round to complete:
  // 1. Every active player with chips has contributed === highestBet
  // 2. Every active player with chips has acted this round
  const playersWithChips = activePlayers.filter(p => p.stack > 0);
  
  const allContributionsMatch = playersWithChips.every(
    p => p.currentRoundContribution === highestBet
  );
  
  const allHaveActed = playersWithChips.every(
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
         // Set action to first active player left of dealer
         let firstActorIndex = (room.gameState.dealerIndex + 1) % room.players.length;
         while (room.players[firstActorIndex].status !== "active" || room.players[firstActorIndex].stack <= 0) {
            firstActorIndex = (firstActorIndex + 1) % room.players.length;
         }
         room.gameState.activePlayerIndex = firstActorIndex;
     }
  }
}

function checkOnlyOnePlayerLeft(room) {
   const nonFolded = room.players.filter(p => p.status === "active");
   if (nonFolded.length === 1) {
       return nonFolded[0];
   }
   return null;
}

function handleShowdownVote(room, playerId, vote) {
   room.gameState.showdownVotes = room.gameState.showdownVotes.filter(v => v.playerId !== playerId);
   room.gameState.showdownVotes.push({ playerId, vote });
   
   const activePlayers = room.players.filter(p => p.status === "active");
   
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
