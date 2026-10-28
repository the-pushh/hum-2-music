"use client";

import { useState } from "react";
import { LinkSimple } from "@phosphor-icons/react";
import { parseLink, type LinkTarget } from "@/links/parseLink";
import { Button } from "./Button";
import { IdeaChip } from "./IdeaChip";

export function LinkComposer({ onSave }: { onSave: (target: LinkTarget) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <IdeaChip kind="link" icon={<LinkSimple size={16} />} onClick={() => setOpen(true)}>
        Link
      </IdeaChip>
    );
  }

  async function save() {
    const target = parseLink(text);
    if (!target) {
      setError("That isn't a web address. Paste a link like https://example.com/song");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(target);
      setText("");
      setOpen(false);
    } catch {
      setError("Couldn't save the link. Your text is still here, try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      // parseLink validates, and accepts bare addresses ("youtu.be/…") that the browser's url check would block.
      noValidate
      className="flex w-full flex-col gap-3 rounded-2xl bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor="link-url" className="sr-only">
        Link
      </label>
      <input
        id="link-url"
        type="url"
        inputMode="url"
        autoFocus
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Paste a YouTube, Spotify or any web link"
        className="w-full rounded-lg bg-raised p-3 text-base text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"
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
          {saving ? "Saving" : "Save link"}
        </Button>
      </div>
    </form>
  );
}
