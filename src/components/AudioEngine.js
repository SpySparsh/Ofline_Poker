"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/context/SocketContext";

export default function AudioEngine() {
  const { socket } = useSocket();
  const audioRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    function onSyncTrack(bgmState) {
      if (!audioRef.current || !bgmState || !bgmState.currentTrackIndex) return;
      
      const expectedSrc = `/soundtracks/Room${bgmState.currentTrackIndex}.mp3`;
      const offsetSeconds = (Date.now() - bgmState.startTime) / 1000;
      
      // Check if we are already playing the right track
      const isPlayingCorrectTrack = audioRef.current.src.includes(expectedSrc);
      
      // Calculate drift
      const currentDrift = Math.abs(audioRef.current.currentTime - offsetSeconds);
      
      // ONLY update src or currentTime if the track changed, OR if we are out of sync by more than 2 seconds
      if (!isPlayingCorrectTrack) {
        audioRef.current.src = expectedSrc;
        audioRef.current.currentTime = offsetSeconds;
        audioRef.current.volume = 0.3; // Default level
        audioRef.current.play().catch(e => console.warn('BGM Autoplay blocked', e));
      } else if (currentDrift > 2) {
        // Correct minor drift without completely reloading the src
        audioRef.current.currentTime = offsetSeconds;
      }
    }

    // Direct Socket listener
    socket.on('bgm:syncTrack', onSyncTrack);

    // Kickstart mechanism (dispatched locally by GamePage on mount)
    function onKickstart(e) {
      if (e.detail) {
        onSyncTrack(e.detail);
      }
    }
    window.addEventListener('bgm:kickstart', onKickstart);

    return () => {
      socket.off('bgm:syncTrack', onSyncTrack);
      window.removeEventListener('bgm:kickstart', onKickstart);
    };
  }, [socket]);

  // Unconditionally render the audio tag into the DOM so it never unmounts
  return (
    <audio 
      ref={audioRef} 
      id="global-bgm"
      preload="auto"
      className="hidden"
    />
  );
}
