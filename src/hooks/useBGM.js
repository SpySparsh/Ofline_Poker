import { useEffect } from "react";
import { useSocket } from "@/context/SocketContext";

/**
 * Custom hook for synchronized background music playback.
 * The admin acts as the "DJ" — when their track ends, it signals
 * the server to rotate to the next track for all clients.
 *
 * @param {boolean} muted - Global mute state
 */
export function useBGM(muted) {
  const { roomState, isAdmin, socket } = useSocket();

  // Update volume when muted changes
  useEffect(() => {
    const audio = document.getElementById('global-bgm');
    if (audio) {
      audio.volume = muted ? 0 : 0.3;
    }
  }, [muted]);

  // Admin DJ: when track ends, tell server to rotate
  useEffect(() => {
    const audio = document.getElementById('global-bgm');
    if (!isAdmin || !audio || !socket || !roomState) return;

    function onTrackEnded() {
      socket.emit("bgm:trackEnded", { roomId: roomState.roomId });
    }

    audio.addEventListener("ended", onTrackEnded);
    return () => audio.removeEventListener("ended", onTrackEnded);
  }, [isAdmin, socket, roomState]);
}
