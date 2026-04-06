"use client";

import { useState } from "react";
import { useSocket } from "@/context/SocketContext";

export default function RebuyModal({ roomId, onClose }) {
  const { socket, playerId } = useSocket();
  const [amount, setAmount] = useState(10000);
  const [custom, setCustom] = useState("");

  const handleAdd = () => {
    let finalAmount = amount;
    if (custom) {
      finalAmount = parseInt(custom);
      if (isNaN(finalAmount) || finalAmount <= 0) return;
    }
    socket.emit("game:rebuy", { roomId, playerId, amount: finalAmount });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-pop">
        <div className="glass-panel w-full max-w-md p-6 bg-zinc-900 border-emerald-500/30">
            <h2 className="text-xl font-bold mb-6 text-zinc-100 flex items-center justify-between">
                Add Chips
                <button onClick={onClose} className="text-zinc-500 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </h2>

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
                    +{val.toLocaleString()}
                </button>
                ))}
            </div>
            
            <div className="mb-6">
                <label className="block text-xs text-zinc-500 mb-2 px-1">Custom Amount</label>
                <input 
                    type="number"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Enter amount..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 font-mono text-lg focus:border-emerald-500 focus:outline-none transition-colors"
                />
            </div>

            <button 
                onClick={handleAdd}
                className="w-full btn-primary text-lg"
            >
                Confirm Add
            </button>
        </div>
    </div>
  );
}
