"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, CaretDown, MusicNotes } from "@phosphor-icons/react";
import { playMelody } from "@/audio/takePlayer";
import { defaultInstrument, instruments } from "@/instruments/instruments";
import { isTranscribing, takeOf, transcribeIdea } from "@/melody/client";
import { keyName } from "@/melody/keyName";
import type { VoiceIdea } from "@/sketches/types";
import { Button } from "./Button";
import { CleanupControls } from "./CleanupControls";
import { NoteStrip } from "./NoteStrip";
import { InstrumentPrompt } from "./InstrumentPrompt";
import { PlayTakeButton } from "./PlayTakeButton";

/** The melody hum heard in a voice idea: transcription status, key and notes. */
export function MelodyPanel({ idea }: { idea: VoiceIdea }) {
  const t = idea.transcription;
  const [changingInstrument, setChangingInstrument] = useState(false);
  const instrument = idea.instrument ?? defaultInstrument;

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

  if (t.kind === "beat") return null;
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
      {!idea.instrument || changingInstrument ? (
        <InstrumentPrompt idea={idea} onDone={() => setChangingInstrument(false)} />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PlayTakeButton
            label={`Play as ${instruments[instrument].label.toLowerCase()}`}
            instrument={instruments[instrument].label.toLowerCase()}
            play={(onEnded) => playMelody(notes, takeOf(idea).bpm, instrument, onEnded)}
          />
          {idea.instrument && !changingInstrument && (
            <button
              type="button"
              onClick={() => setChangingInstrument(true)}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-canvas/10 px-3 text-sm font-semibold transition duration-300 ease-soft hover:bg-canvas/20 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas"
            >
              Plays as {instruments[idea.instrument].label}
              <CaretDown size={12} aria-hidden />
              <span className="sr-only">, change instrument</span>
            </button>
          )}
        </div>
        <CleanupControls idea={idea} />
      </div>
    </div>
  );
}
