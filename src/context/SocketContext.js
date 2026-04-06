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
