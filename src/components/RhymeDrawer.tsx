"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { fetchRhymes, type Rhymes } from "@/lyrics/rhymes";

type Props = { word: string; onPick: (rhyme: string) => void; onClose: () => void };
type State = { status: "loading" } | { status: "error" } | { status: "ready"; rhymes: Rhymes };

const chip =
  "rounded-lg bg-surface px-3 py-2 text-base text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function RhymeDrawer({ word, onPick, onClose }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const panel = useRef<HTMLElement>(null);

  // Keyboard users land on the first rhyme; picking one puts focus back in the editor at the saved cursor.
  useEffect(() => {
    if (state.status === "ready") panel.current?.querySelector<HTMLButtonElement>("li button")?.focus();
  }, [state.status]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRhymes(word, controller.signal)
      .then((rhymes) => setState({ status: "ready", rhymes }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setState({ status: "error" });
        return e;
      });
    return () => controller.abort();
  }, [word, attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <aside
      ref={panel}
      aria-label={`Rhymes for ${word}`}
      className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-h-96 w-full max-w-2xl flex-col gap-3 rounded-t-2xl border border-line bg-raised p-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Rhymes for &ldquo;{word}&rdquo;</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-10 items-center justify-center rounded-lg text-ink-muted transition duration-300 ease-soft hover:bg-surface hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-ink"
        >
          <X size={20} aria-hidden />
          <span className="sr-only">Close rhymes</span>
        </button>
      </header>
      <div className="flex flex-col gap-4 overflow-y-auto">
        {state.status === "loading" && (
          <div className="flex flex-wrap gap-2" aria-hidden>
            {["w-16", "w-12", "w-20", "w-12", "w-16", "w-10"].map((w, i) => (
              <span key={i} className={`h-10 animate-pulse rounded-lg bg-surface ${w}`} />
            ))}
          </div>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm text-ink-muted">
            Couldn&apos;t reach the rhyme dictionary. Check your connection, then{" "}
            <button
              type="button"
              onClick={retry}
              className="rounded-sm font-semibold text-ink underline underline-offset-4 transition duration-300 ease-soft hover:text-ink-muted active:scale-98 focus-visible:outline-2 focus-visible:outline-ink"
            >
              try again
            </button>
            .
          </p>
        )}
        {state.status === "ready" &&
          (state.rhymes.perfect.length + state.rhymes.near.length === 0 ? (
            <p className="text-sm text-ink-muted">No rhymes found for this word. Try another word in the line.</p>
          ) : (
            <>
              <RhymeGroup title="Rhymes" words={state.rhymes.perfect} onPick={onPick} />
              <RhymeGroup title="Close" words={state.rhymes.near} onPick={onPick} />
            </>
          ))}
      </div>
    </aside>
  );
}

function RhymeGroup({ title, words, onPick }: { title: string; words: string[]; onPick: (w: string) => void }) {
  if (!words.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-ink-muted uppercase">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {words.map((w) => (
          <li key={w}>
            {/* mousedown default would steal focus from the editor and lose the cursor */}
            <button type="button" className={chip} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(w)}>
              {w}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
