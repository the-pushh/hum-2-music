"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, Plus } from "@phosphor-icons/react";
import { SectionNode } from "@/lyrics/SectionNode";
import { SyllableCounts } from "@/lyrics/SyllableCounts";
import { sketchStore } from "@/sketches/client";
import type { LyricsDoc, LyricsInput } from "@/sketches/types";
import { Button } from "./Button";

const SAVE_DELAY_MS = 600;
type SaveState = "saved" | "saving" | "failed";

export function LyricsEditor({ sketchId, ideaId, initial }: { sketchId: string; ideaId: string; initial: LyricsDoc }) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const pending = useRef<LyricsDoc | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function flush() {
    clearTimeout(timer.current);
    const doc = pending.current;
    if (!doc) return;
    pending.current = null;
    const input: LyricsInput = { kind: "lyrics", doc };
    try {
      await sketchStore().updateIdea(ideaId, input);
      setSaveState((s) => (pending.current ? s : "saved"));
    } catch {
      setSaveState("failed");
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: "end",
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        italic: false,
        strike: false,
        link: false,
        underline: false,
        // Lines live inside sections; a trailing top-level paragraph would let typing escape them.
        trailingNode: false,
      }),
      SectionNode,
      SyllableCounts,
    ],
    content: initial as JSONContent,
    editorProps: { attributes: { "aria-label": "Lyrics", spellcheck: "true" } },
    onUpdate: ({ editor }) => {
      pending.current = editor.getJSON() as LyricsDoc;
      setSaveState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
  });

  // Save whatever is still pending when leaving the editor.
  useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function addSection() {
    if (!editor) return;
    const end = editor.state.doc.content.size;
    // +2 steps inside the new section and its first line, so typing lands there.
    editor
      .chain()
      .insertContentAt(end, { type: "section", attrs: { part: "chorus" }, content: [{ type: "paragraph" }] })
      .focus(end + 2)
      .run();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <Link
          href={`/s/${sketchId}`}
          className="inline-flex items-center gap-2 rounded-lg py-1 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to sketch
        </Link>
        <span role="status" className={`text-sm ${saveState === "failed" ? "text-accent" : "text-ink-muted"}`}>
          {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Couldn't save. Keep this page open and try typing again."}
        </span>
      </header>
      <h1 className="sr-only">Lyrics</h1>
      {editor ? (
        <EditorContent editor={editor} className="lyrics" />
      ) : (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" aria-hidden />
      )}
      <Button
        variant="secondary"
        className="w-fit"
        // Keep focus in the editor so the new section's first line gets the cursor.
        onMouseDown={(e) => e.preventDefault()}
        onClick={addSection}
        disabled={!editor}
      >
        <Plus size={20} aria-hidden />
        Add section
      </Button>
    </main>
  );
}
