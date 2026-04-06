"use client";

import { useSocket } from "@/context/SocketContext";

export default function SettingsPanel({ roomState }) {
  const { socket, isAdmin } = useSocket();

  if (!isAdmin || !roomState) return null;

  const settings = roomState.settings;

  const handleChange = (key, value) => {
    socket.emit("room:settings", {
      roomId: roomState.roomId,
      settings: { ...settings, [key]: value }
    });
  };

  return (
    <div className="glass-panel p-6 mt-6 animate-pop" style={{ animationDelay: "0.2s" }}>
      <h3 className="text-xl font-bold mb-6 text-emerald-400">House Rules</h3>
      
      <div className="space-y-6">
        {/* Blind Mode */}
        <div>
          <label className="block text-sm text-zinc-400 mb-3 uppercase tracking-wider font-semibold">Structure</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleChange("blindMode", "standard")}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                settings.blindMode === "standard" 
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50" 
                  : "bg-black/50 text-zinc-500 border border-white/5 hover:border-white/10"
              }`}
            >
              Standard Blinds
            </button>
            <button
              onClick={() => handleChange("blindMode", "ante_all")}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                settings.blindMode === "ante_all" 
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50" 
                  : "bg-black/50 text-zinc-500 border border-white/5 hover:border-white/10"
              }`}
            >
              Ante All
            </button>
          </div>
        </div>

        {/* Amounts */}
        {settings.blindMode === "standard" ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Small Blind</label>
              <input 
                type="number" 
                value={settings.smallBlind}
                onChange={(e) => handleChange("smallBlind", parseInt(e.target.value) || 0)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 font-mono text-center focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Big Blind</label>
              <input 
                type="number" 
                value={settings.bigBlind}
                onChange={(e) => handleChange("bigBlind", parseInt(e.target.value) || 0)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 font-mono text-center focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Ante Amount</label>
            <input 
              type="number" 
              value={settings.ante}
              onChange={(e) => handleChange("ante", parseInt(e.target.value) || 0)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 font-mono text-center focus:border-emerald-500 focus:outline-none"
            />
          </div>
        )}

        {/* Sequence Mode */}
        <div>
           <label className="block text-sm text-zinc-400 mb-3 uppercase tracking-wider font-semibold mt-6">Sequence Mode</label>
           <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleChange("sequenceMode", "standard")}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                settings.sequenceMode === "standard" 
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50" 
                  : "bg-black/50 text-zinc-500 border border-white/5 hover:border-white/10"
              }`}
            >
              Standard Rotate
            </button>
            <button
              onClick={() => handleChange("sequenceMode", "winner_curse")}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                settings.sequenceMode === "winner_curse" 
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50" 
                  : "bg-black/50 text-zinc-500 border border-white/5 hover:border-white/10"
              }`}
            >
              Winner's Curse
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
