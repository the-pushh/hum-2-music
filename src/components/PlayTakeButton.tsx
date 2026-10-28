"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Stop } from "@phosphor-icons/react";
import { startedPlaying, stoppedPlaying } from "@/audio/exclusivePlayback";
import type { Playback } from "@/audio/takePlayer";
import { Button } from "./Button";

type State = "idle" | "loading" | "playing" | "failed";

/**
 * Plays what hum heard in a take on an instrument ("Play as strings", "Play on drums"). Joins the one-thing-at-a-time
 * rule with hums and other takes.
 */
export function PlayTakeButton({
  label,
  instrument,
  play,
}: {
  /** "Play as strings", "Play on drums". */
  label: string;
  /** The instrument's name in messages: "strings", "drums". Changing it stops what's playing. */
  instrument: string;
  play: (onEnded: () => void) => Promise<Playback>;
}) {
  const [state, setState] = useState<State>("idle");
  const playbackRef = useRef<Playback | null>(null);

  // Stop playing when the card goes away or the instrument changes.
  useEffect(() => () => playbackRef.current?.pause(), [instrument]);

  async function toggle() {
    if (state === "playing") return playbackRef.current?.pause();
    setState("loading");
    try {
      const playback: Playback = await play(() => {
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
        {state === "loading" ? `Loading ${instrument}` : state === "playing" ? "Stop" : label}
      </Button>
      {state === "failed" && (
        <span role="alert" className="text-xs font-semibold">
          The {instrument} didn&apos;t load. Check your connection and try again.
        </span>
      )}
    </div>
  );
}
