"use client";

import { useState } from "react";
import { useSocket } from "@/context/SocketContext";

export default function RebuyModal({ roomId, player, roomStatus, currentRound, onClose }) {
  const { socket, playerId } = useSocket();
  const [adjustment, setAdjustment] = useState(0);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStack = player?.stack || 0;
  const pendingAdjustment = player?.pendingChipAdjustment || 0;
  const isCurrentHandParticipant =
    roomStatus === "playing" &&
    currentRound !== "showdown" &&
    player?.inCurrentHand !== false &&
    !player?.isSittingOut;
  const baseStack = isCurrentHandParticipant ? currentStack + pendingAdjustment : currentStack;
  const projectedStack = baseStack + adjustment;
  const isInvalid = adjustment === 0 || projectedStack < 0 || !Number.isSafeInteger(adjustment);

  const setDelta = (value) => {
    setError("");
    setCustom("");
    setAdjustment(value);
  };

  const nudge = (amount) => {
    setError("");
    setCustom("");
    setAdjustment(prev => prev + amount);
  };

  const handleCustomChange = (value) => {
    setCustom(value);
    setError("");
    if (value === "" || value === "-") {
      setAdjustment(0);
      return;
    }
    const nextAdjustment = Number(value);
    if (Number.isFinite(nextAdjustment)) {
      setAdjustment(Math.trunc(nextAdjustment));
    }
  };

  const handleConfirm = () => {
    if (isInvalid) {
      setError(projectedStack < 0 ? "Stack cannot go below 0." : "Enter a non-zero whole-number adjustment.");
      return;
    }

    setIsSubmitting(true);
    socket.emit("game:rebuy", { roomId, playerId, amount: adjustment }, (res) => {
      setIsSubmitting(false);
      if (!res?.success) {
        setError(res?.message || "Chip adjustment failed.");
        return;
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-pop">
        <div className="glass-panel w-full max-w-md p-6 bg-zinc-900 border-emerald-500/30">
            <h2 className="text-xl font-bold mb-6 text-zinc-100 flex items-center justify-between">
                Adjust Chips
                <button onClick={onClose} className="text-zinc-500 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-black/40 rounded-xl border border-white/10 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Current Stack</div>
                    <div className="font-mono text-xl font-bold text-zinc-100">{currentStack.toLocaleString()}</div>
                </div>
                <div className="bg-black/40 rounded-xl border border-white/10 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">After Adjustment</div>
                    <div className={`font-mono text-xl font-bold ${projectedStack < 0 ? "text-red-400" : "text-emerald-300"}`}>
                        {Math.max(0, projectedStack).toLocaleString()}
                    </div>
                </div>
            </div>

            {pendingAdjustment !== 0 && (
                <div className="mb-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                    Pending next hand adjustment: {pendingAdjustment > 0 ? "+" : ""}{pendingAdjustment.toLocaleString()}
                </div>
            )}

            {isCurrentHandParticipant && (
                <div className="mb-4 text-xs text-zinc-400 bg-black/30 border border-white/10 rounded-xl px-3 py-2">
                    This player is locked into the current hand, so this adjustment will apply when the next hand starts.
                </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-4">
                {[-5000, -1000, -100, 100, 1000, 5000].map(val => (
                    <button
                        key={val}
                        onClick={() => nudge(val)}
                        className={`py-3 rounded-xl font-mono font-bold transition-all ${
                            val > 0
                                ? "bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60"
                                : "bg-red-950/40 text-red-300 hover:bg-red-900/50"
                        }`}
                    >
                        {val > 0 ? "+" : ""}{val.toLocaleString()}
                    </button>
                ))}
            </div>

            <div className="mb-4">
                <label className="block text-xs text-zinc-500 mb-2 px-1">Adjustment Amount</label>
                <input 
                    type="number"
                    value={custom}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    placeholder="Use + or - amount..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 font-mono text-lg focus:border-emerald-500 focus:outline-none transition-colors"
                />
            </div>

            <div className="flex items-center justify-between mb-5 bg-black/30 rounded-xl px-4 py-3 border border-white/10">
                <span className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Net Change</span>
                <span className={`font-mono text-lg font-bold ${adjustment < 0 ? "text-red-300" : adjustment > 0 ? "text-emerald-300" : "text-zinc-500"}`}>
                    {adjustment > 0 ? "+" : ""}{adjustment.toLocaleString()}
                </span>
            </div>

            {error && (
                <div className="mb-4 text-sm text-red-300 bg-red-950/30 border border-red-500/20 rounded-xl px-3 py-2">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => setDelta(0)}
                    className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold uppercase tracking-wider text-xs transition-colors"
                >
                    Reset
                </button>
                <button 
                    onClick={handleConfirm}
                    disabled={isInvalid || isSubmitting}
                    className="w-full btn-primary text-sm disabled:opacity-45 disabled:saturate-50 disabled:pointer-events-none"
                >
                    {isSubmitting ? "Applying..." : "Confirm"}
                </button>
            </div>
        </div>
    </div>
  );
}
