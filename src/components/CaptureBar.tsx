"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GridFour, MusicNotes, TextAa } from "@phosphor-icons/react";
import { finishTake } from "@/audio/finishTake";
import { useTranscribeProgress } from "@/melody/client";
import { captureIdea } from "@/sketches/client";
import type { IdeaInput } from "@/sketches/types";
import { beatBg, ideaBg } from "@/ui/ideaColors";
import { LyricsNote } from "./LyricsNote";
import { Recorder } from "./Recorder";

type Props = {
  /** The sketch being viewed, or null on the home screen (a capture then starts a new sketch and opens it). */
  openSketchId: string | null;
};

type Section = "lyrics" | "melody" | "beat";

const sections: { value: Section; label: string; icon: ReactNode; bg: string }[] = [
  { value: "lyrics", label: "Lyrics", icon: <TextAa size={16} />, bg: ideaBg.lyrics },
  { value: "melody", label: "Melody", icon: <MusicNotes size={16} />, bg: ideaBg.voice },
  { value: "beat", label: "Beat", icon: <GridFour size={16} />, bg: beatBg },
];

const storageKey = "hum.captureSection";

/** The section last used, remembered in this browser only. Melody until one is chosen. */
function useSection(): [Section, (section: Section) => void] {
  const [section, setSection] = useState<Section>("melody");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (sections.some((s) => s.value === saved)) setSection(saved as Section); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      // Private windows and blocked storage start on Melody.
    }
  }, []);

  function choose(next: Section) {
    setSection(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {}
  }

  return [section, choose];
}

/** The three things a songwriter captures, shared by the home screen and the sketch page: lyrics, a hummed melody, a beat. */
export function CaptureBar({ openSketchId }: Props) {
  const router = useRouter();
  const [section, setSection] = useSection();
  const [recording, setRecording] = useState(false);
  // On the home screen a take starts a new idea. Its id is chosen when recording starts, so its page can load while
  // the songwriter hums and opens the moment they stop.
  const newSketchId = useRef<string | null>(null);
  // Carries on across the jump to a new sketch's page, so the songwriter sees their hum being heard where they tapped.
  const hearing = useTranscribeProgress();
  const hearingNote =
    hearing && `Turning your hum into notes${hearing.stage === "hearing" ? `, ${Math.round(hearing.heard * 100)}%` : ""}`;

  function busyChange(busy: boolean) {
    setRecording(busy);
    if (busy && !openSketchId && !newSketchId.current) {
      newSketchId.current = crypto.randomUUID();
      router.prefetch(`/s/${newSketchId.current}`);
    }
  }

  async function save(input: IdeaInput, stillMounted = true) {
    const sketchId = newSketchId.current ?? undefined;
    newSketchId.current = null;
    // A take is saved as being heard, so its card shows a skeleton rather than a button until the notes arrive.
    const { sketch, idea } = await captureIdea(openSketchId, input.kind === "voice" ? { ...input, transcription: { status: "pending" } } : input, sketchId);
    if (idea.kind === "voice") void finishTake(idea);
    if (stillMounted && !openSketchId) router.push(`/s/${sketch.id}`);
  }

  return (
    <section aria-label="Capture" className="flex w-full flex-col items-center gap-6">
      <div role="group" aria-label="What to capture" className="grid w-full grid-cols-3 gap-1 rounded-full bg-surface p-1">
        {sections.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={s.value === section}
            disabled={recording && s.value !== section}
            onClick={() => setSection(s.value)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full pr-3 pl-1 text-base font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 aria-pressed:bg-raised aria-pressed:text-ink"
          >
            <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-canvas ${s.bg}`} aria-hidden>
              {s.icon}
            </span>
            {s.label}
          </button>
        ))}
      </div>
      {section === "lyrics" ? (
        <LyricsNote openSketchId={openSketchId} />
      ) : (
        <Recorder mode={section} onSave={save} onBusyChange={busyChange} idleNote={hearingNote || undefined} />
      )}
    </section>
  );
}

/** The capture bar as a piece of a canvas page: in a titled card of its own, with room around it to grab it by. */
export function CaptureCard({ openSketchId }: { openSketchId: string | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-canvas p-4">
      <h2 className="text-center text-sm font-semibold text-ink-muted">Capture ideas the moment inspiration hits</h2>
      <CaptureBar openSketchId={openSketchId} />
    </div>
  );
}
