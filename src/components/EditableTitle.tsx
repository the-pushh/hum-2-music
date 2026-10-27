"use client";

import { useRef, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";

/** The sketch title, renamed in place: Enter or leaving the field saves, Escape cancels. */
export function EditableTitle({ title, onRename }: { title: string; onRename: (title: string) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  async function commit() {
    if (draft === null || cancelled.current) return;
    const next = draft.trim();
    setDraft(null);
    if (next && next !== title) await onRename(next);
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            cancelled.current = true;
            setDraft(null);
          }
        }}
        aria-label="Sketch name"
        maxLength={80}
        className="w-full rounded-lg bg-surface px-2 text-3xl font-semibold text-ink focus-visible:outline-2 focus-visible:outline-ink"
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-3xl font-semibold text-ink">{title}</h1>
      <button
        type="button"
        onClick={() => {
          cancelled.current = false;
          setDraft(title);
        }}
        aria-label="Rename sketch"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition duration-300 ease-soft hover:bg-surface hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-ink"
      >
        <PencilSimple size={20} aria-hidden />
      </button>
    </div>
  );
}
