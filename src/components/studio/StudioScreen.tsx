"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { useArrangement } from "@/studio/useArrangement";
import { useProjectStore } from "@/studio/store/project";
import { stopProject } from "@/studio/transport";
import { Button } from "../Button";
import { DrumGrid } from "./DrumGrid";
import { FloatingTransport } from "./FloatingTransport";
import { PianoRoll } from "./PianoRoll";
import { roleBg } from "./roleColors";
import { Timeline } from "./Timeline";

/** A Sketch's studio: its hums as tracks on a timeline you can play, edit and fill out. */
export function StudioScreen({ sketchId }: { sketchId: string }) {
  const { state, refresh, keep } = useArrangement(sketchId);
  const project = useProjectStore((s) => s.project);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const sketch = state.status === "ready" ? state.sketch : undefined;
  const selected = project?.tracks.find((t) => t.id === selectedTrackId);

  useEffect(() => () => stopProject(), []);

  if (state.status === "missing") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">This sketch isn&apos;t here</h1>
        <p className="text-base text-ink-muted">It may have been deleted, or it was saved in a different browser.</p>
        <Link href="/" className="w-fit rounded-lg text-base font-semibold text-ink underline underline-offset-4 transition duration-300 ease-soft hover:text-ink-muted active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          Back to capture
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-8 pb-24">
      <Link
        href={`/s/${sketchId}`}
        className="inline-flex w-fit items-center gap-2 rounded-lg py-1 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to sketch
      </Link>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-accent">
          {state.message}
        </p>
      )}

      {state.status === "ready" && state.stale.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-2">
          <p className="w-full px-1 text-sm text-ink sm:w-auto sm:flex-1">
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

      {state.status === "loading" || !project ? (
        <div className="flex flex-col gap-1 rounded-3xl bg-surface p-2" aria-busy>
          <div className="h-16 w-1/3 animate-pulse rounded-2xl bg-raised" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-raised" />
          ))}
        </div>
      ) : (
        <>
          <Timeline title={sketch?.title ?? "Studio"} selectedTrackId={selectedTrackId} onSelect={setSelectedTrackId} />
          {!project.clips.length && (
            <p className="px-2 text-sm text-ink-muted">
              No hums in this sketch have notes yet. Transcribe a hum on the sketch page, or tap a track to write notes yourself.
            </p>
          )}
          {selected && (
            <section aria-label={`Edit ${selected.name}`} className="flex flex-col gap-3 rounded-3xl bg-surface p-2">
              <h2 className="flex items-center gap-2 px-2 pt-2 text-base font-semibold text-ink">
                <span className={`size-3 rounded-full ${roleBg[selected.color]}`} aria-hidden />
                {selected.name}
              </h2>
              {selected.type === "drum" ? <DrumGrid track={selected} /> : <PianoRoll track={selected} />}
            </section>
          )}
          <FloatingTransport />
        </>
      )}
    </main>
  );
}
