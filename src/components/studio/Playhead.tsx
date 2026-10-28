"use client";

import { useEffect, useRef } from "react";
import { usePlaybackStore } from "@/studio/store/playback";
import { playheadBars } from "@/studio/transport";

/** A line across a lane at the playhead. Moves with transform every frame, without re-rendering React. */
export function Playhead({ bars }: { bars: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const playing = usePlaybackStore((s) => s.isPlaying);

  useEffect(() => {
    const line = ref.current;
    if (!line) return;
    if (!playing) {
      line.style.transform = "translateX(0)";
      return;
    }
    let frame = 0;
    const tick = () => {
      const width = line.parentElement?.clientWidth ?? 0;
      line.style.transform = `translateX(${(Math.min(playheadBars(), bars) / bars) * width}px)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, bars]);

  return <div ref={ref} aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-ink ${playing ? "opacity-100" : "opacity-0"}`} />;
}
