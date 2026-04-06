"use client";

import { useState } from "react";
import { useSocket } from "@/context/SocketContext";

export default function PlayerList({ roomState }) {
  const { socket, isAdmin } = useSocket();
  const [draggedIdx, setDraggedIdx] = useState(null);

  if (!roomState || !roomState.players) return null;

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    // Provide a neat drag image if desired, otherwise default is fine
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (!isAdmin || draggedIdx === null || draggedIdx === index) return;

    const newPlayers = [...roomState.players];
    const draggedPlayer = newPlayers[draggedIdx];
    
    // Remove element at draggedIdx
    newPlayers.splice(draggedIdx, 1);
    // Insert at drop index
    newPlayers.splice(index, 0, draggedPlayer);

    socket.emit("room:reorder", {
      roomId: roomState.roomId,
      newPlayersOrder: newPlayers
    });
    
    setDraggedIdx(null);
  };

  return (
    <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
      <div className="flex gap-4 px-2" style={{ minWidth: "max-content" }}>
        {roomState.players.map((player, idx) => {
          const isBoughtIn = player.stack > 0;
          
          return (
            <div 
              key={player.id}
              draggable={isAdmin}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              className={`relative glass-panel w-48 p-4 shrink-0 transition-transform ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:scale-105' : ''} ${draggedIdx === idx ? 'opacity-50' : 'opacity-100'}`}
            >
              {/* Position Badge */}
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center font-mono text-sm font-bold text-zinc-400 shadow-lg">
                {idx + 1}
              </div>
              
              {/* Admin Crown */}
              {player.id === roomState.adminId && (
                <div className="absolute -top-2 -right-2 text-gold animate-pulse text-xl" title="Room Admin">
                  👑
                </div>
              )}

              <div className="text-center mt-2">
                <div className="font-bold text-lg truncate mb-1" title={player.name}>{player.name}</div>
                
                {isBoughtIn ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    READY
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    WAITING
                  </div>
                )}
                
                {/* Chip display if bought in */}
                {isBoughtIn && (
                  <div className="mt-3 font-mono text-sm text-zinc-300">
                     {player.stack.toLocaleString()} chips
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
