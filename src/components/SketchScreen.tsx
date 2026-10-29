"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, MusicNotes, PencilSimple, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { deleteIdea, deleteSketch, sketchStore } from "@/sketches/client";
import type { Idea, Place } from "@/sketches/types";
import { CARD_WIDTH, columnLayout, spanWidth, stack, type Size } from "@/ui/canvasLayout";
import { ArrangeList } from "./ArrangeList";
import { Button } from "./Button";
import { CaptureCard } from "./CaptureBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditableTitle } from "./EditableTitle";
import { FreeCanvas, useScreenWidth, type Piece } from "./FreeCanvas";
import { IdeaCard } from "./IdeaCard";
import { ideaSummary } from "./ideaSummary";

/** The page's widths before it was a canvas: max-w-5xl for the page, max-w-xl for the capture bar and the list. */
const PAGE_WIDTH = 1024;
const CAPTURE_WIDTH = 576;
const ARRANGE_WIDTH = 576;
/** The old grid's gutter. */
const IDEAS_GAP = 12;

/** Hums and beats take two columns of the grid: a waveform, what hum heard and their controls need the room. */
const columnsFor = (idea: Idea) => (idea.kind === "voice" ? 2 : 1);

/** " and its 1 take" / " and all 3 of its takes" / "" for an empty idea. */
function andItsIdeas(n: number) {
  if (n === 0) return "";
  return n === 1 ? " and its 1 take" : ` and all ${n} of its takes`;
}

export function SketchScreen({ id }: { id: string }) {
  // null means "looked and it isn't there"; undefined means still loading.
  const sketch = useLiveQuery(async () => (await sketchStore().getSketch(id)) ?? null, [id]);
  const ideas = useLiveQuery(() => sketchStore().listIdeas(id), [id]);
  const router = useRouter();
  // As wide as the page was: the screen less its gutters, up to max-w-5xl.
  const pageWidth = Math.min(useScreenWidth() - 32, PAGE_WIDTH);
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
      return attempt(() => deleteIdea(idea.id), "That take couldn't be deleted. Try again.");
    }
    // Navigation doesn't wait, so mark the page as leaving: it mustn't flash "This idea isn't here" meanwhile.
    setLeaving(true);
    router.replace("/");
    await deleteSketch(id).catch(() => {
      setLeaving(false);
      setActionError("The idea couldn't be deleted. Try again.");
    });
  }

  if (leaving) return <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy />;

  if (sketch === null) {
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

  if (sketch === undefined || ideas === undefined) return <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy />;

  const ideaPieces: Piece[] = editing
    ? [
        {
          id: "arrange",
          label: "Takes in order",
          width: Math.min(pageWidth, ARRANGE_WIDTH),
          node: (
            <ArrangeList
              ideas={ideas}
              onMove={(ideaId, to) =>
                attempt(() => sketchStore().moveIdea(ideaId, to), "The new order couldn't be saved. Try moving it again.")
              }
              onDelete={(idea) => setConfirming({ kind: "idea", idea })}
            />
          ),
        },
      ]
    : ideas.length === 0
      ? [
          {
            id: "empty",
            label: "Nothing in this idea yet",
            width: pageWidth,
            node: (
              <div className="rounded-2xl bg-surface p-6">
                <p className="text-base text-ink">Nothing in this idea yet.</p>
                <p className="text-sm text-ink-muted">Write lyrics, hum a melody or beatbox a beat to start collecting the pieces of this song.</p>
              </div>
            ),
          },
        ]
      : ideas.map((idea) => ({
          id: idea.id,
          label: ideaSummary(idea).label,
          width: Math.min(spanWidth(columnsFor(idea), IDEAS_GAP), pageWidth),
          node: <IdeaCard data={idea} />,
          arrives: "view" as const,
        }));

  const pieces: Piece[] = [
    {
      id: "title",
      label: "Title",
      width: pageWidth,
      node: (
        <header className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-lg py-1 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ArrowLeft size={16} aria-hidden />
            All ideas
          </Link>
          <EditableTitle
            title={sketch.title}
            onRename={(title) => attempt(() => sketchStore().renameSketch(id, title), "The new name couldn't be saved. Try again.")}
          />
        </header>
      ),
    },
    { id: "capture", label: "Capture", width: Math.min(pageWidth, CAPTURE_WIDTH), node: <CaptureCard openSketchId={id} /> },
    {
      id: "tools",
      label: "Idea tools",
      node: (
        <div className="flex gap-2">
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
              Delete idea
            </Button>
          )}
          <Button variant="ghost" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
            {editing ? <Check size={20} aria-hidden /> : <PencilSimple size={20} aria-hidden />}
            {editing ? "Done" : "Edit"}
          </Button>
        </div>
      ),
    },
    ...ideaPieces,
  ];

  /** The page as it was: title, capture bar, the tools on the right, then the ideas in columns. */
  function firstLayout(sizes: Record<string, Size>): Record<string, Place> {
    const top = stack(
      [
        { id: "title", size: sizes.title },
        { id: "capture", size: sizes.capture },
        { id: "tools", size: sizes.tools, align: "end" },
      ],
      { width: pageWidth, gap: 24 },
    );
    const ideasTop = top.bottom + IDEAS_GAP;
    const columns = Math.max(1, Math.floor((pageWidth + IDEAS_GAP) / (CARD_WIDTH + IDEAS_GAP)));
    return {
      ...top.places,
      arrange: { x: 0, y: ideasTop },
      empty: { x: 0, y: ideasTop },
      ...columnLayout(
        ideas!.map((i) => ({ id: i.id, h: sizes[i.id]?.h ?? 0, span: columnsFor(i) })),
        columns,
        { gap: IDEAS_GAP, top: ideasTop },
      ),
    };
  }

  return (
    <main className="h-dvh w-full">
      <FreeCanvas
        layoutId={`sketch:${id}`}
        pieces={pieces}
        firstLayout={firstLayout}
        overlay={
          actionError && (
            <p role="alert" className="absolute bottom-4 left-4 rounded-lg bg-raised px-3 py-2 text-sm text-accent">
              {actionError}
            </p>
          )
        }
      />
      {confirming && (
        <ConfirmDialog
          {...(confirming.kind === "idea"
            ? {
                title: "Delete this take?",
                body: `"${ideaSummary(confirming.idea).label}" will be removed from this idea. This can't be undone.`,
                confirmLabel: "Delete take",
              }
            : {
                title: "Delete this idea?",
                body: `"${sketch.title}"${andItsIdeas(ideas.length)} will be removed. This can't be undone.`,
                confirmLabel: "Delete idea",
              })}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirming(null)}
        />
      )}
    </main>
  );
}
