"use client";

import { useState } from "react";
import { useSocket } from "@/context/SocketContext";

export default function ExitRoomButton({ className, children = "Exit Room" }) {
  const { leaveRoom } = useSocket();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirmExit = () => {
    setIsConfirming(false);
    leaveRoom();
  };

  return (
    <>
      <button onClick={() => setIsConfirming(true)} className={className}>
        {children}
      </button>

      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-pop">
          <div className="glass-panel w-full max-w-md p-6 bg-zinc-900 border-red-500/30 text-center">
            <h2 className="text-xl font-bold mb-3 text-zinc-100">Leave Room?</h2>
            <p className="text-zinc-400 mb-6">Are you sure you want to leave the room?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setIsConfirming(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExit}
                className="flex-1 px-4 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold transition-colors"
              >
                Confirm Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
