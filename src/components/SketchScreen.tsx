"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Masonry } from "masonic";
import { ArrowLeft } from "@phosphor-icons/react";
import { sketchStore } from "@/sketches/client";
import { IdeaCard } from "./IdeaCard";
import { CaptureBar } from "./CaptureBar";

export function SketchScreen({ id }: { id: string }) {
  // null means "looked and it isn't there"; undefined means still loading.
  const sketch = useLiveQuery(async () => (await sketchStore().getSketch(id)) ?? null, [id]);
  const ideas = useLiveQuery(() => sketchStore().listIdeas(id), [id]);

  if (sketch === null) {
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-lg py-1 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          All sketches
        </Link>
        {sketch ? (
          <h1 className="text-3xl font-semibold text-ink">{sketch.title}</h1>
        ) : (
          <div className="h-8 w-1/2 animate-pulse rounded-lg bg-surface" aria-hidden />
        )}
      </header>

      <div className="w-full max-w-xl">
        <CaptureBar openSketchId={id} />
      </div>

      <section aria-label="Ideas">
        {ideas === undefined ? (
          <div className="grid grid-cols-2 gap-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <div className="rounded-2xl border border-line p-6">
            <p className="text-base text-ink">Nothing in this sketch yet.</p>
            <p className="text-sm text-ink-muted">Record a hum or add a note to start collecting the pieces of this song.</p>
          </div>
        ) : (
          <Masonry
            key={ideas.map((i) => i.id).join()}
            items={ideas}
            itemKey={(idea) => idea.id}
            render={IdeaCard}
            columnWidth={240}
            columnGutter={12}
          />
        )}
      </section>
    </main>
  );
}
