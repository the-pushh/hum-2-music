"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { FileAudio, MusicNotesSimple } from "@phosphor-icons/react";
import { takeAudio } from "@/export/takeAudio";
import { heardNotes, takeMidi } from "@/export/takeMidi";
import { defaultInstrument } from "@/instruments/instruments";
import { takeOf } from "@/melody/client";
import type { VoiceIdea } from "@/sketches/types";

/** A file ready to hand over: dragged into a DAW, shared from a phone, or downloaded. */
type Ready = { file: File; url: string };

const fileTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "hum melody 28 Oct, 21:35.mid": which take, without a sketch title to look up. */
function fileName(idea: VoiceIdea, drums: boolean, extension: string) {
  return `hum ${drums ? "beat" : "melody"} ${fileTime.format(idea.createdAt).replace(/[/:]/g, ".")}.${extension}`;
}

/** Phones hand files to the share sheet (AirDrop, Files, other apps); computers download them or drag them out. */
async function deliver(file: File) {
  const phone = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      // Closing the share sheet isn't a failure; anything else falls back to a download.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  // A link of its own, so the download never depends on the one kept for dragging.
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * A file with a link that lives as long as the file does. The link is made in an effect, beside the cleanup that frees
 * it: made during render, React's dev double run frees it on mount and the chip is left holding a dead link.
 */
function useReady(file: File | null): Ready | null {
  const [ready, setReady] = useState<Ready | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setReady({ file, url }); // eslint-disable-line react-hooks/set-state-in-effect
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // A link made for an earlier file is already freed, so it's never handed out.
  return ready?.file === file ? ready : null;
}

/**
 * Chrome and Edge let a file be dragged out of the page into a DAW or the desktop. Other browsers ignore this and
 * drag nothing, so the chip's tap still shares or downloads.
 */
function dragOut(e: DragEvent, ready: Ready | null) {
  if (!ready) return e.preventDefault();
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData("DownloadURL", `${ready.file.type}:${ready.file.name}:${ready.url}`);
}

const chip =
  "inline-flex h-8 items-center gap-1 rounded-full bg-canvas/10 px-3 text-sm font-semibold transition duration-300 ease-soft hover:bg-canvas/20 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas disabled:opacity-50";

/**
 * Takes a take to a DAW: MIDI (only the notes, so the DAW picks the sound) or audio (a WAV of the take on the instrument
 * the card plays it on). Tap to share or download; drag into a DAW in Chrome or Edge. Shown once the take has been heard.
 */
export function TakeExport({ idea }: { idea: VoiceIdea }) {
  const heard = heardNotes(idea);
  const bpm = takeOf(idea).bpm;
  const instrument = idea.instrument ?? defaultInstrument;
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live queries hand back fresh objects on every read, so the file is keyed on what's in it, not on object identity:
  // otherwise it would be rebuilt (and its link freed) on almost every render, mid-drag included.
  const contents = heard ? `${bpm}|${heard.drums}|${heard.notes.map((n) => `${n.pitch}:${n.start}:${n.duration}:${n.velocity}`).join(" ")}` : "";

  // The MIDI file is small and quick, so it's ready before anyone drags it.
  const midiFile = useMemo<File | null>(() => {
    if (!heard) return null;
    const bytes = takeMidi({ notes: heard.notes, drums: heard.drums, bpm, name: heard.drums ? "Beat" : "Melody" });
    return new File([bytes.slice()], fileName(idea, heard.drums, "mid"), { type: "audio/midi" });
  }, [contents, idea.createdAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const midi = useReady(midiFile);

  // A rendered WAV belongs to these notes on this instrument: any change means rendering again.
  useEffect(() => setAudioFile(null), [midiFile, instrument]); // eslint-disable-line react-hooks/set-state-in-effect
  const audio = useReady(audioFile);

  if (!heard || !midiFile) return null;

  async function exportAudio() {
    if (audioFile) return deliver(audioFile);
    if (!heard) return;
    setRendering(true);
    setError(null);
    try {
      const wav = await takeAudio({ notes: heard.notes, drums: heard.drums, bpm, instrument });
      const file = new File([wav], fileName(idea, heard.drums, "wav"), { type: "audio/wav" });
      setAudioFile(file);
      await deliver(file);
    } catch {
      setError("The audio couldn't be made. Check your connection (the instrument may need to load) and try again.");
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div role="group" aria-label="Export to a DAW" className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold opacity-70">To your DAW</span>
        <button type="button" draggable onDragStart={(e) => dragOut(e, midi)} onClick={() => void deliver(midiFile)} className={chip} title="Tap to share or download. Drag into your DAW in Chrome or Edge.">
          <MusicNotesSimple size={16} aria-hidden />
          MIDI
        </button>
        <button
          type="button"
          draggable={!!audio}
          onDragStart={(e) => dragOut(e, audio)}
          onClick={() => void exportAudio()}
          disabled={rendering}
          aria-busy={rendering}
          className={`${chip} ${rendering ? "animate-pulse" : ""}`}
          title={audio ? "Tap to share or download. Drag into your DAW in Chrome or Edge." : "Tap to make the audio, then share or download it."}
        >
          <FileAudio size={16} aria-hidden />
          {rendering ? "Making audio" : "Audio"}
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs font-semibold">
          {error}
        </span>
      )}
    </div>
  );
}
