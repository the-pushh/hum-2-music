"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight } from "@phosphor-icons/react";
import { sketchStore } from "@/sketches/client";
import { CaptureBar } from "./CaptureBar";

const updatedAtFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function CaptureHome() {
  const router = useRouter();
  const sketches = useLiveQuery(() => sketchStore().listSketches(), []);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8">
      <header>
        <p className="text-sm font-semibold text-ink-muted">hum</p>
        <h1 className="text-3xl font-semibold text-ink">Catch it before it goes</h1>
      </header>

      <CaptureBar openSketchId={null} onCaptured={(sketch) => router.push(`/s/${sketch.id}`)} />

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
          <div className="rounded-2xl border border-line p-6">
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
                  className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 transition duration-300 ease-soft hover:bg-raised active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="flex flex-col">
                    <span className="text-base font-semibold text-ink">{s.title}</span>
                    <span className="text-sm text-ink-muted">Updated {updatedAtFormat.format(s.updatedAt)}</span>
                  </span>
                  <CaretRight size={20} className="text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
