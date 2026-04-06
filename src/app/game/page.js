"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/context/SocketContext";
import PotDisplay from "@/components/PotDisplay";
import PlayerCard from "@/components/PlayerCard";
import ActionPanel from "@/components/ActionPanel";
import RoundIndicator from "@/components/RoundIndicator";
import AdminControls from "@/components/AdminControls";
import ShowdownPanel from "@/components/ShowdownPanel";
import RebuyModal from "@/components/RebuyModal";

export default function GamePage() {
  const { roomState, playerId, isConnected, isAdmin } = useSocket();
  const router = useRouter();
  const [showRebuy, setShowRebuy] = useState(false);

  useEffect(() => {
    if (!isConnected || !roomState) {
      const t = setTimeout(() => {
        if (!roomState && isConnected) {
          router.push("/");
        }
      }, 2000);
      return () => clearTimeout(t);
    }
    
    if (roomState && roomState.roomStatus === "stats") {
      router.push("/stats");
    }
    if (roomState && roomState.roomStatus === "lobby") {
      router.push(`/lobby?room=${roomState.roomId}`);
    }
  }, [isConnected, roomState, router]);

  if (!roomState) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse font-mono text-zinc-500">Loading Game...</div></div>;
  }

  const { gameState, players } = roomState;
  const isShowdown = gameState.currentRound === "showdown";

  // Re-order players so current player is always at the bottom center
  const myIndex = players.findIndex(p => p.id === playerId);
  const displayPlayers = [...players];
  if (myIndex !== -1) {
    const topPart = displayPlayers.splice(myIndex + 1);
    displayPlayers.unshift(...topPart);
  }

  // Split into top row and bottom row
  const topPlayers = displayPlayers.slice(0, Math.floor(displayPlayers.length / 2));
  const bottomPlayers = displayPlayers.slice(Math.floor(displayPlayers.length / 2));

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden">
      
      {/* === TOP BAR (non-admin) === */}
      <div className="relative z-20 flex items-center justify-between px-3 pt-3 pb-1">
        <div className="glass-panel px-3 py-1.5 bg-black/50 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
          Hand #{gameState.gameNumber}
        </div>
        <button 
          onClick={() => setShowRebuy(true)}
          className={`glass-panel px-3 py-1.5 bg-black/50 hover:bg-emerald-900/50 text-emerald-400 font-bold border border-emerald-500/30 transition-colors text-[10px] uppercase tracking-wider flex items-center gap-1.5 ${isAdmin ? 'mr-0' : ''}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Add Chips
        </button>
      </div>

      {/* === ADMIN TOOLBAR — sits right below top bar when admin === */}
      <AdminControls roomState={roomState} />

      {/* === MAIN TABLE AREA === */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 py-2 min-h-0">
        
        {/* Round Indicator */}
        <RoundIndicator currentRound={gameState.currentRound} />

        {/* Table Surface */}
        <div className="relative w-full max-w-3xl flex-1 flex flex-col justify-between min-h-[240px] md:min-h-[360px]">
          
          {/* Top Row Players */}
          <div className="flex justify-evenly items-start w-full px-2 pt-2">
            {topPlayers.map(p => {
              const originalIndex = players.findIndex(orig => orig.id === p.id);
              return (
                <PlayerCard 
                  key={p.id}
                  player={p} 
                  isCurrentTurn={!isShowdown && gameState.activePlayerIndex === originalIndex}
                  isMe={p.id === playerId}
                />
              );
            })}
          </div>

          {/* Center Pot */}
          <div className="flex items-center justify-center py-2">
            <PotDisplay potAmount={gameState.pot} />
          </div>

          {/* Bottom Row Players */}
          <div className="flex justify-evenly items-end w-full px-2 pb-2">
            {bottomPlayers.map(p => {
              const originalIndex = players.findIndex(orig => orig.id === p.id);
              return (
                <PlayerCard 
                  key={p.id}
                  player={p} 
                  isCurrentTurn={!isShowdown && gameState.activePlayerIndex === originalIndex}
                  isMe={p.id === playerId}
                />
              );
            })}
          </div>

        </div>
      </div>

      {/* === BOTTOM ACTION SHEET === */}
      <div className="relative z-40 bg-gradient-to-t from-black/95 via-black/80 to-transparent pt-4 pb-4 px-3">
        {isShowdown ? (
          <ShowdownPanel roomState={roomState} />
        ) : (
          <ActionPanel roomState={roomState} />
        )}
      </div>

      {/* Modals */}
      {showRebuy && <RebuyModal roomId={roomState.roomId} onClose={() => setShowRebuy(false)} />}
    </div>
  );
}
