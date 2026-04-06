"use client";

import { MiniChipStack } from "@/components/ChipIcon";

export default function PlayerCard({ player, isCurrentTurn, isMe }) {
  const isFolded = player.status === "folded";
  const isAllIn = player.stack === 0 && player.status === "active";
  
  let ringClasses = "border-white/10";
  if (isCurrentTurn) {
    ringClasses = "animate-turn-glow border-amber-400 bg-amber-950/20";
  } else if (isFolded) {
    ringClasses = "opacity-35 border-dashed border-zinc-700 bg-black/20 text-zinc-600";
  } else if (isAllIn) {
    ringClasses = "border-red-500/50 shadow-[0_0_12px_rgba(220,38,38,0.25)]";
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* Dealer Button */}
      {player.isDealer && (
        <div className="absolute -top-2 -right-2 z-20 w-6 h-6 md:w-7 md:h-7 bg-zinc-100 text-black font-bold font-serif flex items-center justify-center rounded-full border-2 border-zinc-400 shadow-lg text-xs md:text-sm">
          D
        </div>
      )}

      {/* Contribution — Mini Chip Stack */}
      {player.currentRoundContribution > 0 && (
        <div className="absolute -top-9 md:-top-10 z-10 glass-panel px-2 py-1 bg-zinc-900/90 border-zinc-700 shadow-lg flex items-center gap-1.5 animate-pop">
          <MiniChipStack amount={player.currentRoundContribution} />
          <span className="font-mono text-[10px] text-zinc-300 font-bold ml-0.5">
            {player.currentRoundContribution.toLocaleString()}
          </span>
        </div>
      )}

      {/* Main Card — mobile-compact */}
      <div className={`w-20 md:w-28 glass-panel p-2 md:p-3 border-2 transition-all duration-300 ${ringClasses} ${isMe ? 'ring-2 ring-emerald-500/40 ring-offset-1 ring-offset-[#091812]' : ''}`}>
        
        <div className="text-center truncate font-bold text-[11px] md:text-sm mb-1 text-zinc-100 leading-tight" title={player.name}>
          {player.name}
          {isMe && <span className="text-emerald-500 ml-0.5 text-[9px] md:text-[10px]">(You)</span>}
        </div>
        
        <div className="flex flex-col items-center justify-center text-center">
          {!isFolded ? (
            <>
              <div className={`font-mono font-bold text-sm md:text-base leading-tight ${isAllIn ? 'text-red-400' : 'text-zinc-200'}`}>
                {isAllIn ? "ALL-IN" : player.stack.toLocaleString()}
              </div>
            </>
          ) : (
            <div className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase text-zinc-600">Folded</div>
          )}
        </div>
      </div>
    </div>
  );
}
