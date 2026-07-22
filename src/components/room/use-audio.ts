"use client";

import { useCallback, useRef, useState } from "react";

export function useAudio() {
  const context = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(() => typeof window === "undefined" || localStorage.getItem("rill-muted") !== "false");
  const [volume, setVolumeState] = useState(() => typeof window === "undefined" ? .7 : Number(localStorage.getItem("rill-volume") ?? .7));

  const play = useCallback((kind: "tap" | "dice" | "build" | "card" | "victory") => {
    if (muted) return;
    const audio = context.current ?? new AudioContext();
    context.current = audio;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const notes = { tap: 320, dice: 110, build: 180, card: 520, victory: 392 };
    oscillator.type = kind === "build" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(notes[kind], now);
    oscillator.frequency.exponentialRampToValueAtTime(notes[kind] * (kind === "victory" ? 2 : .72), now + .18);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime((kind === "dice" ? .12 : .07) * volume, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === "victory" ? .55 : .2));
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now); oscillator.stop(now + (kind === "victory" ? .6 : .22));
  }, [muted, volume]);

  const toggle = useCallback(() => {
    setMuted((current) => { localStorage.setItem("rill-muted", String(!current)); return !current; });
  }, []);
  const setVolume = useCallback((value: number) => { const next = Math.max(0, Math.min(1, value)); localStorage.setItem("rill-volume", String(next)); setVolumeState(next); }, []);
  return { muted, toggle, play, volume, setVolume };
}
