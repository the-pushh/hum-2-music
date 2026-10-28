"use client";

import { useEffect, useRef } from "react";
import { usePlaybackStore } from "@/studio/store/playback";
import { playheadBars } from "@/studio/transport";

/** The playhead: a marker on the ruler and a line down every lane. Moves with transform each frame, without re-rendering React. */
export function Playhead({ barPx }: { barPx: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const playing = usePlaybackStore((s) => s.isPlaying);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!playing) {
      el.style.transform = "translateX(0)";
      return;
    }
    let frame = 0;
    const tick = () => {
      el.style.transform = `translateX(${playheadBars() * barPx}px)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, barPx]);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-0.5 flex-col items-center bg-accent">
      <svg viewBox="0 0 12 8" className="h-2 w-3 shrink-0 fill-accent">
        <path d="M0 0h12L6 8z" />
      </svg>
    </div>
  );
}
