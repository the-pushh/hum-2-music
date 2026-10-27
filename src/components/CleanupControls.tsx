"use client";

import { useState } from "react";
import { changeCleanup, takeOf } from "@/melody/client";
import type { CleanupSettings, Grid } from "@/melody/types";
import type { VoiceIdea } from "@/sketches/types";

type Option<T> = { value: T; label: string };

/** A row of mutually exclusive choices, like a segmented control. */
function Choice<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-raised p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => o.value !== value && onChange(o.value)}
          className="rounded-md px-2 py-1 text-xs font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:bg-line aria-pressed:text-ink"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Raw or clean notes, key snapping, and the grid for click takes. Each change re-runs cleanup straight away. */
export function CleanupControls({ idea }: { idea: VoiceIdea }) {
  const [error, setError] = useState(false);
  const t = idea.transcription;
  if (t?.status !== "done") return null;

  function change(changes: Partial<CleanupSettings> & { showRaw?: boolean }) {
    setError(false);
    changeCleanup(idea, changes).catch(() => setError(true));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Choice
        label="Notes"
        value={t.showRaw}
        onChange={(showRaw) => change({ showRaw })}
        options={[
          { value: false, label: "Clean" },
          { value: true, label: "Raw" },
        ]}
      />
      {!t.showRaw && (
        <Choice
          label="Snap to key"
          value={t.settings.snap}
          onChange={(snap) => change({ snap })}
          options={[
            { value: true, label: "Snap" },
            { value: false, label: "As sung" },
          ]}
        />
      )}
      {!t.showRaw && takeOf(idea).click && (
        <Choice<Grid>
          label="Grid"
          value={t.settings.grid}
          onChange={(grid) => change({ grid })}
          options={[
            { value: 8, label: "1/8" },
            { value: 16, label: "1/16" },
          ]}
        />
      )}
      {error && (
        <span role="alert" className="text-xs text-accent">
          Couldn&apos;t save that change.
        </span>
      )}
    </div>
  );
}
