"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { MusicNotes } from "@phosphor-icons/react";
import { useState } from "react";
import { sketchStore } from "@/sketches/client";
import type { Sketch } from "@/sketches/types";
import { CaptureBar } from "./CaptureBar";
import { FreeCanvas } from "./FreeCanvas";

const updatedAtFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function CaptureHome() {
  const sketches = useLiveQuery(() => sketchStore().listSketches(), []);
  const [error, setError] = useState<string | null>(null);

  /** Saves a card's place, showing an inline message if this browser's storage refuses it. */
  async function attempt(change: () => Promise<void>, failure: string) {
    setError(null);
    try {
      await change();
    } catch {
      setError(failure);
    }
  }

  return (
    <main className="flex h-dvh w-full flex-col gap-8 pt-8 pb-4">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4">
        <header className="flex flex-col items-start gap-3">
          <span className="inline-flex h-8 items-center rounded-lg bg-raised px-2 font-mono text-sm text-ink">hum</span>
          <h1 className="text-3xl font-semibold text-ink">Catch it before it goes</h1>
        </header>

        <CaptureBar openSketchId={null} />
      </div>

      <section aria-labelledby="sketches" className="flex min-h-0 flex-1 flex-col gap-3 px-4">
        <h2 id="sketches" className="mx-auto w-full max-w-xl text-sm font-semibold text-ink-muted">
          Your sketches
        </h2>
        {error && (
          <p role="alert" className="mx-auto w-full max-w-xl text-sm text-accent">
            {error}
          </p>
        )}
        {sketches === undefined ? (
          <ul className="mx-auto flex w-full max-w-xl flex-col gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
            ))}
          </ul>
        ) : sketches.length === 0 ? (
          <div className="mx-auto w-full max-w-xl rounded-2xl bg-surface p-6">
            <p className="text-base text-ink">No sketches yet.</p>
            <p className="text-sm text-ink-muted">
              Write lyrics, hum a melody or beatbox a beat above, and hum starts a sketch for it. Everything you add later collects there.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <FreeCanvas
              items={sketches}
              label={(sketch) => sketch.title}
              render={(sketch) => <SketchCard sketch={sketch} />}
              onPlace={(id, place) =>
                attempt(() => sketchStore().placeSketch(id, place), "That sketch's new spot couldn't be saved. Try moving it again.")
              }
              onLayOut={(places) => attempt(() => sketchStore().layOutSketches(places), "The sketches' places couldn't be saved.")}
            />
          </div>
        )}
      </section>
    </main>
  );
}

/** A sketch on the home canvas. Opens the sketch; drag it to put it anywhere. */
function SketchCard({ sketch }: { sketch: Sketch }) {
  return (
    <Link
      href={`/s/${sketch.id}`}
      className="flex items-center gap-3 rounded-2xl bg-surface p-2 transition duration-300 ease-soft hover:bg-raised active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-melody text-canvas" aria-hidden>
        <MusicNotes size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold text-ink">{sketch.title}</span>
        <span className="font-mono text-xs text-ink-muted">{updatedAtFormat.format(sketch.updatedAt)}</span>
      </span>
    </Link>
  );
}
