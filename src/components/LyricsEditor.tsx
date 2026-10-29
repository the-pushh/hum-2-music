"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, MusicNotes, Plus } from "@phosphor-icons/react";
import { SectionNode } from "@/lyrics/SectionNode";
import { SyllableCounts } from "@/lyrics/SyllableCounts";
import { wordAtCursor } from "@/lyrics/wordAtCursor";
import { sketchStore } from "@/sketches/client";
import type { LyricsDoc, LyricsInput } from "@/sketches/types";
import { Button } from "./Button";
import { RhymeDrawer } from "./RhymeDrawer";

const SAVE_DELAY_MS = 600;
type SaveState = "saved" | "saving" | "failed";

export function LyricsEditor({ sketchId, ideaId, initial }: { sketchId: string; ideaId: string; initial: LyricsDoc }) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [rhymeWord, setRhymeWord] = useState<string | null>(null);
  const [cursorWord, setCursorWord] = useState("");
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
    onSelectionUpdate: ({ editor }) => setCursorWord(wordAtCursor(editor)),
    onUpdate: ({ editor }) => {
      pending.current = editor.getJSON() as LyricsDoc;
      setSaveState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
  });

  // Save whatever is still pending when leaving the editor, closing the tab, or when a phone hides the page
  // (it may never come back to run the debounce).
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Puts the rhyme at the cursor, replacing a selection, with a space if it would touch the previous word. */
  function insertRhyme(rhyme: string) {
    if (!editor) return;
    const { from, to, $from } = editor.state.selection;
    const charBefore = $from.parent.textContent.slice(0, $from.parentOffset).slice(-1);
    const text = from === to && charBefore && !/\s/.test(charBefore) ? ` ${rhyme}` : rhyme;
    editor.chain().focus().insertContentAt({ from, to }, text).run();
  }

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
          Back to idea
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
      <div className="flex flex-wrap gap-2">
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
        <Button
          variant="secondary"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setRhymeWord(cursorWord)}
          disabled={!cursorWord}
          title={cursorWord ? undefined : "Put the cursor on a word to find rhymes"}
        >
          <MusicNotes size={20} aria-hidden />
          {cursorWord ? `Rhymes for ${cursorWord}` : "Rhymes"}
        </Button>
      </div>
      {rhymeWord && (
        <>
          {/* Room to scroll the last lines above the drawer. */}
          <div className="h-96 shrink-0" aria-hidden />
          <RhymeDrawer
            key={rhymeWord}
            word={rhymeWord}
            onPick={insertRhyme}
            onClose={() => {
              setRhymeWord(null);
              // After the drawer (which holds focus) is gone, back to the cursor where it was.
              setTimeout(() => editor?.commands.focus(), 0);
            }}
          />
        </>
      )}
    </main>
  );
}
