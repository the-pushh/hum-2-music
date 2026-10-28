"use client";

import { useEffect, useRef } from "react";
import { drumPitch } from "@/beat/hearBeat";
import type { Note } from "@/melody/types";
import { tokenColor } from "@/ui/tokenColor";

/** Top to bottom, as drum grids usually read. */
const rows = [drumPitch.hat, drumPitch.snare, drumPitch.kick];

/** A read-only picture of a beat, dark on a beat card's cyan: one row each for hi-hat, snare and kick, time across. */
export function HitStrip({ hits, label }: { hits: Note[]; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx || !hits.length) return;
      ctx.scale(ratio, ratio);
      const length = Math.max(...hits.map((h) => h.start + h.duration));
      const rowHeight = height / rows.length;
      const size = Math.min(8, rowHeight - 4);
      // Not laid out yet (a hidden or collapsed card): nothing to draw, and roundRect throws on a negative size.
      if (size <= 0) return;
      const ink = tokenColor("canvas");
      // Faint row lines, so a missing drum still reads as a row.
      ctx.fillStyle = `${ink}26`;
      rows.forEach((_, r) => ctx.fillRect(0, r * rowHeight + rowHeight / 2 - 0.5, width, 1));
      ctx.fillStyle = ink;
      for (const h of hits) {
        const r = rows.indexOf(h.pitch as (typeof rows)[number]);
        if (r < 0) continue;
        const x = Math.min(width - size, (h.start / length) * width);
        ctx.globalAlpha = 0.4 + 0.6 * h.velocity;
        ctx.beginPath();
        ctx.roundRect(x, r * rowHeight + (rowHeight - size) / 2, size, size, size / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [hits]);

  return (
    <div className="flex gap-2">
      <div className="flex h-12 flex-col justify-between font-mono text-xs leading-4 opacity-70" aria-hidden>
        <span>Hat</span>
        <span>Snr</span>
        <span>Kick</span>
      </div>
      <canvas ref={canvasRef} role="img" aria-label={label} className="h-12 min-w-0 flex-1" />
    </div>
  );
}
