"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Stop } from "@phosphor-icons/react";
import { startedPlaying, stoppedPlaying } from "@/audio/exclusivePlayback";
import { playMelody, type Playback } from "@/audio/melodyPlayer";
import { instruments, type InstrumentId } from "@/instruments/instruments";
import type { Note } from "@/melody/types";
import { Button } from "./Button";

type State = "idle" | "loading" | "playing" | "failed";

/** Plays a melody on its instrument. Joins the one-thing-at-a-time rule with hums and other melodies. */
export function PlayMelodyButton({ notes, bpm, instrument }: { notes: Note[]; bpm: number; instrument: InstrumentId }) {
  const [state, setState] = useState<State>("idle");
  const playbackRef = useRef<Playback | null>(null);
  const label = instruments[instrument].label.toLowerCase();

  // Stop playing when the card goes away or the instrument changes.
  useEffect(() => () => playbackRef.current?.pause(), [instrument]);

  async function toggle() {
    if (state === "playing") return playbackRef.current?.pause();
    setState("loading");
    try {
      const playback: Playback = await playMelody(notes, bpm, instrument, () => {
        stoppedPlaying(playback);
        playbackRef.current = null;
        setState("idle");
      });
      playbackRef.current = playback;
      startedPlaying(playback);
      setState("playing");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" className="text-sm" disabled={state === "loading"} aria-pressed={state === "playing"} onClick={toggle}>
        {state === "playing" ? <Stop size={16} weight="fill" aria-hidden /> : <Play size={16} weight="fill" aria-hidden />}
        {state === "loading" ? `Loading ${label}` : state === "playing" ? "Stop" : `Play as ${label}`}
      </Button>
      {state === "failed" && (
        <span role="alert" className="text-xs font-semibold">
          The {label} didn&apos;t load. Check your connection and try again.
        </span>
      )}
    </div>
  );
}
