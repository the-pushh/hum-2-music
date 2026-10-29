"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { ArrowClockwise, ArrowCounterClockwise, DownloadSimple, MagicWand, Play, Repeat, Stop } from "@phosphor-icons/react";
import { downloadProjectAsMidi } from "@/studio/audio/export";
import { withGeneratedParts } from "@/studio/generate/parts";
import { useProjectStore } from "@/studio/store/project";
import { usePlaybackStore } from "@/studio/store/playback";
import { playProject, playheadBars, stopProject } from "@/studio/transport";
import { WriteWithClaude } from "./WriteWithClaude";

/** A small round button on the transport pill. Pair with sr-only text. */
const pillButton =
  "inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-full text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-line";

/**
 * The studio's transport, floating at the bottom of the screen: play, where the playhead is, loop, undo and redo,
 * generate parts, and export.
 */
export function FloatingTransport() {
  const project = useProjectStore((s) => s.project);
  const playing = usePlaybackStore((s) => s.isPlaying);
  const loop = usePlaybackStore((s) => s.loopEnabled);
  const toggleLoop = usePlaybackStore((s) => s.toggleLoop);
  const { undo, redo, pastStates, futureStates } = useStore(useProjectStore.temporal);
  const positionRef = useRef<HTMLSpanElement>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The position updates every frame without re-rendering React.
  useEffect(() => {
    const el = positionRef.current;
    if (!el) return;
    if (!playing) {
      el.textContent = "1.1";
      return;
    }
    let frame = 0;
    const tick = () => {
      const bars = playheadBars();
      el.textContent = `${Math.floor(bars) + 1}.${Math.floor((bars % 1) * (project?.timeSignature[0] ?? 4)) + 1}`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, project?.timeSignature]);

  if (!project) return null;
  const generated = project.tracks.some((t) => t.origin?.kind === "generated");
  const hasNotes = project.clips.some((c) => c.notes?.length);

  async function start() {
    if (!project) return;
    setStarting(true);
    setError(null);
    try {
      await playProject(project);
    } catch {
      stopProject();
      setError("The instruments couldn't load. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-30 flex flex-col items-center gap-2 px-4">
      {error && (
        <p role="alert" className="rounded-lg bg-raised px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="flex items-center gap-1 rounded-full bg-raised/80 p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => (playing ? stopProject() : void start())}
          aria-pressed={playing}
          disabled={starting}
          aria-busy={starting}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition duration-300 ease-soft hover:opacity-90 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:animate-pulse"
        >
          {playing ? <Stop size={20} weight="fill" aria-hidden /> : <Play size={20} weight="fill" aria-hidden />}
          <span className="sr-only">{playing ? "Stop" : starting ? "Loading instruments" : "Play"}</span>
        </button>
        <span ref={positionRef} className="w-12 text-center font-mono text-sm text-ink tabular-nums" aria-hidden>
          1.1
        </span>
        <button type="button" className={pillButton} aria-pressed={loop} onClick={toggleLoop}>
          <Repeat size={20} aria-hidden />
          <span className="sr-only">Loop</span>
        </button>
        <button type="button" className={pillButton} disabled={!pastStates.length} onClick={() => undo()}>
          <ArrowCounterClockwise size={20} aria-hidden />
          <span className="sr-only">Undo</span>
        </button>
        <button type="button" className={pillButton} disabled={!futureStates.length} onClick={() => redo()}>
          <ArrowClockwise size={20} aria-hidden />
          <span className="sr-only">Redo</span>
        </button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <button
          type="button"
          className={`${pillButton} sm:w-auto sm:px-3`}
          onClick={() => {
            const current = useProjectStore.getState().project;
            if (current) useProjectStore.getState().loadProject(withGeneratedParts(current));
          }}
        >
          <MagicWand size={20} aria-hidden />
          <span className="sr-only sm:not-sr-only sm:text-sm sm:font-semibold">{generated ? "Generate again" : "Generate parts"}</span>
        </button>
        <WriteWithClaude buttonClassName={pillButton} />
        <button type="button" className={pillButton} disabled={!hasNotes} onClick={() => downloadProjectAsMidi(project)}>
          <DownloadSimple size={20} aria-hidden />
          <span className="sr-only">Export MIDI</span>
        </button>
      </div>
    </div>
  );
}
