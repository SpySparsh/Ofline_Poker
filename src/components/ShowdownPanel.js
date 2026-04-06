"use client";

import { useSocket } from "@/context/SocketContext";

export default function ShowdownPanel({ roomState }) {
  const { socket, playerId, isAdmin } = useSocket();
  const me = roomState?.players.find(p => p.id === playerId);
  
  if (!me || roomState?.gameState.currentRound !== "showdown") return null;

  const handleVote = (vote) => {
      socket.emit("game:showdownVote", { roomId: roomState.roomId, playerId, vote });
  };

  const handleNextHand = () => {
      socket.emit("game:nextHand", { roomId: roomState.roomId });
  };

  const isFolded = me.status === "folded";
  const myVote = roomState.gameState.showdownVotes.find(v => v.playerId === playerId)?.vote;
  
  // Has everyone voted? (Backend handles resolution when consensus is reached, but while waiting or if resolved)
  // Wait, if it resolved, pot might be 0, and we are just waiting for Next Hand.
  const pot = roomState.gameState.pot;
  const isResolved = pot === 0;

  if (isResolved) {
     return (
        <div className="glass-panel p-8 w-full max-w-2xl mx-auto flex flex-col items-center justify-center bg-black/90 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)] text-center animate-pop">
            <h2 className="text-3xl font-bold tracking-widest text-emerald-400 mb-2">HAND COMPLETE</h2>
            <p className="text-zinc-400 mb-8">Awaiting dealer for next hand...</p>

            {isAdmin && (
               <button onClick={handleNextHand} className="btn-primary w-full max-w-xs text-xl py-4">
                  DEAL NEXT HAND
               </button>
            )}
        </div>
     );
  }

  if (isFolded) {
     return (
        <div className="glass-panel p-6 w-full max-w-2xl mx-auto flex items-center justify-center h-32 bg-black/80 animate-pop">
            <div className="text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-3">
               <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
               Showdown underway...
            </div>
        </div>
     );
  }

  return (
    <div className="glass-panel p-6 w-full max-w-2xl mx-auto bg-black/90 border-gold shadow-[0_0_20px_rgba(245,158,11,0.1)] animate-pop">
       <h2 className="text-2xl font-bold tracking-widest text-center text-gold mb-6 uppercase">Showdown</h2>
       <div className="text-center text-zinc-400 text-sm mb-6">Tap the result of your physical hand below.</div>
       
       {myVote ? (
          <div className="flex flex-col items-center justify-center py-6">
             <div className="text-xl font-bold text-white mb-2">Vote Recorded: {myVote}</div>
             <div className="text-sm text-zinc-500 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Waiting for other players...
             </div>
          </div>
       ) : (
          <div className="flex flex-col sm:flex-row gap-4">
             <button 
                onClick={() => handleVote("WON")}
                className="flex-1 py-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-bold text-2xl tracking-widest uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
             >
                I Won
             </button>
             <button 
                onClick={() => handleVote("LOST")}
                className="flex-1 py-8 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-600 text-zinc-300 font-bold text-2xl tracking-widest uppercase hover:text-white active:scale-95 transition-all"
             >
                I Lost
             </button>
          </div>
       )}
    </div>
  );
}
