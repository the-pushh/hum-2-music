"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { lyricsFromText } from "@/lyrics/doc";
import { captureIdea, sketchStore } from "@/sketches/client";
import type { Sketch } from "@/sketches/types";
import { ideaBg } from "@/ui/ideaColors";

const SAVE_DELAY_MS = 600;
type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * Lyrics written straight into capture, like a note: no button, saved as you type. The first line starts a lyrics Idea
 * (and, on the home screen, a Sketch) without leaving the page. Sections and rhymes are in the full editor, from the
 * lyrics card.
 */
export function LyricsNote({ openSketchId }: { openSketchId: string | null }) {
  const [text, setText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedTo, setSavedTo] = useState<Sketch | null>(null);
  const ideaId = useRef<string | null>(null);
  const creating = useRef<Promise<void> | null>(null);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function flush() {
    clearTimeout(timer.current);
    const latest = pending.current;
    if (latest === null) return;
    // The first save creates the Idea; later saves wait for it rather than creating a second one.
    if (creating.current) await creating.current;
    pending.current = null;
    const input = { kind: "lyrics" as const, doc: lyricsFromText(latest) };
    try {
      if (ideaId.current) {
        await sketchStore().updateIdea(ideaId.current, input);
      } else if (latest.trim()) {
        creating.current = captureIdea(openSketchId, input).then(({ sketch, idea }) => {
          ideaId.current = idea.id;
          setSavedTo(sketch);
        });
        await creating.current;
        creating.current = null;
      }
      setSaveState((s) => (pending.current !== null ? s : ideaId.current ? "saved" : "idle"));
    } catch {
      creating.current = null;
      setSaveState("failed");
    }
  }

  // Save what's still pending when capture closes, or when a phone hides the page (it may never come back).
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

  function change(next: string) {
    setText(next);
    pending.current = next;
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  return (
    <div className={`flex w-full flex-col gap-2 rounded-2xl p-3 text-canvas ${ideaBg.lyrics}`}>
      <label htmlFor="lyrics-note" className="px-1 text-xs font-semibold uppercase opacity-70">
        Lyrics
      </label>
      <textarea
        id="lyrics-note"
        value={text}
        onChange={(e) => change(e.target.value)}
        placeholder="Write a line…"
        rows={Math.max(4, text.split("\n").length + 1)}
        spellCheck
        className="w-full resize-none rounded-sm bg-canvas/10 p-3 text-lg leading-relaxed placeholder:text-canvas/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas"
      />
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 px-1 text-xs" aria-live="polite">
        <span className={saveState === "failed" ? "font-semibold" : "opacity-70"}>
          {saveState === "failed"
            ? "Couldn't save. Keep this page open and try typing again."
            : saveState === "saving"
              ? "Saving"
              : saveState === "saved"
                ? "Saved"
                : "Saved as you type"}
        </span>
        {savedTo && !openSketchId && (
          <Link
            href={`/s/${savedTo.id}`}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-canvas/10 px-3 text-sm font-semibold transition duration-300 ease-soft hover:bg-canvas/20 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas"
          >
            In {savedTo.title}
            <ArrowRight size={12} aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
