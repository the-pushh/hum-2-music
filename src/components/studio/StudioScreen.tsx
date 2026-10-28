"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, Play, Stop } from "@phosphor-icons/react";
import { useArrangement } from "@/studio/useArrangement";
import { useProjectStore } from "@/studio/store/project";
import { usePlaybackStore } from "@/studio/store/playback";
import { playProject, stopProject } from "@/studio/transport";
import { Button } from "../Button";

/** A Sketch's studio: its hums as tracks in a small arrangement you can play. */
export function StudioScreen({ sketchId }: { sketchId: string }) {
  const { state, refresh, keep } = useArrangement(sketchId);
  const project = useProjectStore((s) => s.project);
  const playing = usePlaybackStore((s) => s.isPlaying);
  const sketch = state.status === "ready" ? state.sketch : undefined;

  useEffect(() => () => stopProject(), []);

  if (state.status === "missing") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">This sketch isn&apos;t here</h1>
        <Link href="/" className="w-fit text-base font-semibold text-ink underline underline-offset-4">
          Back to capture
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <Link
          href={`/s/${sketchId}`}
          className="inline-flex w-fit items-center gap-2 rounded-lg py-1 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to sketch
        </Link>
        <h1 className="text-2xl font-semibold text-ink">{sketch?.title ?? "Studio"}</h1>
      </header>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-accent">
          {state.message}
        </p>
      )}
      {state.status === "ready" && state.stale.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3">
          <p className="flex-1 text-sm text-ink">
            {state.stale.length === 1 ? "A hum has" : `${state.stale.length} hums have`} new notes since you last opened the studio.
          </p>
          <Button variant="secondary" onClick={() => refresh(state.stale)}>
            Use new notes
          </Button>
          <Button variant="ghost" onClick={() => keep(state.stale)}>
            Keep mine
          </Button>
        </div>
      )}
      {project && state.status === "ready" && (
        <>
          <div className="flex items-center gap-3">
            <Button onClick={() => (playing ? stopProject() : void playProject(project))}>
              {playing ? <Stop size={20} weight="fill" aria-hidden /> : <Play size={20} weight="fill" aria-hidden />}
              {playing ? "Stop" : "Play"}
            </Button>
            <span className="text-sm text-ink-muted">
              {project.bpm} BPM, {project.key} {project.scale}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {project.tracks.map((track) => (
              <li key={track.id} className="rounded-2xl bg-surface p-3 text-base text-ink">
                {track.name}
                <span className="text-sm text-ink-muted">
                  {" "}
                  {project.clips.filter((c) => c.trackId === track.id).reduce((n, c) => n + (c.notes?.length ?? 0), 0)} notes
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
