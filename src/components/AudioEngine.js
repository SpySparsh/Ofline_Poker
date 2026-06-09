"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/context/SocketContext";

const AUDIO_UNLOCKED_KEY = "audioUnlocked";
const RECOVERY_DELAYS_MS = [250, 1000, 2000, 4000];

export default function AudioEngine() {
  const { socket } = useSocket();
  const audioRef = useRef(null);
  const recoveryTimerRef = useRef(null);
  const recoveryAttemptsRef = useRef(0);

  useEffect(() => {
    if (!socket) return;

    function clearRecoveryTimer() {
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    }

    function tryPlayBgm({ userGesture = false, scheduleRetry = false } = {}) {
      const audio = audioRef.current;
      if (!audio?.src || !audio.paused) return;

      audio.play().then(() => {
        if (userGesture) {
          localStorage.setItem(AUDIO_UNLOCKED_KEY, "true");
        }
        clearRecoveryTimer();
        recoveryAttemptsRef.current = 0;
      }).catch(e => {
        console.warn('BGM Autoplay blocked', e);
        if (!scheduleRetry || localStorage.getItem(AUDIO_UNLOCKED_KEY) !== "true") return;

        const delay = RECOVERY_DELAYS_MS[recoveryAttemptsRef.current];
        if (!delay) return;

        recoveryAttemptsRef.current += 1;
        clearRecoveryTimer();
        recoveryTimerRef.current = setTimeout(() => {
          tryPlayBgm({ scheduleRetry: true });
        }, delay);
      });
    }

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
        recoveryAttemptsRef.current = 0;
        tryPlayBgm({ scheduleRetry: true });
      } else if (currentDrift > 2) {
        // Correct minor drift without completely reloading the src
        audioRef.current.currentTime = offsetSeconds;
        tryPlayBgm({ scheduleRetry: true });
      } else {
        tryPlayBgm({ scheduleRetry: true });
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

    function onUserAudioUnlock() {
      const audio = audioRef.current;
      if (audio?.src && !audio.paused) {
        localStorage.setItem(AUDIO_UNLOCKED_KEY, "true");
        return;
      }
      tryPlayBgm({ userGesture: true });
    }
    window.addEventListener('pointerdown', onUserAudioUnlock);
    window.addEventListener('keydown', onUserAudioUnlock);

    return () => {
      clearRecoveryTimer();
      socket.off('bgm:syncTrack', onSyncTrack);
      window.removeEventListener('bgm:kickstart', onKickstart);
      window.removeEventListener('pointerdown', onUserAudioUnlock);
      window.removeEventListener('keydown', onUserAudioUnlock);
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
