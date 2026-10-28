"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Play, Stop } from "@phosphor-icons/react";
import { sketchStore } from "@/sketches/client";
import { sketchToProject } from "@/studio/sketchToProject";
import { useProjectStore } from "@/studio/store/project";
import { usePlaybackStore } from "@/studio/store/playback";
import { playProject, stopProject } from "@/studio/transport";
import { Button } from "../Button";

/** A Sketch's studio: its hums as tracks in a small arrangement you can play. */
export function StudioScreen({ sketchId }: { sketchId: string }) {
  // null means "looked and it isn't there"; undefined means still loading.
  const sketch = useLiveQuery(async () => (await sketchStore().getSketch(sketchId)) ?? null, [sketchId]);
  const ideas = useLiveQuery(() => sketchStore().listIdeas(sketchId), [sketchId]);
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const playing = usePlaybackStore((s) => s.isPlaying);
  // The project store is app-wide, so remember which Sketch it was loaded for.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!sketch || !ideas || loadedFor === sketchId) return;
    loadProject(sketchToProject(sketch, ideas));
    setLoadedFor(sketchId); // eslint-disable-line react-hooks/set-state-in-effect
  }, [sketch, ideas, sketchId, loadedFor, loadProject]);

  useEffect(() => () => stopProject(), []);

  if (sketch === null) {
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
      {project && loadedFor === sketchId && (
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
