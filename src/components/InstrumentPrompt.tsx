"use client";

import { useState } from "react";
import { instrumentIds, instruments, type InstrumentId } from "@/instruments/instruments";
import { sketchStore } from "@/sketches/client";
import type { VoiceIdea } from "@/sketches/types";

/** A pill on the bright melody card: dark when chosen, faint dark otherwise. */
const chip =
  "inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition duration-300 ease-soft active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas aria-pressed:bg-canvas aria-pressed:text-ink";

/**
 * "What should it play as?" on a melody card: asked once its notes are ready, and again whenever the songwriter taps
 * the instrument to change it.
 */
export function InstrumentPrompt({ idea, onDone }: { idea: VoiceIdea; onDone?: () => void }) {
  const [error, setError] = useState<string | null>(null);

  async function choose(instrument: InstrumentId) {
    setError(null);
    try {
      await sketchStore().setInstrument(idea.id, instrument);
      onDone?.();
    } catch {
      setError("That choice couldn't be saved. Try again.");
    }
  }

  return (
    <div role="group" aria-labelledby={`plays-as-${idea.id}`} className="flex flex-col gap-2 rounded-lg bg-canvas/10 p-2">
      <span id={`plays-as-${idea.id}`} className="px-1 text-sm font-semibold">
        What should it play as?
      </span>
      <div className="flex flex-wrap gap-1">
        {instrumentIds.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={idea.instrument === id}
            onClick={() => void choose(id)}
            className={`${chip} bg-canvas/10 hover:bg-canvas/20`}
          >
            {instruments[id].label}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="px-1 text-xs font-semibold">
          {error}
        </span>
      )}
    </div>
  );
}
