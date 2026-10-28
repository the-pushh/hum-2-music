"use client";

import { useState } from "react";
import { changeCleanup, takeOf } from "@/melody/client";
import type { CleanupSettings, Grid } from "@/melody/types";
import type { VoiceIdea } from "@/sketches/types";
import { Choice } from "./Choice";

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
        <span role="alert" className="text-xs font-semibold">
          Couldn&apos;t save that change.
        </span>
      )}
    </div>
  );
}
