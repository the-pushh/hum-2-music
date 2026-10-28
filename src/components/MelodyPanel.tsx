"use client";

import { useEffect } from "react";
import { ArrowClockwise, MusicNotes } from "@phosphor-icons/react";
import { isTranscribing, takeOf, transcribeIdea } from "@/melody/client";
import { keyName } from "@/melody/keyName";
import type { VoiceIdea } from "@/sketches/types";
import { Button } from "./Button";
import { CleanupControls } from "./CleanupControls";
import { NoteStrip } from "./NoteStrip";
import { PianoButton } from "./PianoButton";

/** The melody hum heard in a voice idea: transcription status, key and notes. */
export function MelodyPanel({ idea }: { idea: VoiceIdea }) {
  const t = idea.transcription;

  // A transcription left pending by a closed tab or reload never finishes on its own: start it again.
  useEffect(() => {
    if (t?.status === "pending" && !isTranscribing(idea.id)) void transcribeIdea(idea);
  }, [t?.status, idea.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) {
    return (
      <Button variant="secondary" className="self-start text-sm" onClick={() => void transcribeIdea(idea)}>
        <MusicNotes size={16} aria-hidden />
        Transcribe
      </Button>
    );
  }

  if (t.status === "pending") {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <div className="h-12 w-full animate-pulse rounded-sm bg-canvas/10" aria-hidden />
        <span className="text-xs opacity-70">Hearing the notes</span>
      </div>
    );
  }

  if (t.status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <span role="alert" className="text-xs font-semibold">
          {t.error}
        </span>
        <Button variant="secondary" className="text-sm" onClick={() => void transcribeIdea(idea)}>
          <ArrowClockwise size={16} aria-hidden />
          Try again
        </Button>
      </div>
    );
  }

  const notes = t.showRaw ? t.raw : t.clean;
  if (!t.raw.length) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs opacity-70">No notes heard. Try humming closer to the mic.</span>
        <Button variant="secondary" className="text-sm" onClick={() => void transcribeIdea(idea)}>
          <ArrowClockwise size={16} aria-hidden />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold">{keyName(t.key)}</span>
        <span className="opacity-70 tabular-nums">{notes.length} notes</span>
      </div>
      <NoteStrip notes={notes} label={`${notes.length} notes in ${keyName(t.key)}`} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PianoButton notes={notes} bpm={takeOf(idea).bpm} />
        <CleanupControls idea={idea} />
      </div>
    </div>
  );
}
