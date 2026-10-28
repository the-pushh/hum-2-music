"use client";

import { useEffect, useRef, useState } from "react";
import { PianoKeys, Stop } from "@phosphor-icons/react";
import { startedPlaying, stoppedPlaying } from "@/audio/exclusivePlayback";
import { playMelody, type Playback } from "@/audio/piano";
import type { Note } from "@/melody/types";
import { Button } from "./Button";

type State = "idle" | "loading" | "playing" | "failed";

/** Plays a melody as piano. Joins the one-thing-at-a-time rule with hums and other melodies. */
export function PianoButton({ notes, bpm }: { notes: Note[]; bpm: number }) {
  const [state, setState] = useState<State>("idle");
  const playbackRef = useRef<Playback | null>(null);

  // Stop playing when the card goes away.
  useEffect(() => () => playbackRef.current?.pause(), []);

  async function toggle() {
    if (state === "playing") return playbackRef.current?.pause();
    setState("loading");
    try {
      const playback: Playback = await playMelody(notes, bpm, () => {
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
        {state === "playing" ? <Stop size={16} weight="fill" aria-hidden /> : <PianoKeys size={16} aria-hidden />}
        {state === "loading" ? "Loading piano" : state === "playing" ? "Stop" : "Play as piano"}
      </Button>
      {state === "failed" && (
        <span role="alert" className="text-xs text-accent">
          The piano didn&apos;t load. Check your connection and try again.
        </span>
      )}
    </div>
  );
}
