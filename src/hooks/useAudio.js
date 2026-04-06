"use client";

import { useRef, useCallback, useState } from "react";

/**
 * Synthesizes a short tone using the Web Audio API.
 * @param {AudioContext} ctx
 * @param {number} freq - Frequency in Hz
 * @param {number} duration - Duration in seconds
 * @param {string} type - Oscillator type
 * @param {number} gain - Volume 0-1
 */
function synthTone(ctx, freq, duration, type = "sine", gain = 0.3) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

/**
 * Custom hook for all sound effects in the poker engine.
 * Chip sounds use pre-recorded MP3s; event SFX use Web Audio API synthesis.
 */
export function useAudio() {
  const [muted, setMuted] = useState(false);
  const audioCtxRef = useRef(null);
  const chipLowRef = useRef(null);
  const chipHighRef = useRef(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (autoplay policy)
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Play a chip sound based on denomination.
   * <= 100 → chip_low.mp3, >= 500 → chip_high.mp3
   */
  const playChipSound = useCallback((denomination) => {
    if (muted) return;
    try {
      if (denomination <= 100) {
        if (!chipLowRef.current) {
          chipLowRef.current = new Audio("/soundtracks/chip_low.mp3");
        }
        chipLowRef.current.currentTime = 0;
        chipLowRef.current.play().catch(() => {});
      } else {
        if (!chipHighRef.current) {
          chipHighRef.current = new Audio("/soundtracks/chip_high.mp3");
        }
        chipHighRef.current.currentTime = 0;
        chipHighRef.current.play().catch(() => {});
      }
    } catch (e) {
      // Silently fail — audio is non-critical
    }
  }, [muted]);

  /**
   * Play a synthesized SFX for game events.
   * Supported: "join", "conclude", "showdown", "click"
   */
  const playSfx = useCallback((eventName) => {
    if (muted) return;
    try {
      const ctx = getAudioCtx();
      switch (eventName) {
        case "join":
          // Ascending two-tone chime
          synthTone(ctx, 523, 0.15, "sine", 0.25);
          setTimeout(() => synthTone(ctx, 659, 0.2, "sine", 0.25), 100);
          break;
        case "conclude":
          // Descending two-tone
          synthTone(ctx, 440, 0.2, "triangle", 0.3);
          setTimeout(() => synthTone(ctx, 330, 0.3, "triangle", 0.3), 150);
          break;
        case "showdown":
          // Dramatic three-tone fanfare
          synthTone(ctx, 392, 0.15, "square", 0.15);
          setTimeout(() => synthTone(ctx, 523, 0.15, "square", 0.15), 120);
          setTimeout(() => synthTone(ctx, 659, 0.3, "square", 0.2), 240);
          break;
        case "click":
          // Short percussive tick
          synthTone(ctx, 800, 0.05, "square", 0.15);
          break;
        default:
          break;
      }
    } catch (e) {
      // Silently fail
    }
  }, [muted, getAudioCtx]);

  const toggleMute = useCallback(() => setMuted(prev => !prev), []);

  return { playChipSound, playSfx, muted, toggleMute };
}
