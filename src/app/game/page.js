"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/context/SocketContext";
import PotDisplay from "@/components/PotDisplay";
import PlayerCard from "@/components/PlayerCard";
import ActionPanel from "@/components/ActionPanel";
import RoundIndicator from "@/components/RoundIndicator";
import AdminControls from "@/components/AdminControls";
import ShowdownPanel from "@/components/ShowdownPanel";
import RebuyModal from "@/components/RebuyModal";
import ExitRoomButton from "@/components/ExitRoomButton";
import { useBGM } from "@/hooks/useBGM";
import { useAudio } from "@/hooks/useAudio";

export default function GamePage() {
  const { roomState, playerId, isConnected, isAdmin, socket, isRehydratingSession } = useSocket();
  const router = useRouter();
  const [showRebuy, setShowRebuy] = useState(false);
  const { muted, toggleMute } = useAudio();
  const lastBgmKickstartRef = useRef("");

  // Synchronized BGM for the game room (Admin DJ hook)
  useBGM(muted);

  // Kickstart failsafe dispatch after room state rehydrates
  useEffect(() => {
    const bgmState = roomState?.bgmState;
    if (!bgmState?.currentTrackIndex) return;

    const audio = document.getElementById('global-bgm');
    const expectedSrc = `/soundtracks/Room${bgmState.currentTrackIndex}.mp3`;
    const bgmKey = `${bgmState.currentTrackIndex}:${bgmState.startTime}`;
    const needsKickstart = !audio?.src || !audio.src.includes(expectedSrc) || lastBgmKickstartRef.current !== bgmKey;

    if (needsKickstart) {
      lastBgmKickstartRef.current = bgmKey;
      window.dispatchEvent(new CustomEvent('bgm:kickstart', { detail: bgmState }));
    }
  }, [roomState?.bgmState]);

  useEffect(() => {
    if (isRehydratingSession) return;
    if (!isConnected || !roomState) {
      const t = setTimeout(() => {
        if (!roomState && isConnected && !isRehydratingSession) {
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
  }, [isConnected, roomState, isRehydratingSession, router]);

  if (!roomState) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse font-mono text-zinc-500">Loading Game...</div></div>;
  }

  const { gameState, players } = roomState;
  const isShowdown = gameState.currentRound === "showdown";
  const me = players.find(p => p.id === playerId);

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
  const isMyTurn = !isShowdown && myIndex !== -1 && !me?.isSittingOut && me?.inCurrentHand !== false && gameState.activePlayerIndex === myIndex;
  const tableWrapperClasses = isMyTurn
    ? "flex-1 flex flex-col items-center justify-center px-2 pt-0 pb-1 md:py-2 min-h-0"
    : "flex-1 flex flex-col items-center justify-start px-2 pt-0 pb-1 md:py-2 md:justify-center min-h-0";
  const tableSurfaceClasses = isMyTurn
    ? "relative w-full max-w-3xl flex-1 flex flex-col justify-between gap-0 min-h-0 md:min-h-[360px]"
    : "relative w-full max-w-3xl flex-1 flex flex-col justify-between gap-0 min-h-[340px] max-h-[62dvh] md:max-h-none md:min-h-[360px]";
  const actionDockClasses = isMyTurn
    ? "shrink-0 sticky md:relative bottom-0 z-40 bg-gradient-to-t from-black/95 via-black/85 to-transparent pt-1.5 md:pt-4 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:pb-4 px-2.5 md:px-3"
    : "shrink-0 relative md:relative z-40 bg-black/35 md:bg-gradient-to-t md:from-black/95 md:via-black/85 md:to-transparent pt-0.5 md:pt-4 pb-[max(0.45rem,env(safe-area-inset-bottom))] md:pb-4 px-2.5 md:px-3";

  return (
    <div className="h-dvh flex flex-col relative overflow-hidden">
      
      {/* === TOP BAR === */}
      <div className="relative z-20 flex items-start justify-between px-2 md:px-3 pt-1.5 md:pt-3 pb-0.5 md:pb-1 gap-1.5 md:gap-2 shrink-0">
        <div className="glass-panel px-2 md:px-3 py-1 bg-black/50 text-[9px] md:text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5 md:mt-1">
          Hand #{gameState.gameNumber}
        </div>
        <div className="flex items-center justify-end gap-1.5 md:gap-2 min-w-0">
          {/* === ADMIN TOOLBAR === */}
          <AdminControls roomState={roomState} />

          {!isAdmin && (
            <ExitRoomButton
              className="glass-panel h-9 md:h-auto px-2.5 md:px-3 py-1 md:py-1.5 bg-black/50 hover:bg-red-900/40 text-red-300 font-bold border border-red-500/20 transition-colors text-[9px] md:text-[10px] uppercase tracking-wider"
            >
              Exit Room
            </ExitRoomButton>
          )}
          
          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className="glass-panel h-9 md:h-auto px-2 py-1 md:py-1.5 bg-black/50 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors text-[10px] uppercase tracking-wider"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
            )}
          </button>
          
          <button 
            onClick={() => setShowRebuy(true)}
            className="glass-panel h-9 md:h-auto px-2.5 md:px-3 py-1 md:py-1.5 bg-black/50 hover:bg-emerald-900/50 text-emerald-400 font-bold border border-emerald-500/30 transition-colors text-[9px] md:text-[10px] uppercase tracking-wider flex items-center gap-1 md:gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Add Chips
          </button>
        </div>
      </div>

      {/* === MAIN TABLE AREA === */}
      <div className={tableWrapperClasses}>
        
        {/* Round Indicator */}
        <RoundIndicator currentRound={gameState.currentRound} />

        {/* Table Surface */}
        <div className={tableSurfaceClasses}>
          
          {/* Top Row Players */}
          <div className="flex justify-center items-start w-full px-6 md:px-2 pt-2 md:pt-2 gap-4 md:gap-0 md:justify-evenly">
            {topPlayers.map(p => {
              const originalIndex = players.findIndex(orig => orig.id === p.id);
              const topIndex = topPlayers.findIndex(player => player.id === p.id);
              const isLeftSeat = topPlayers.length > 1 && topIndex === 0;
              const isRightSeat = topPlayers.length > 1 && topIndex === topPlayers.length - 1;
              return (
                <div key={p.id} className={`${isLeftSeat ? "translate-y-3 md:translate-y-0" : ""} ${isRightSeat ? "translate-y-3 md:translate-y-0" : ""}`}>
                <PlayerCard 
                  player={p} 
                  isCurrentTurn={!isShowdown && gameState.activePlayerIndex === originalIndex}
                  isMe={p.id === playerId}
                />
                </div>
              );
            })}
          </div>

          {/* Center Pot */}
          <div className="flex items-center justify-center py-0 md:py-2">
            <PotDisplay potAmount={gameState.pot} />
          </div>

          {/* Bottom Row Players */}
          <div className="flex justify-center items-end w-full px-2 md:px-2 pb-1 md:pb-2 gap-4 md:gap-0 md:justify-evenly">
            {bottomPlayers.map(p => {
              const originalIndex = players.findIndex(orig => orig.id === p.id);
              const bottomIndex = bottomPlayers.findIndex(player => player.id === p.id);
              const isLeftSeat = bottomPlayers.length > 1 && bottomIndex === 0;
              const isRightSeat = bottomPlayers.length > 1 && bottomIndex === bottomPlayers.length - 1;
              return (
                <div key={p.id} className={`${isLeftSeat ? "-translate-y-3 md:translate-y-0" : ""} ${isRightSeat ? "-translate-y-3 md:translate-y-0" : ""}`}>
                <PlayerCard 
                  player={p} 
                  isCurrentTurn={!isShowdown && gameState.activePlayerIndex === originalIndex}
                  isMe={p.id === playerId}
                />
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* === BOTTOM ACTION SHEET === */}
      <div className={actionDockClasses}>
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
