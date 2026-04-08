"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/context/SocketContext";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const { socket, isConnected, playerId } = useSocket();
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Home page BGM — local loop
  const bgmRef = useRef(null);
  const [bgmStarted, setBgmStarted] = useState(false);

  useEffect(() => {
    bgmRef.current = new Audio("/soundtracks/home_page.mp3");
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.25;

    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.src = "";
        bgmRef.current = null;
      }
    };
  }, []);

  // Start BGM on first user interaction (autoplay policy)
  const startBgm = () => {
    if (!bgmStarted && bgmRef.current) {
      bgmRef.current.play().catch(() => {});
      setBgmStarted(true);
    }
  };

  const handleCreateRoom = () => {
    startBgm();
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!isConnected) {
      setError("Not connected to server. Please wait.");
      return;
    }
    
    setIsLoading(true);
    // Stop home BGM before navigating
    if (bgmRef.current) bgmRef.current.pause();
    socket.emit("room:create", { adminId: playerId, adminName: name.trim() }, (res) => {
      setIsLoading(false);
      if (res.success) {
        const playCreateSound = () => {
          const audio = new Audio('/soundtracks/room_create.mp3');
          audio.play().catch(e => console.warn('UI Sound blocked', e));
        };
        playCreateSound();
        router.push(`/lobby?room=${res.room.roomId}`);
      } else {
        setError("Failed to create room.");
        if (bgmRef.current) bgmRef.current.play().catch(() => {});
      }
    });
  };

  const handleJoinRoom = () => {
    startBgm();
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!joinCode.trim() || joinCode.length !== 4) {
      setError("Please enter a valid 4-digit room code");
      return;
    }
    if (!isConnected) {
      setError("Not connected to server. Please wait.");
      return;
    }

    setIsLoading(true);
    if (bgmRef.current) bgmRef.current.pause();
    socket.emit("room:join", { roomId: joinCode.trim(), playerId, playerName: name.trim() }, (res) => {
      setIsLoading(false);
      if (res.success) {
        router.push(`/lobby?room=${res.room.roomId}`);
      } else {
        setError(res.message || "Failed to join room.");
        if (bgmRef.current) bgmRef.current.play().catch(() => {});
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" onClick={startBgm}>
      <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-white/50">
        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}></div>
        {isConnected ? "Connected" : "Connecting..."}
      </div>

      <div className="text-center mb-12 animate-pop">
        <h1 className="text-6xl font-bold mb-4 tracking-tighter text-emerald-400 drop-shadow-lg">
           POKER<span className="text-zinc-100">ENGINE</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto">
          Real-time digital ledger for in-person Texas Hold&apos;em. No cards, just pure chip management.
        </p>
      </div>

      <div className="glass-panel p-8 w-full max-w-md animate-pop" style={{ animationDelay: "0.1s" }}>
        
        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Your Name</label>
          <input
            type="text"
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="e.g. Doyle Brunson"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onFocus={startBgm}
            maxLength={20}
          />
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={handleCreateRoom}
            disabled={isLoading || !isConnected}
            className="w-full btn-primary text-lg"
          >
            Create New Room
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-500 text-sm">or</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="w-full sm:flex-grow bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-lg font-mono text-center tracking-widest focus:outline-none focus:border-zinc-500 transition-colors"
              placeholder="CODE"
              maxLength={4}
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
              onFocus={startBgm}
            />
            <button 
              onClick={handleJoinRoom}
              disabled={isLoading || !isConnected || joinCode.length !== 4}
              className="w-full sm:w-auto btn-secondary px-8 whitespace-nowrap"
            >
              Join Room
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
