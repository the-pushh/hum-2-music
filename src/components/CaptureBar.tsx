"use client";

import { useRouter } from "next/navigation";
import { TextAa } from "@phosphor-icons/react";
import { emptyLyrics } from "@/lyrics/doc";
import { captureIdea } from "@/sketches/client";
import type { IdeaInput } from "@/sketches/types";
import { Button } from "./Button";
import { ImagePicker } from "./ImagePicker";
import { NoteComposer } from "./NoteComposer";
import { Recorder } from "./Recorder";

type Props = {
  /** The sketch being viewed, or null on the home screen (a capture then starts a new sketch and opens it). */
  openSketchId: string | null;
};

/** Every way to add an idea, shared by the home screen and the sketch page. */
export function CaptureBar({ openSketchId }: Props) {
  const router = useRouter();

  async function save(input: IdeaInput, stillMounted = true) {
    const { sketch } = await captureIdea(openSketchId, input);
    if (stillMounted && !openSketchId) router.push(`/s/${sketch.id}`);
  }

  async function writeLyrics() {
    const { sketch, idea } = await captureIdea(openSketchId, { kind: "lyrics", doc: emptyLyrics() });
    router.push(`/s/${sketch.id}/lyrics/${idea.id}`);
  }

  return (
    <section aria-label="Capture" className="flex w-full flex-col items-center gap-6">
      <Recorder onSave={save} />
      <div className="flex w-full flex-wrap gap-2">
        <NoteComposer onSave={(text) => save({ kind: "note", text })} />
        <Button variant="secondary" onClick={() => void writeLyrics()}>
          <TextAa size={20} aria-hidden />
          Lyrics
        </Button>
        <ImagePicker onSave={(image) => save(image)} />
      </div>
    </section>
  );
}
