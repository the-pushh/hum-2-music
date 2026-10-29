"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { useArrangement } from "@/studio/useArrangement";
import { useProjectStore } from "@/studio/store/project";
import { stopProject } from "@/studio/transport";
import type { Place } from "@/sketches/types";
import { stack, type Size } from "@/ui/canvasLayout";
import { Button } from "../Button";
import { FreeCanvas, useScreenWidth, type Piece } from "../FreeCanvas";
import { DescribeBox } from "./DescribeBox";
import { DrumGrid } from "./DrumGrid";
import { FloatingTransport } from "./FloatingTransport";
import { PianoRoll } from "./PianoRoll";
import { roleBg } from "./roleColors";
import { Timeline } from "./Timeline";

/** The studio's width before it was a canvas: max-w-6xl. */
const PAGE_WIDTH = 1152;

/** A Sketch's studio: its hums and beats as tracks on a timeline you can play, edit and fill out. */
export function StudioScreen({ sketchId }: { sketchId: string }) {
  const { state, refresh, keep } = useArrangement(sketchId);
  const project = useProjectStore((s) => s.project);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const sketch = state.status === "ready" ? state.sketch : undefined;
  const selected = project?.tracks.find((t) => t.id === selectedTrackId);
  // As wide as the studio was: the screen less its gutters, up to max-w-6xl.
  const pageWidth = Math.min(useScreenWidth() - 32, PAGE_WIDTH);

  useEffect(() => () => stopProject(), []);

  if (state.status === "missing") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">This idea isn&apos;t here</h1>
        <p className="text-base text-ink-muted">It may have been deleted, or it was saved in a different browser.</p>
        <Link href="/" className="w-fit rounded-lg text-base font-semibold text-ink underline underline-offset-4 transition duration-300 ease-soft hover:text-ink-muted active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
          Back to capture
        </Link>
      </main>
    );
  }

  if (state.status === "loading" || (state.status === "ready" && !project)) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-8 pb-24" aria-busy>
        <div className="flex flex-col gap-1 rounded-3xl bg-surface p-2">
          <div className="h-16 w-1/3 animate-pulse rounded-2xl bg-raised" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-raised" />
          ))}
        </div>
      </main>
    );
  }

  const pieces: Piece[] = [
    {
      id: "back",
      label: "Back to idea",
      node: (
        <Link
          href={`/s/${sketchId}`}
          className="inline-flex w-fit items-center gap-2 rounded-lg py-1 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to idea
        </Link>
      ),
    },
  ];
  if (state.status === "ready" && state.stale.length > 0) {
    pieces.push({
      id: "stale",
      label: "Newer takes",
      width: pageWidth,
      node: (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-2">
          <p className="w-full px-1 text-sm text-ink sm:w-auto sm:flex-1">
            {state.stale.length === 1 ? "A take has" : `${state.stale.length} takes have`} new notes or a new sound since you last opened the studio.
          </p>
          <Button variant="secondary" onClick={() => refresh(state.stale)}>
            Use the new versions
          </Button>
          <Button variant="ghost" onClick={() => keep(state.stale)}>
            Keep mine
          </Button>
        </div>
      ),
    });
  }
  if (project) {
    pieces.push(
      {
        id: "timeline",
        label: "Timeline",
        width: pageWidth,
        node: <Timeline title={sketch?.title ?? "Studio"} selectedTrackId={selectedTrackId} onSelect={setSelectedTrackId} />,
      },
      { id: "describe", label: "Describe the song", width: pageWidth, node: <DescribeBox /> },
    );
    if (!project.clips.length) {
      pieces.push({
        id: "hint",
        label: "Nothing heard yet",
        width: pageWidth,
        node: (
          <p className="px-2 text-sm text-ink-muted">
            Nothing in this sketch has been heard yet. Record a melody or a beat on the sketch page, or tap a track to write notes yourself.
          </p>
        ),
      });
    }
    if (selected) {
      pieces.push({
        id: "editor",
        label: `Edit ${selected.name}`,
        width: pageWidth,
        node: (
          <section aria-label={`Edit ${selected.name}`} className="flex flex-col gap-3 rounded-3xl bg-surface p-2">
            <h2 className="flex items-center gap-2 px-2 pt-2 text-base font-semibold text-ink">
              <span className={`size-3 rounded-full ${roleBg[selected.color]}`} aria-hidden />
              {selected.name}
            </h2>
            {selected.type === "drum" ? <DrumGrid track={selected} /> : <PianoRoll track={selected} />}
          </section>
        ),
      });
    }
  }

  /** The studio as it was: back link, any newer takes, the timeline, the Describe box, then the note editor. */
  function firstLayout(sizes: Record<string, Size>): Record<string, Place> {
    // A piece that shows up later (the note editor, newer takes) gets its spot from the page as it is then.
    return stack(
      pieces.map((p) => ({ id: p.id, size: sizes[p.id] })),
      { width: pageWidth, gap: 16 },
    ).places;
  }

  return (
    <main className="h-dvh w-full">
      <FreeCanvas
        layoutId={`studio:${sketchId}`}
        pieces={pieces}
        firstLayout={firstLayout}
        overlay={
          <>
            {state.status === "error" && (
              <p role="alert" className="absolute top-4 left-4 rounded-lg bg-raised px-3 py-2 text-sm text-accent">
                {state.message}
              </p>
            )}
            {project && <FloatingTransport />}
          </>
        }
      />
    </main>
  );
}
