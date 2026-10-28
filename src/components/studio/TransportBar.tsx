"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { ArrowClockwise, ArrowCounterClockwise, Minus, Play, Plus, Repeat, Stop } from "@phosphor-icons/react";
import { useProjectStore } from "@/studio/store/project";
import { usePlaybackStore } from "@/studio/store/playback";
import { playProject, playheadBars, stopProject } from "@/studio/transport";
import { iconButton } from "./iconButton";

const minBpm = 40;
const maxBpm = 200;

/** Play, where the playhead is, tempo, loop, and undo. */
export function TransportBar() {
  const project = useProjectStore((s) => s.project);
  const setBpm = useProjectStore((s) => s.setBpm);
  const playing = usePlaybackStore((s) => s.isPlaying);
  const loop = usePlaybackStore((s) => s.loopEnabled);
  const toggleLoop = usePlaybackStore((s) => s.toggleLoop);
  const { undo, redo, pastStates, futureStates } = useStore(useProjectStore.temporal);
  const positionRef = useRef<HTMLSpanElement>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-2">
      <button
        type="button"
        onClick={() => (playing ? stopProject() : void start())}
        aria-pressed={playing}
        disabled={starting}
        aria-busy={starting}
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink transition duration-300 ease-soft hover:opacity-90 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:animate-pulse"
      >
        {playing ? <Stop size={24} weight="fill" aria-hidden /> : <Play size={24} weight="fill" aria-hidden />}
        <span className="sr-only">{playing ? "Stop" : starting ? "Loading instruments" : "Play"}</span>
      </button>
      <span className="flex flex-col px-2">
        <span className="text-xs text-ink-muted">Bar</span>
        <span ref={positionRef} className="font-mono text-base text-ink tabular-nums" aria-hidden>
          1.1
        </span>
      </span>
      <div role="group" aria-label="Tempo" className="inline-flex items-center rounded-lg bg-raised">
        <button type="button" className={iconButton} disabled={project.bpm <= minBpm} onClick={() => setBpm(Math.max(minBpm, project.bpm - 5))}>
          <Minus size={16} aria-hidden />
          <span className="sr-only">Slower</span>
        </button>
        <span className="min-w-16 text-center font-mono text-sm text-ink tabular-nums" aria-live="polite">
          {project.bpm} BPM
        </span>
        <button type="button" className={iconButton} disabled={project.bpm >= maxBpm} onClick={() => setBpm(Math.min(maxBpm, project.bpm + 5))}>
          <Plus size={16} aria-hidden />
          <span className="sr-only">Faster</span>
        </button>
      </div>
      <button type="button" className={iconButton} aria-pressed={loop} onClick={toggleLoop}>
        <Repeat size={20} aria-hidden />
        <span className="sr-only">Loop</span>
      </button>
      <span className="text-sm text-ink-muted">
        {project.key.replace("#", "♯")} {project.scale}
      </span>
      {error && (
        <p role="alert" className="w-full text-sm text-accent">
          {error}
        </p>
      )}
      <div className="ml-auto flex">
        <button type="button" className={iconButton} disabled={!pastStates.length} onClick={() => undo()}>
          <ArrowCounterClockwise size={20} aria-hidden />
          <span className="sr-only">Undo</span>
        </button>
        <button type="button" className={iconButton} disabled={!futureStates.length} onClick={() => redo()}>
          <ArrowClockwise size={20} aria-hidden />
          <span className="sr-only">Redo</span>
        </button>
      </div>
    </div>
  );
}
