"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight, MusicNotes } from "@phosphor-icons/react";
import { sketchStore } from "@/sketches/client";
import { CaptureBar } from "./CaptureBar";

const updatedAtFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function CaptureHome() {
  const sketches = useLiveQuery(() => sketchStore().listSketches(), []);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col items-start gap-3">
        <span className="inline-flex h-8 items-center rounded-lg bg-raised px-2 font-mono text-sm text-ink">hum</span>
        <h1 className="text-3xl font-semibold text-ink">Catch it before it goes</h1>
      </header>

      <CaptureBar openSketchId={null} />

      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <h2 id="recent" className="text-sm font-semibold text-ink-muted">
          Recent sketches
        </h2>
        {sketches === undefined ? (
          <ul className="flex flex-col gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
            ))}
          </ul>
        ) : sketches.length === 0 ? (
          <div className="rounded-2xl bg-surface p-6">
            <p className="text-base text-ink">No sketches yet.</p>
            <p className="text-sm text-ink-muted">
              Record a hum or save a note above and hum starts a sketch for it. Everything you add later collects there.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sketches.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/s/${s.id}`}
                  className="group flex items-center gap-3 rounded-2xl bg-surface p-2 transition duration-300 ease-soft hover:bg-raised active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-melody text-canvas" aria-hidden>
                    <MusicNotes size={20} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-semibold text-ink">{s.title}</span>
                    <span className="font-mono text-xs text-ink-muted">{updatedAtFormat.format(s.updatedAt)}</span>
                  </span>
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-ink transition duration-300 ease-soft group-hover:bg-line" aria-hidden>
                    <CaretRight size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
