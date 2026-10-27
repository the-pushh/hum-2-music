"use client";

import { captureIdea } from "@/sketches/client";
import type { IdeaInput, Sketch } from "@/sketches/types";
import { NoteComposer } from "./NoteComposer";
import { Recorder } from "./Recorder";

type Props = {
  /** The sketch being viewed, or null on the home screen (a capture then starts a new sketch). */
  openSketchId: string | null;
  onCaptured?: (sketch: Sketch) => void;
};

/** Every way to add an idea, shared by the home screen and the sketch page. */
export function CaptureBar({ openSketchId, onCaptured }: Props) {
  async function save(input: IdeaInput, stillMounted = true) {
    const { sketch } = await captureIdea(openSketchId, input);
    if (stillMounted) onCaptured?.(sketch);
  }

  return (
    <section aria-label="Capture" className="flex w-full flex-col items-center gap-6">
      <Recorder onSave={save} />
      <div className="w-full">
        <NoteComposer onSave={(text) => save({ kind: "note", text })} />
      </div>
    </section>
  );
}
