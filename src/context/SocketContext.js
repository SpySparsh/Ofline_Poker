"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { socket } from "../lib/socket";
import { v4 as uuidv4 } from "uuid";

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [playerId, setPlayerId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Use refs so the beforeunload handler always sees the latest values
  const roomStateRef = useRef(null);
  const playerIdRef = useRef("");
  const prevPlayerCountRef = useRef(0);
  const prevRoundRef = useRef("");

  // Keep refs in sync
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);
  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);

  // Explicit leave function the frontend can call
  const leaveRoom = useCallback(() => {
    if (roomStateRef.current && playerIdRef.current) {
      socket.emit("room:leave", {
        roomId: roomStateRef.current.roomId,
        playerId: playerIdRef.current,
      });
    }
    setRoomState(null);
    setIsAdmin(false);
  }, []);

  useEffect(() => {
    // Generate or retrieve persistent playerId from sessionStorage
    let id = sessionStorage.getItem("poker_playerId");
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem("poker_playerId", id);
    }
    setPlayerId(id);
    playerIdRef.current = id;

    socket.connect();

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onRoomUpdated(newRoomState) {
      // Detect new player joins for SFX
      const oldCount = prevPlayerCountRef.current;
      const newCount = newRoomState.players?.length || 0;
      if (newCount > oldCount && oldCount > 0) {
        // New player joined — play join SFX
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(523, ctx.currentTime);
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(659, ctx.currentTime);
            gain2.gain.setValueAtTime(0.25, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.2);
          }, 100);
        } catch (e) {}
      }
      prevPlayerCountRef.current = newCount;

      // Detect showdown transition for SFX
      const oldRound = prevRoundRef.current;
      const newRound = newRoomState.gameState?.currentRound || "";
      if (newRound === "showdown" && oldRound !== "showdown" && oldRound !== "") {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          function tone(freq, delay, dur, type = "square", vol = 0.15) {
            setTimeout(() => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = type;
              osc.frequency.setValueAtTime(freq, ctx.currentTime);
              gain.gain.setValueAtTime(vol, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + dur);
            }, delay);
          }
          tone(392, 0, 0.15);
          tone(523, 120, 0.15);
          tone(659, 240, 0.3, "square", 0.2);
        } catch (e) {}
      }
      prevRoundRef.current = newRound;

      setRoomState(newRoomState);
      setIsAdmin(newRoomState.adminId === playerIdRef.current);
    }

    // Emit room:leave when the tab/window is closing
    function onBeforeUnload() {
      if (roomStateRef.current && playerIdRef.current) {
        socket.emit("room:leave", {
          roomId: roomStateRef.current.roomId,
          playerId: playerIdRef.current,
        });
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:updated", onRoomUpdated);
    socket.on("game:stateUpdate", onRoomUpdated);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:updated", onRoomUpdated);
      socket.off("game:stateUpdate", onRoomUpdated);
      window.removeEventListener("beforeunload", onBeforeUnload);
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected, roomState, playerId, isAdmin, socket, leaveRoom }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
