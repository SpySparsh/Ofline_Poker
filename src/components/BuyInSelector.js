"use client";

import { useState } from "react";
import { useSocket } from "@/context/SocketContext";

export default function BuyInSelector({ roomId, isLocked, onLock }) {
  const { socket, playerId } = useSocket();
  const [amount, setAmount] = useState(10000);
  const [custom, setCustom] = useState("");

  const handleLock = () => {
    let finalAmount = amount;
    if (custom) {
      finalAmount = parseInt(custom);
      if (isNaN(finalAmount) || finalAmount <= 0) return;
    }
    
    // Trigger lock in UI sound
    const playLockSound = () => {
      const audio = new Audio('/soundtracks/lock_in.mp3');
      audio.play().catch(e => console.warn('UI Sound blocked', e));
    };
    playLockSound();
    
    // Attempt to unlock background music natively on this user interaction click
    const globalAudio = document.getElementById('global-bgm');
    if (globalAudio) {
      globalAudio.play().catch(e => console.warn('Audio unlock delayed.', e));
    }
    
    socket.emit("player:buyIn", { roomId, playerId, amount: finalAmount });
    if (onLock) onLock();
  };

  if (isLocked) {
     return (
        <div className="glass-panel p-6 mt-6 border-emerald-500/30 bg-emerald-900/10 text-center animate-pop">
           <div className="text-emerald-400 font-bold mb-2">Buy-In Locked</div>
           <div className="text-3xl font-mono text-white">
              {custom ? custom : amount.toLocaleString()}
           </div>
        </div>
     );
  }

  return (
    <div className="glass-panel p-6 mt-6 animate-pop" style={{ animationDelay: "0.3s" }}>
      <h3 className="text-xl font-bold mb-6 text-zinc-100">Select Starting Stack</h3>
      
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[5000, 10000, 20000].map(val => (
           <button
             key={val}
             onClick={() => { setAmount(val); setCustom(""); }}
             className={`py-3 rounded-xl font-mono font-bold transition-all ${
               amount === val && !custom
                 ? "bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)] text-white scale-105"
                 : "bg-black/50 text-zinc-400 hover:bg-zinc-800"
             }`}
           >
             {val.toLocaleString()}
           </button>
        ))}
      </div>
      
      <div className="mb-6">
        <label className="block text-xs text-zinc-500 mb-2 px-1">Custom Amount</label>
        <input 
          type="number"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Enter custom stack..."
          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 font-mono text-lg focus:border-zinc-500 focus:outline-none transition-colors"
        />
      </div>

      <button 
        onClick={handleLock}
        className="w-full btn-primary text-lg flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        Lock In
      </button>
    </div>
  );
}
