"use client";

import { useState } from "react";
import { NotePencil } from "@phosphor-icons/react";
import { Button } from "./Button";

type Props = { onSave: (text: string) => Promise<void> };

export function NoteComposer({ onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <NotePencil size={20} aria-hidden />
        Note
      </Button>
    );
  }

  async function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setText("");
      setOpen(false);
    } catch {
      setError("Couldn't save the note. Your text is still here, try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex w-full flex-col gap-3 rounded-2xl bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor="note-text" className="sr-only">
        Note
      </label>
      <textarea
        id="note-text"
        autoFocus
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="A feeling, a title, a production thought"
        className="w-full resize-none rounded-lg bg-raised p-3 text-base text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"
      />
      {error && (
        <p role="alert" className="px-2 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={!text.trim() || saving}>
          {saving ? "Saving" : "Save note"}
        </Button>
      </div>
    </form>
  );
}
