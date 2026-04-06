"use client";

export default function RoundIndicator({ currentRound }) {
  const rounds = [
    { id: "pre-flop", label: "Pre-Flop" },
    { id: "flop", label: "The Flop" },
    { id: "turn", label: "The Turn" },
    { id: "river", label: "The River" }
  ];

  let passed = true;

  if (currentRound === "showdown") return null;

  return (
    <div className="flex items-center justify-center mb-8">
      <div className="glass-panel flex p-2 gap-1 overflow-hidden" style={{ borderRadius: '99px' }}>
        {rounds.map((r, i) => {
          const isActive = r.id === currentRound;
          if (isActive) passed = false;
          
          let stateClass = "text-zinc-500 bg-transparent";
          if (isActive) {
             stateClass = "bg-emerald-500 text-white font-bold shadow-[0_0_10px_rgba(16,185,129,0.5)]";
          } else if (passed) {
             stateClass = "text-zinc-300";
          }

          return (
            <div 
              key={r.id} 
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider transition-all duration-300 ${stateClass}`}
            >
              {r.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
