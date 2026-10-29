"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, MusicNotes, PencilSimple, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { deleteIdea, deleteSketch, sketchStore } from "@/sketches/client";
import type { Idea } from "@/sketches/types";
import { ArrangeList } from "./ArrangeList";
import { Button } from "./Button";
import { CaptureBar } from "./CaptureBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditableTitle } from "./EditableTitle";
import { FreeCanvas } from "./FreeCanvas";
import { IdeaCard } from "./IdeaCard";
import { ideaSummary } from "./ideaSummary";

/** " and its 1 idea" / " and all 3 of its ideas" / "" for an empty sketch. */
function andItsIdeas(n: number) {
  if (n === 0) return "";
  return n === 1 ? " and its 1 idea" : ` and all ${n} of its ideas`;
}

export function SketchScreen({ id }: { id: string }) {
  // null means "looked and it isn't there"; undefined means still loading.
  const sketch = useLiveQuery(async () => (await sketchStore().getSketch(id)) ?? null, [id]);
  const ideas = useLiveQuery(() => sketchStore().listIdeas(id), [id]);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<{ kind: "idea"; idea: Idea } | { kind: "sketch" } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  /** Runs a change to the sketch, showing an inline message if this browser's storage refuses it. */
  async function attempt(change: () => Promise<void>, failure: string) {
    setActionError(null);
    try {
      await change();
    } catch {
      setActionError(failure);
    }
  }

  async function confirmDelete() {
    if (!confirming) return;
    setConfirming(null);
    if (confirming.kind === "idea") {
      const { idea } = confirming;
      return attempt(() => deleteIdea(idea.id), "That idea couldn't be deleted. Try again.");
    }
    // Navigation doesn't wait, so mark the page as leaving: it mustn't flash "This sketch isn't here" meanwhile.
    setLeaving(true);
    router.replace("/");
    await deleteSketch(id).catch(() => {
      setLeaving(false);
      setActionError("The sketch couldn't be deleted. Try again.");
    });
  }

  if (leaving) return <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy />;

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
    <main className="flex h-dvh w-full flex-col gap-6 pt-8 pb-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4">
        <header className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-lg py-1 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ArrowLeft size={16} aria-hidden />
            All sketches
          </Link>
          {sketch ? (
            <EditableTitle
              title={sketch.title}
              onRename={(title) => attempt(() => sketchStore().renameSketch(id, title), "The new name couldn't be saved. Try again.")}
            />
          ) : (
            <div className="h-8 w-1/2 animate-pulse rounded-lg bg-surface" aria-hidden />
          )}
        </header>

        <div className="w-full max-w-xl">
          <CaptureBar openSketchId={id} />
        </div>
      </div>

      <section aria-label="Ideas" className="flex min-h-0 flex-1 flex-col gap-3 px-4">
        {actionError && (
          <p role="alert" className="mx-auto w-full max-w-5xl text-sm text-accent">
            {actionError}
          </p>
        )}
        {sketch && (
          <div className="mx-auto flex w-full max-w-5xl justify-end gap-2">
            {!editing && (
              <Link
                href={`/s/${id}/studio`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-melody py-2 pr-4 pl-3 text-base font-semibold text-canvas transition duration-300 ease-soft hover:opacity-90 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <MusicNotes size={20} aria-hidden />
                Open in studio
              </Link>
            )}
            {editing && (
              <Button variant="ghost" onClick={() => setConfirming({ kind: "sketch" })}>
                <Trash size={20} aria-hidden />
                Delete sketch
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              {editing ? <Check size={20} aria-hidden /> : <PencilSimple size={20} aria-hidden />}
              {editing ? "Done" : "Edit"}
            </Button>
          </div>
        )}
        {ideas === undefined ? (
          <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <div className="mx-auto w-full max-w-5xl rounded-2xl bg-surface p-6">
            <p className="text-base text-ink">Nothing in this sketch yet.</p>
            <p className="text-sm text-ink-muted">Write lyrics, hum a melody or beatbox a beat to start collecting the pieces of this song.</p>
          </div>
        ) : editing ? (
          <div className="mx-auto w-full max-w-5xl overflow-y-auto">
            <div className="w-full max-w-xl">
              <ArrangeList
                ideas={ideas}
                onMove={(ideaId, to) =>
                  attempt(() => sketchStore().moveIdea(ideaId, to), "The new order couldn't be saved. Try moving it again.")
                }
                onDelete={(idea) => setConfirming({ kind: "idea", idea })}
              />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <FreeCanvas
              items={ideas}
              label={(idea) => ideaSummary(idea).label}
              render={(idea) => <IdeaCard data={idea} />}
              onPlace={(ideaId, place) =>
                attempt(() => sketchStore().placeIdea(ideaId, place), "That card's new spot couldn't be saved. Try moving it again.")
              }
              onLayOut={(places) => attempt(() => sketchStore().layOutIdeas(places), "The cards' places couldn't be saved.")}
            />
          </div>
        )}
      </section>
      {confirming && (
        <ConfirmDialog
          {...(confirming.kind === "idea"
            ? {
                title: "Delete this idea?",
                body: `"${ideaSummary(confirming.idea).label}" will be removed from this sketch. This can't be undone.`,
                confirmLabel: "Delete idea",
              }
            : {
                title: "Delete this sketch?",
                body: `"${sketch?.title}"${andItsIdeas(ideas?.length ?? 0)} will be removed. This can't be undone.`,
                confirmLabel: "Delete sketch",
              })}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirming(null)}
        />
      )}
    </main>
  );
}
