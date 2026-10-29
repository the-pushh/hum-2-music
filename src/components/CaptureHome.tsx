"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight, MusicNotes } from "@phosphor-icons/react";
import { sketchStore } from "@/sketches/client";
import type { Place, Sketch } from "@/sketches/types";
import { stack, type Size } from "@/ui/canvasLayout";
import { CaptureBar } from "./CaptureBar";
import { FreeCanvas, useScreenWidth, type Piece } from "./FreeCanvas";

const updatedAtFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The page's width before it was a canvas: max-w-xl. */
const PAGE_WIDTH = 576;

export function CaptureHome() {
  const sketches = useLiveQuery(() => sketchStore().listSketches(), []);
  // As wide as the page was: the screen less its gutters, up to max-w-xl.
  const pageWidth = Math.min(useScreenWidth() - 32, PAGE_WIDTH);

  if (sketches === undefined) return <main className="mx-auto w-full max-w-xl px-4 py-8" aria-busy />;

  const pieces: Piece[] = [
    {
      id: "intro",
      label: "hum",
      width: pageWidth,
      node: (
        <header className="flex flex-col items-start gap-3">
          <span className="inline-flex h-8 items-center rounded-lg bg-raised px-2 font-mono text-sm text-ink">hum</span>
          <h1 className="text-3xl font-semibold text-ink">Catch it before it goes</h1>
        </header>
      ),
    },
    { id: "capture", label: "Capture", width: pageWidth, node: <CaptureBar openSketchId={null} /> },
    {
      id: "recent",
      label: "Recent sketches",
      node: <h2 className="text-sm font-semibold text-ink-muted">Recent sketches</h2>,
    },
    ...(sketches.length === 0
      ? [
          {
            id: "empty",
            label: "No sketches yet",
            width: pageWidth,
            node: (
              <div className="rounded-2xl bg-surface p-6">
                <p className="text-base text-ink">No sketches yet.</p>
                <p className="text-sm text-ink-muted">
                  Write lyrics, hum a melody or beatbox a beat above, and hum starts a sketch for it. Everything you add later collects there.
                </p>
              </div>
            ),
          },
        ]
      : sketches.map((s) => ({ id: s.id, label: s.title, width: pageWidth, node: <SketchRow sketch={s} />, arrives: "view" as const }))),
  ];

  /** The page as it was: the intro, the capture bar, then the sketches listed newest first. */
  function firstLayout(sizes: Record<string, Size>): Record<string, Place> {
    const top = stack(
      [
        { id: "intro", size: sizes.intro },
        { id: "capture", size: sizes.capture },
        { id: "recent", size: sizes.recent },
      ],
      { width: pageWidth, gap: 32 },
    );
    const list = stack(
      sketches!.length ? sketches!.map((s) => ({ id: s.id, size: sizes[s.id] })) : [{ id: "empty", size: sizes.empty }],
      { width: pageWidth, gap: 8, top: top.bottom + 12 },
    );
    return { ...top.places, ...list.places };
  }

  return (
    <main className="h-dvh w-full">
      <FreeCanvas layoutId="home" pieces={pieces} firstLayout={firstLayout} />
    </main>
  );
}

/** A sketch on the home page. Opens the sketch; drag it to put it anywhere. */
function SketchRow({ sketch }: { sketch: Sketch }) {
  return (
    <Link
      href={`/s/${sketch.id}`}
      className="group flex items-center gap-3 rounded-2xl bg-surface p-2 transition duration-300 ease-soft hover:bg-raised active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-melody text-canvas" aria-hidden>
        <MusicNotes size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold text-ink">{sketch.title}</span>
        <span className="font-mono text-xs text-ink-muted">{updatedAtFormat.format(sketch.updatedAt)}</span>
      </span>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-ink transition duration-300 ease-soft group-hover:bg-line" aria-hidden>
        <CaretRight size={16} />
      </span>
    </Link>
  );
}
