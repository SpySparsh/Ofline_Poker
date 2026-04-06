"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/context/SocketContext";

export default function StatsPage() {
  const { roomState, playerId, isConnected } = useSocket();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected || !roomState) {
        const t = setTimeout(() => {
            if (!roomState && isConnected) {
                router.push("/");
            }
        }, 2000);
        return () => clearTimeout(t);
    }
  }, [isConnected, roomState, router]);

  if (!roomState) {
     return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse">Loading Stats...</div></div>;
  }

  // Calculate stats
  // P&L = current stack - total bought in
  const playerStats = roomState.players.map(p => {
     const totalIn = p.totalBoughtIn || 0;
     const current = p.stack;
     const pl = current - totalIn;
     return {
         ...p,
         totalIn,
         current,
         pl
     };
  }).sort((a, b) => b.pl - a.pl); // Best P&L first

  const myStatIndex = playerStats.findIndex(p => p.id === playerId);

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto py-12 flex flex-col">
       
       <div className="text-center mb-12 animate-pop">
           <h1 className="text-4xl font-bold tracking-widest text-white uppercase mb-2">Session Concluded</h1>
           <p className="text-zinc-500 font-mono">Final Leaderboard</p>
       </div>

       <div className="space-y-4 mb-12">
          {playerStats.map((p, idx) => {
             const isMe = p.id === playerId;
             const isPositive = p.pl > 0;
             const isZero = p.pl === 0;

             return (
                 <div 
                    key={p.id}
                    className={`glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-transform hover:scale-[1.02] ${isMe ? 'border-emerald-500/50 bg-emerald-900/10' : ''}`}
                    style={{ animationDelay: `${idx * 0.1}s` }}
                 >
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-500 border border-white/10">
                          {idx + 1}
                       </div>
                       <div>
                          <div className="font-bold text-xl text-white">
                             {p.name} {isMe && <span className="text-emerald-500 text-sm ml-2">(You)</span>}
                          </div>
                          <div className="text-sm text-zinc-500 font-mono mt-1">
                             Bought In: {p.totalIn.toLocaleString()}
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-8 md:justify-end">
                       <div className="text-right">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-bold">Cash Out</div>
                          <div className="text-xl font-mono text-zinc-300 font-bold">{p.current.toLocaleString()}</div>
                       </div>
                       <div className="w-px h-10 bg-white/10 hidden md:block"></div>
                       <div className="text-right min-w-[100px]">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-bold">Net Profit</div>
                          <div className={`text-2xl font-mono font-bold ${isPositive ? 'text-emerald-400' : isZero ? 'text-zinc-400' : 'text-red-400'}`}>
                             {isPositive ? '+' : ''}{p.pl.toLocaleString()}
                          </div>
                       </div>
                    </div>
                 </div>
             );
          })}
       </div>

       <div className="text-center mt-auto">
          <button 
             onClick={() => router.push("/")}
             className="btn-secondary w-full max-w-sm mx-auto"
          >
             Return to Home
          </button>
       </div>

    </div>
  );
}
