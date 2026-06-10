"use client";

import { useState } from "react";
import { useSocket } from "@/context/SocketContext";

export default function AdminControls({ roomState }) {
  const { socket, isAdmin, dissolveRoom } = useSocket();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const handleDissolveRoom = () => {
    if (confirm("Dissolve this room for everyone?")) {
      dissolveRoom();
    }
  };

  const runMenuAction = (action) => {
    setIsMenuOpen(false);
    action();
  };

  const isShowdown = roomState.gameState.currentRound === "showdown";
  const potResolved = isShowdown && roomState.gameState.pot === 0;

  return (
    <>
      <div className="relative md:hidden">
        <button
          onClick={() => setIsMenuOpen(open => !open)}
          className="glass-panel h-9 px-2.5 bg-black/70 border-amber-500/25 text-amber-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 active:scale-95"
          title="Admin menu"
        >
          <span>Admin</span>
          <span className="text-sm leading-none">...</span>
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-11 z-50 w-44 glass-panel bg-black/95 border-amber-500/25 p-1.5 shadow-2xl">
            <button
              onClick={() => runMenuAction(handleUndoRound)}
              disabled={roomState.gameState.roundHistory.length === 0}
              className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-bold uppercase tracking-wider text-zinc-200 hover:bg-zinc-800 disabled:opacity-35 disabled:pointer-events-none"
            >
              Undo Round
            </button>
            {isShowdown && (
              <button
                onClick={() => runMenuAction(handleUndoWinner)}
                className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-950/50"
              >
                Undo Winner
              </button>
            )}
            {potResolved && (
              <button
                onClick={() => runMenuAction(handleNextHand)}
                className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-950/50"
              >
                Deal Next Hand
              </button>
            )}
            <div className="my-1 h-px bg-white/10" />
            <button
              onClick={() => runMenuAction(handleConcludeGame)}
              className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-bold uppercase tracking-wider text-red-300 hover:bg-red-950/50"
            >
              End Hand
            </button>
            <button
              onClick={() => runMenuAction(handleDissolveRoom)}
              className="w-full px-3 py-2.5 rounded-lg text-left text-xs font-bold uppercase tracking-wider text-red-200 hover:bg-red-950/60"
            >
              Dissolve Room
            </button>
          </div>
        )}
      </div>

      <div className="hidden md:flex items-center gap-1.5 glass-panel px-2 py-1.5 bg-black/70 border-amber-500/20 overflow-x-auto" style={{ borderRadius: '12px' }}>
        <span className="text-sm mr-1" title="Admin">Admin</span>

        <button
          onClick={handleUndoRound}
          disabled={roomState.gameState.roundHistory.length === 0}
          title="Undo Round"
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-white/5 transition-all active:scale-95 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-1 shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
          Undo
        </button>

        {isShowdown && (
          <button
            onClick={handleUndoWinner}
            title="Undo Winner Decision"
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-900/40 hover:bg-amber-800/60 text-amber-400 border border-amber-500/20 transition-all active:scale-95 flex items-center gap-1 shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
            Undo Win
          </button>
        )}

        {potResolved && (
          <button
            onClick={handleNextHand}
            title="Deal Next Hand"
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-700/60 hover:bg-emerald-600 text-emerald-300 border border-emerald-500/30 transition-all active:scale-95 flex items-center gap-1 shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
            Next Hand
          </button>
        )}

        <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0"></div>

        <button
          onClick={handleConcludeGame}
          title="Conclude Session"
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-500/20 transition-all active:scale-95 flex items-center gap-1 shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          End
        </button>

        <button
          onClick={handleDissolveRoom}
          title="Dissolve Room"
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-950/50 hover:bg-red-900/70 text-red-300 border border-red-500/30 transition-all active:scale-95 flex items-center gap-1 shrink-0"
        >
          Dissolve
        </button>
      </div>
    </>
  );
}
