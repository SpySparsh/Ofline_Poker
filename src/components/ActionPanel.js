"use client";

import { useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { ChipTray } from "@/components/ChipIcon";
import { useAudio } from "@/hooks/useAudio";

export default function ActionPanel({ roomState }) {
  const { socket, playerId } = useSocket();
  const { playChipSound, playSfx } = useAudio();
  const [betState, setBetState] = useState({
    turnKey: "",
    stagedAmount: 0,
    isConfirming: false,
    selectedDenomination: null,
  });
  const [submittedActionKey, setSubmittedActionKey] = useState("");

  const me = roomState?.players.find(p => p.id === playerId);
  const myIndex = roomState?.players.findIndex(p => p.id === playerId);
  const actionLockKey = [
    roomState?.gameState.currentRound,
    roomState?.gameState.activePlayerIndex,
    roomState?.gameState.turnVersion || 0,
  ].join(":");
  const turnKey = [
    roomState?.gameState.currentRound,
    roomState?.gameState.activePlayerIndex,
    roomState?.gameState.turnVersion || 0,
    roomState?.gameState.currentRoundHighestBet,
    me?.currentRoundContribution,
    me?.stack,
  ].join(":");
  const isSittingOut = me?.isSittingOut || me?.inCurrentHand === false;
  const isMyTurn = !isSittingOut && roomState?.gameState.activePlayerIndex === myIndex;
  const isCurrentBetState = betState.turnKey === turnKey;
  const stagedAmount = isCurrentBetState ? betState.stagedAmount : 0;
  const isConfirming = isCurrentBetState ? betState.isConfirming : false;
  const selectedDenomination = isCurrentBetState ? betState.selectedDenomination : null;
  const isActionLocked = isMyTurn && submittedActionKey === actionLockKey;

  const resetBetState = () => {
    setBetState({
      turnKey,
      stagedAmount: 0,
      isConfirming: false,
      selectedDenomination: null,
    });
  };

  if (!me) return null;

  const highestBet = roomState.gameState.currentRoundHighestBet;
  const amountToCall = Math.max(0, highestBet - me.currentRoundContribution);
  const canCheck = amountToCall === 0;

  const handleAction = (action, amount = 0) => {
    if (isActionLocked) return;
    setSubmittedActionKey(actionLockKey);
    playSfx("click");
    socket.emit("game:action", { roomId: roomState.roomId, playerId, action, amount }, (res) => {
      if (!res?.success) {
        setSubmittedActionKey("");
      }
    });
    resetBetState();
  };

  const handleAddChip = (denomination) => {
    if (isActionLocked) return;
    // Play chip sound based on denomination
    playChipSound(denomination);
    
    // Can't exceed stack (minus any call cost already covered)
    const maxBet = me.stack - amountToCall;
    const newAmount = Math.min(stagedAmount + denomination, maxBet);
    if (newAmount > stagedAmount) {
      setBetState({
        turnKey,
        stagedAmount: newAmount,
        isConfirming,
        selectedDenomination: denomination,
      });
    }
  };

  const handleClearStaged = () => {
    resetBetState();
  };

  // NOT MY TURN — compact waiting display
  if (isSittingOut) {
    return (
      <div className="glass-panel px-3 py-2 md:py-3 w-full max-w-2xl mx-auto flex items-center justify-center bg-black/80">
        <div className="text-zinc-500 font-semibold text-[11px] md:text-xs uppercase tracking-widest">
          Sitting out this hand
        </div>
      </div>
    );
  }

  if (!isMyTurn) {
    const activePlayer = roomState.players[roomState.gameState.activePlayerIndex];
    return (
      <div className="glass-panel px-3 py-2 md:py-3 w-full max-w-2xl mx-auto flex items-center justify-center bg-black/80">
        <div className="text-zinc-400 font-semibold text-[11px] md:text-xs uppercase tracking-widest flex items-center gap-2">
          <svg className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Waiting for {activePlayer ? activePlayer.name : "..."}
        </div>
      </div>
    );
  }

  // MY TURN
  const totalRaiseAmount = amountToCall + stagedAmount;
  const isAllIn = totalRaiseAmount >= me.stack;
  const canRaise = me.stack > amountToCall;

  return (
    <div className="w-full max-w-2xl mx-auto animate-pop">
      
      {/* Chip Tray — horizontally scrollable */}
      {canRaise && (
        <div className="glass-panel px-3 py-2.5 md:py-2 mb-1.5 md:mb-2 bg-black/70 border-b-0 rounded-b-none">
          <div className="flex items-center justify-between mb-1.5 md:mb-1.5">
            <span className="text-xs md:text-[10px] text-zinc-400 md:text-zinc-500 uppercase font-bold tracking-wider">Tap chips to bet</span>
            {stagedAmount > 0 && (
              <button onClick={handleClearStaged} className="min-h-8 px-2 md:min-h-0 md:px-0 text-xs md:text-[10px] text-red-400 hover:text-red-300 uppercase font-bold tracking-wider flex items-center gap-1">
                <svg className="w-3.5 h-3.5 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                Clear
              </button>
            )}
          </div>
          <ChipTray onAddChip={handleAddChip} availableStack={me.stack} selectedDenomination={selectedDenomination} />
          
          {/* Staged amount indicator */}
          {stagedAmount > 0 && (
            <div className="mt-1.5 md:mt-2 flex items-center justify-center gap-2 text-emerald-400">
              <span className="text-xs md:text-[10px] uppercase tracking-wider text-zinc-500">Staged:</span>
              <span className="font-mono font-bold text-xl md:text-lg">{stagedAmount.toLocaleString()}</span>
              {isAllIn && <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full">ALL IN</span>}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons Row — compact */}
      <div className={`glass-panel px-2.5 md:px-3 py-2.5 md:py-2.5 bg-black/90 grid ${canRaise ? "grid-cols-[0.9fr_1fr_1.45fr]" : "grid-cols-2"} md:flex md:items-stretch gap-2.5 md:gap-2`} style={{ borderTopLeftRadius: canRaise ? 0 : undefined, borderTopRightRadius: canRaise ? 0 : undefined }}>
        
        {/* Fold */}
        <button 
          onClick={() => handleAction("fold")}
          disabled={isActionLocked}
          className="md:flex-shrink-0 min-h-16 md:min-h-0 px-3 md:px-4 py-4 md:py-2.5 bg-red-600/80 hover:bg-red-500 text-white font-bold text-sm md:text-xs uppercase tracking-wider rounded-xl md:rounded-lg transition-all active:scale-95 disabled:opacity-45 disabled:saturate-50 disabled:pointer-events-none"
        >
          Fold
        </button>

        {/* Check / Call */}
        <button 
          onClick={() => handleAction(canCheck ? "check" : "call")}
          disabled={isActionLocked}
          className="md:flex-shrink-0 min-h-16 md:min-h-0 px-3 md:px-4 py-4 md:py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-sm md:text-xs uppercase tracking-wider rounded-xl md:rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:saturate-50 disabled:pointer-events-none"
        >
          {canCheck ? "Check" : "Call"}
          {!canCheck && <span className="font-mono text-emerald-300 text-sm md:text-xs">{amountToCall.toLocaleString()}</span>}
        </button>

        {/* Raise / Bet — Two-step confirm */}
        {canRaise && (
          <button 
            onClick={() => {
              if (isActionLocked) return;
              if (stagedAmount <= 0) return;
              if (!isConfirming) {
                setBetState({
                  turnKey,
                  stagedAmount,
                  isConfirming: true,
                  selectedDenomination,
                });
                return;
              }
              // Second click → fire
              handleAction(canCheck ? "bet" : "raise", totalRaiseAmount);
            }}
            disabled={stagedAmount <= 0 || isActionLocked}
            className={`md:flex-1 min-h-16 md:min-h-0 px-3 md:px-4 py-4 md:py-2.5 font-bold text-sm md:text-xs uppercase tracking-wider rounded-xl md:rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
              isConfirming 
                ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.55)] animate-pulse-subtle"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.28)] disabled:bg-zinc-800 disabled:shadow-none disabled:opacity-45 disabled:saturate-50 disabled:pointer-events-none"
            }`}
          >
            {isConfirming ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                Confirm {canCheck ? "Bet" : "Raise"}: {totalRaiseAmount.toLocaleString()}
              </>
            ) : (
              <>
                {canCheck ? "Bet" : "Raise"}
                {stagedAmount > 0 && <span className="font-mono text-emerald-200">{totalRaiseAmount.toLocaleString()}</span>}
              </>
            )}
          </button>
        )}

      </div>
    </div>
  );
}
