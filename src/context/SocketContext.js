"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { socket } from "../lib/socket";
import { v4 as uuidv4 } from "uuid";

const SocketContext = createContext();
const ROOM_CODE_KEY = "roomCode";
const PLAYER_ID_KEY = "playerId";
const PLAYER_NAME_KEY = "playerName";

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [playerId, setPlayerId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRehydratingSession, setIsRehydratingSession] = useState(true);
  
  // Use refs so socket callbacks always see the latest values
  const roomStateRef = useRef(null);
  const playerIdRef = useRef("");
  const reconnectInFlightRef = useRef(false);
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
    localStorage.removeItem(ROOM_CODE_KEY);
    localStorage.removeItem(PLAYER_NAME_KEY);
    setRoomState(null);
    setIsAdmin(false);
    setIsRehydratingSession(false);
  }, []);

  useEffect(() => {
    // Generate or retrieve persistent playerId
    let id = localStorage.getItem(PLAYER_ID_KEY) || sessionStorage.getItem("poker_playerId");
    if (!id) {
      id = uuidv4();
    }
    localStorage.setItem(PLAYER_ID_KEY, id);
    sessionStorage.setItem("poker_playerId", id);
    setPlayerId(id);
    playerIdRef.current = id;

    function reconnect() {
      const savedRoomCode = localStorage.getItem(ROOM_CODE_KEY);
      const savedPlayerId = localStorage.getItem(PLAYER_ID_KEY) || id;
      const savedPlayerName = localStorage.getItem(PLAYER_NAME_KEY);
      if (!savedRoomCode || !savedPlayerId) {
        setIsRehydratingSession(false);
        return;
      }
      if (reconnectInFlightRef.current) {
        return;
      }
      reconnectInFlightRef.current = true;
      setIsRehydratingSession(true);
      socket.emit("room:reconnect", {
        roomId: savedRoomCode,
        playerId: savedPlayerId,
        playerName: savedPlayerName || undefined,
      }, (res) => {
        reconnectInFlightRef.current = false;
        if (res.success) {
          localStorage.setItem(ROOM_CODE_KEY, res.room.roomId);
          localStorage.setItem(PLAYER_ID_KEY, savedPlayerId);
          if (savedPlayerName) {
            localStorage.setItem(PLAYER_NAME_KEY, savedPlayerName);
          }
          onRoomUpdated(res.room);
        }
        setIsRehydratingSession(false);
      });
    }

    function onConnect() {
      setIsConnected(true);
      reconnect();
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
      const currentPlayer = newRoomState.players?.find(p => p.id === playerIdRef.current);
      if (currentPlayer) {
        localStorage.setItem(ROOM_CODE_KEY, newRoomState.roomId);
        localStorage.setItem(PLAYER_ID_KEY, playerIdRef.current);
        localStorage.setItem(PLAYER_NAME_KEY, currentPlayer.name);
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:updated", onRoomUpdated);
    socket.on("game:stateUpdate", onRoomUpdated);
    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:updated", onRoomUpdated);
      socket.off("game:stateUpdate", onRoomUpdated);
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected, roomState, playerId, isAdmin, isRehydratingSession, socket, leaveRoom }}>
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
