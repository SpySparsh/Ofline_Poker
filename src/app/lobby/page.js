"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSocket } from "@/context/SocketContext";
import PlayerList from "@/components/PlayerList";
import SettingsPanel from "@/components/SettingsPanel";
import BuyInSelector from "@/components/BuyInSelector";

import { Suspense } from "react";

function LobbyContent() {
  const { roomState, isAdmin, isConnected, socket, playerId } = useSocket();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("room");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    if (!roomState && roomCode) {
       // Need to join? In theory landing page handles joining.
       // But if they refresh on this page, SocketContext logic tries to rejoin if roomState exists.
       // If not, we might redirect to home.
       
       // Wait a beat to let Context try re-establishing if possible
       const t = setTimeout(() => {
           if (!roomState && isConnected) {
               router.push("/");
           }
       }, 2000);
       return () => clearTimeout(t);
    }
  }, [isConnected, roomState, roomCode, router]);

  useEffect(() => {
     if (roomState && roomState.roomStatus === "playing") {
         router.push("/game");
     }
  }, [roomState, router]);

  if (!roomState) {
     return (
        <div className="min-h-screen flex items-center justify-center">
           <div className="animate-pulse text-zinc-500 font-mono">Loading Lobby...</div>
        </div>
     );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(roomState.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    if (!isAdmin) return;
    socket.emit("game:start", { roomId: roomState.roomId });
  };

  const allReady = roomState.players.length >= 2 && roomState.players.every(p => p.stack > 0);
  const myPlayer = roomState.players.find(p => p.id === playerId);
  const myBuyInLocked = myPlayer && myPlayer.stack > 0;

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col max-w-5xl mx-auto pb-32">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 animate-pop">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mb-2">Room Lobby</h1>
            <p className="text-zinc-500 text-sm">Wait for players to join and lock in their buy-in.</p>
         </div>

         {/* Room Code Pill */}
         <button 
           onClick={handleCopy}
           className="relative group glass-panel flex items-center gap-4 px-6 py-3 border-emerald-500/20 hover:border-emerald-500/50 transition-colors"
         >
            <div className="flex flex-col text-left">
               <span className="text-[10px] uppercase text-emerald-500 font-bold tracking-widest">Room Code</span>
               <span className="text-3xl font-mono tracking-widest text-white">{roomState.roomId}</span>
            </div>
            <div className="pl-4 border-l border-white/10 text-emerald-400">
               {copied ? (
                 <svg className="w-6 h-6 animate-pop" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
               ) : (
                 <svg className="w-6 h-6 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
               )}
            </div>
         </button>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            {/* Player List wrapper */}
            <div>
               <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-zinc-100">Seating Arrangement</h2>
                  {isAdmin && <span className="text-xs text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">Drag to reorder</span>}
               </div>
               <PlayerList roomState={roomState} />
            </div>

            <BuyInSelector 
               roomId={roomState.roomId} 
               isLocked={myBuyInLocked} 
            />
         </div>

         <div className="lg:col-span-1">
            <SettingsPanel roomState={roomState} />
         </div>
      </div>

      {/* Admin Start Bar */}
      {isAdmin && (
         <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-xl border-t border-white/10 flex flex-col items-center justify-center z-50">
            <button 
               onClick={handleStartGame}
               disabled={!allReady}
               className="btn-primary w-full max-w-md text-xl py-4 flex items-center justify-center gap-3 relative overflow-hidden group"
            >
               {allReady ? (
                 <>
                   <span className="relative z-10 font-bold tracking-wider">DEAL CARDS</span>
                   <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                 </>
               ) : (
                 "Waiting for Players..."
               )}
            </button>
            {!allReady && (
               <p className="text-red-400 text-xs mt-3 text-center">
                  All joined players must have a locked-in stack to begin, minimum 2 players.
               </p>
            )}
         </div>
      )}
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-zinc-500 font-mono">Loading Lobby...</div>
       </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}
