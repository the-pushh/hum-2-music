"use client";

import { useEffect, useRef } from "react";
import type { Note } from "@/melody/types";
import { tokenColor } from "@/ui/tokenColor";

/** A read-only picture of a melody, dark on a hum card's lime: pitch up, time across. */
export function NoteStrip({ notes, label }: { notes: Note[]; label: string }) {
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
      if (!ctx || !notes.length) return;
      ctx.scale(ratio, ratio);
      const low = Math.min(...notes.map((n) => n.pitch)) - 1;
      const high = Math.max(...notes.map((n) => n.pitch)) + 1;
      const length = Math.max(...notes.map((n) => n.start + n.duration));
      const rowHeight = Math.max(2, Math.min(6, height / (high - low + 1)));
      ctx.fillStyle = tokenColor("canvas");
      for (const n of notes) {
        const x = (n.start / length) * width;
        const w = Math.max(2, (n.duration / length) * width - 1);
        const y = ((high - n.pitch) / (high - low)) * (height - rowHeight);
        ctx.beginPath();
        ctx.roundRect(x, y, w, rowHeight, rowHeight / 2);
        ctx.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [notes]);

  return <canvas ref={canvasRef} role="img" aria-label={label} className="h-12 w-full" />;
}
