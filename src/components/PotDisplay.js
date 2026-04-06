"use client";

import { useEffect, useState } from "react";

export default function PotDisplay({ potAmount }) {
  const [displayAmount, setDisplayAmount] = useState(potAmount);
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (potAmount !== displayAmount) {
      setIsPulsing(true);
      // Optional: Animate counter here if desired. Simple immediate jump for now.
      setDisplayAmount(potAmount);
      
      const t = setTimeout(() => setIsPulsing(false), 500);
      return () => clearTimeout(t);
    }
  }, [potAmount, displayAmount]);

  return (
    <div className={`flex flex-col items-center justify-center transition-transform ${isPulsing ? 'scale-110' : 'scale-100'}`}>
       <div className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-2">Total Pot</div>
       <div className="glass-panel px-8 py-4 flex items-center gap-4 bg-black/60 shadow-[0_10px_30px_rgba(16,185,129,0.15)] border-emerald-900/30">
          <div className="text-emerald-500">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                {/* Chip Icon */}
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
             </svg>
          </div>
          <div className="text-5xl font-mono font-bold text-white tracking-widest drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
             {displayAmount.toLocaleString()}
          </div>
       </div>
    </div>
  );
}
