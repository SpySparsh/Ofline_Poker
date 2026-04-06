"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/context/SocketContext";
import { ChipTray } from "@/components/ChipIcon";
import { useAudio } from "@/hooks/useAudio";

export default function ActionPanel({ roomState }) {
  const { socket, playerId } = useSocket();
  const { playChipSound, playSfx } = useAudio();
  const [stagedAmount, setStagedAmount] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);

  const me = roomState?.players.find(p => p.id === playerId);
  const myIndex = roomState?.players.findIndex(p => p.id === playerId);
  const isMyTurn = roomState?.gameState.activePlayerIndex === myIndex;
  
  if (!me) return null;

  const highestBet = roomState.gameState.currentRoundHighestBet;
  const amountToCall = Math.max(0, highestBet - me.currentRoundContribution);
  const canCheck = amountToCall === 0;

  // Reset staged amount when turn changes
  useEffect(() => {
    if (isMyTurn) {
      setStagedAmount(0);
      setIsConfirming(false);
    }
  }, [isMyTurn]);

  const handleAction = (action, amount = 0) => {
    playSfx("click");
    socket.emit("game:action", { roomId: roomState.roomId, playerId, action, amount });
    setStagedAmount(0);
    setIsConfirming(false);
  };

  const handleAddChip = (denomination) => {
    // Play chip sound based on denomination
    playChipSound(denomination);
    
    // Can't exceed stack (minus any call cost already covered)
    const maxBet = me.stack - amountToCall;
    const newAmount = Math.min(stagedAmount + denomination, maxBet);
    if (newAmount > stagedAmount) {
      setStagedAmount(newAmount);
    }
  };

  const handleClearStaged = () => {
    setStagedAmount(0);
    setIsConfirming(false);
  };

  // NOT MY TURN — compact waiting display
  if (!isMyTurn) {
    const activePlayer = roomState.players[roomState.gameState.activePlayerIndex];
    return (
      <div className="glass-panel px-4 py-3 w-full max-w-2xl mx-auto flex items-center justify-center bg-black/80">
        <div className="text-zinc-500 font-semibold text-xs uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
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
        <div className="glass-panel px-3 py-2 mb-2 bg-black/70 border-b-0 rounded-b-none">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Tap chips to bet</span>
            {stagedAmount > 0 && (
              <button onClick={handleClearStaged} className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold tracking-wider flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                Clear
              </button>
            )}
          </div>
          <ChipTray onAddChip={handleAddChip} availableStack={me.stack} />
          
          {/* Staged amount indicator */}
          {stagedAmount > 0 && (
            <div className="mt-2 flex items-center justify-center gap-2 text-emerald-400">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Staged:</span>
              <span className="font-mono font-bold text-lg">{stagedAmount.toLocaleString()}</span>
              {isAllIn && <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full">ALL IN</span>}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons Row — compact */}
      <div className="glass-panel px-3 py-2.5 bg-black/90 flex items-stretch gap-2" style={{ borderTopLeftRadius: canRaise ? 0 : undefined, borderTopRightRadius: canRaise ? 0 : undefined }}>
        
        {/* Fold */}
        <button 
          onClick={() => handleAction("fold")}
          className="flex-shrink-0 px-4 py-2.5 bg-red-600/80 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95"
        >
          Fold
        </button>

        {/* Check / Call */}
        <button 
          onClick={() => handleAction(canCheck ? "check" : "call")}
          className="flex-shrink-0 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 flex items-center gap-1.5"
        >
          {canCheck ? "Check" : "Call"}
          {!canCheck && <span className="font-mono text-emerald-300 text-xs">{amountToCall.toLocaleString()}</span>}
        </button>

        {/* Raise / Bet — Two-step confirm */}
        {canRaise && (
          <button 
            onClick={() => {
              if (stagedAmount <= 0) return;
              if (!isConfirming) {
                setIsConfirming(true);
                return;
              }
              // Second click → fire
              handleAction(canCheck ? "bet" : "raise", totalRaiseAmount);
            }}
            disabled={stagedAmount <= 0}
            className={`flex-1 px-4 py-2.5 font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
              isConfirming 
                ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse-subtle" 
                : "bg-emerald-700/60 hover:bg-emerald-600 text-white disabled:opacity-30 disabled:pointer-events-none"
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
