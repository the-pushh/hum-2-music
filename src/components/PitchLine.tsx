"use client";

import { useEffect, useRef } from "react";
import { PitchDetector } from "pitchy";
import { audioContext } from "@/audio/context";
import { inKey } from "@/melody/cleanup";
import type { Key } from "@/melody/types";
import { tokenColor } from "@/ui/tokenColor";

/** Seconds of singing visible at once. */
const windowSec = 5;
/** Below this, pitchy is guessing: breath, consonants, room noise. */
const minClarity = 0.9;
const lowestHz = 60;
const highestHz = 1100;
/** Frames further apart than this aren't joined. */
const maxJoinSec = 0.1;
/** Semitones shown above and below the middle of the view. */
const halfRange = 9;

type Point = { t: number; midi: number | null };

/**
 * A line that follows the voice's pitch while recording, over faint guide lines: every semitone, or the notes of the
 * chosen key. Feedback only; nothing here is saved. It still draws with reduced motion, because it's data.
 */
export function PitchLine({ stream, songKey }: { stream: MediaStream | null; songKey: Key | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyRef = useRef(songKey);
  useEffect(() => {
    keyRef.current = songKey;
  }, [songKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!stream || !canvas) return;
    let frame = 0;
    let stopped = false;
    let source: MediaStreamAudioSourceNode | undefined;

    void audioContext().then((ctx) => {
      if (stopped) return;
      source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const colors = { line: tokenColor("accent"), guide: tokenColor("line"), scale: tokenColor("ink-muted") };
      const points: Point[] = [];
      let centre: number | null = null;

      const draw = () => {
        const now = performance.now() / 1000;
        analyser.getFloatTimeDomainData(samples);
        const [hz, clarity] = detector.findPitch(samples, ctx.sampleRate);
        const heard = clarity >= minClarity && hz >= lowestHz && hz <= highestHz;
        const midi = heard ? 69 + 12 * Math.log2(hz / 440) : null;
        points.push({ t: now, midi });
        while (points.length && points[0].t < now - windowSec) points.shift();
        // Follow the voice slowly, so the view doesn't jump with every note.
        if (midi !== null) centre = centre === null ? midi : centre + (midi - centre) * 0.02;

        const ratio = window.devicePixelRatio || 1;
        const { width, height } = canvas.getBoundingClientRect();
        if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
        if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
        const g = canvas.getContext("2d");
        if (!g) return;
        g.setTransform(ratio, 0, 0, ratio, 0, 0);
        g.clearRect(0, 0, width, height);

        const mid = Math.round(centre ?? 60);
        const y = (m: number) => height / 2 - ((m - mid) / halfRange) * (height / 2);
        const key = keyRef.current;
        for (let m = mid - halfRange; m <= mid + halfRange; m++) {
          if (key && !inKey(m, key)) continue;
          const tonic = key && (((m - key.tonic) % 12) + 12) % 12 === 0;
          g.strokeStyle = key ? colors.scale : colors.guide;
          g.globalAlpha = tonic ? 0.6 : key ? 0.3 : 0.5;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(0, Math.round(y(m)) + 0.5);
          g.lineTo(width, Math.round(y(m)) + 0.5);
          g.stroke();
        }

        g.globalAlpha = 1;
        g.strokeStyle = colors.line;
        g.lineWidth = 2;
        g.lineCap = "round";
        g.lineJoin = "round";
        g.beginPath();
        let last: Point | null = null;
        for (const p of points) {
          if (p.midi === null) {
            last = null;
            continue;
          }
          const x = width - ((now - p.t) / windowSec) * width;
          // Only join frames that are close in time; a slow or throttled frame would draw a slide that wasn't sung.
          if (last && p.t - last.t <= maxJoinSec) g.lineTo(x, y(p.midi));
          else g.moveTo(x, y(p.midi));
          last = p;
        }
        g.stroke();
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      source?.disconnect();
    };
  }, [stream]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />;
}
