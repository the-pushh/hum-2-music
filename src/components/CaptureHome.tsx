"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight, MusicNotes } from "@phosphor-icons/react";
import { sketchStore } from "@/sketches/client";
import type { Place, Sketch } from "@/sketches/types";
import { stack, type Size } from "@/ui/canvasLayout";
import { CaptureCard } from "./CaptureBar";
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
        <header className="flex flex-col items-start">
          <h1 className="font-mono text-xl font-bold text-ink">hum-2-music</h1>
        </header>
      ),
    },
    { id: "capture", label: "Capture", width: pageWidth, node: <CaptureCard openSketchId={null} /> },
    {
      id: "recent",
      label: "Recent ideas",
      width: pageWidth,
      node: (
        <section aria-labelledby="recent" className="flex flex-col gap-3">
          <h2 id="recent" className="text-sm font-semibold text-ink-muted">
            Recent ideas
          </h2>
          {sketches.length === 0 ? (
            <div className="rounded-2xl bg-surface p-6">
              <p className="text-base text-ink">No ideas yet.</p>
              <p className="text-sm text-ink-muted">
                Write lyrics, hum a melody or beatbox a beat above, and hum starts an idea for it. Everything you add later collects there.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {sketches.map((s) => (
                <li key={s.id}>
                  <SketchRow sketch={s} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ),
    },
  ];

  /** The page as it was: the intro, the capture bar, then the recent sketches. */
  function firstLayout(sizes: Record<string, Size>): Record<string, Place> {
    return stack(
      [
        { id: "intro", size: sizes.intro },
        { id: "capture", size: sizes.capture },
        { id: "recent", size: sizes.recent },
      ],
      { width: pageWidth, gap: 32 },
    ).places;
  }

  return (
    <main className="h-dvh w-full">
      <FreeCanvas layoutId="home" pieces={pieces} firstLayout={firstLayout} />
    </main>
  );
}

/** A sketch in the home page's list. Opens the sketch. */
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
