"use client";

import { useSocket } from "@/context/SocketContext";

export default function AdminControls({ roomState }) {
  const { socket, isAdmin } = useSocket();

  if (!isAdmin || !roomState) return null;

  const handleUndoRound = () => {
    if (confirm("Undo the current round and restore the previous snapshot?")) {
      socket.emit("game:undoRound", { roomId: roomState.roomId });
    }
  };

  const handleUndoWinner = () => {
    if (confirm("Undo the winner resolution? Chips return to the pot.")) {
      socket.emit("game:undoWinner", { roomId: roomState.roomId });
    }
  };

  const handleConcludeGame = () => {
    if (confirm("Conclude the session? Mid-hand pot will be refunded proportionally.")) {
      socket.emit("game:conclude", { roomId: roomState.roomId });
    }
  };

  const handleNextHand = () => {
    socket.emit("game:nextHand", { roomId: roomState.roomId });
  };

  const isShowdown = roomState.gameState.currentRound === "showdown";
  const potResolved = isShowdown && roomState.gameState.pot === 0;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-5xl mx-auto px-4 pt-3 flex justify-between items-start">
        
        {/* Spacer for left side (Hand # badge lives in GamePage) */}
        <div></div>

        {/* Admin Toolbar — always visible, docked top-right */}
        <div className="pointer-events-auto flex items-center gap-1.5 glass-panel px-2 py-1.5 bg-black/70 border-amber-500/20" style={{ borderRadius: '12px' }}>
          
          {/* Crown indicator */}
          <span className="text-sm mr-1" title="Admin">👑</span>

          {/* Undo Round */}
          <button
            onClick={handleUndoRound}
            disabled={roomState.gameState.roundHistory.length === 0}
            title="Undo Round"
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-white/5 transition-all active:scale-95 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
            Undo
          </button>

          {/* Undo Winner (showdown only, pot > 0 means not yet resolved OR just resolved) */}
          {isShowdown && (
            <button
              onClick={handleUndoWinner}
              title="Undo Winner Decision"
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-900/40 hover:bg-amber-800/60 text-amber-400 border border-amber-500/20 transition-all active:scale-95 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
              Undo Win
            </button>
          )}

          {/* Next Hand (showdown + pot resolved) */}
          {potResolved && (
            <button
              onClick={handleNextHand}
              title="Deal Next Hand"
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-700/60 hover:bg-emerald-600 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
              Next Hand
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 mx-0.5"></div>

          {/* Conclude */}
          <button
            onClick={handleConcludeGame}
            title="Conclude Session"
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-500/20 transition-all active:scale-95 flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            End
          </button>

        </div>
      </div>
    </div>
  );
}
