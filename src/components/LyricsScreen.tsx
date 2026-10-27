"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { sketchStore } from "@/sketches/client";
import { LyricsEditor } from "./LyricsEditor";

/** Loads the lyrics idea once; after that the editor owns the document and saves it back. */
export function LyricsScreen({ sketchId, ideaId }: { sketchId: string; ideaId: string }) {
  // Only re-query when the id changes: re-feeding saved content into a live editor would fight the cursor.
  const idea = useLiveQuery(async () => (await sketchStore().getIdea(ideaId)) ?? null, [ideaId]);

  if (idea === undefined) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="h-32 animate-pulse rounded-2xl bg-surface" aria-hidden />
      </main>
    );
  }
  if (idea === null || idea.kind !== "lyrics") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">These lyrics aren&apos;t here</h1>
        <p className="text-base text-ink-muted">They may have been deleted, or they were saved in a different browser.</p>
        <Link
          href={`/s/${sketchId}`}
          className="w-fit rounded-lg text-base font-semibold text-ink underline underline-offset-4 transition duration-300 ease-soft hover:text-ink-muted active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Back to sketch
        </Link>
      </main>
    );
  }
  return <LyricsEditor key={idea.id} sketchId={sketchId} ideaId={idea.id} initial={idea.doc} />;
}
