// Note dragging and quantizing, ported from Signal's piano roll editor (MIT, https://github.com/ryohey/signal at
// dc5e0313, packages/pianoroll-editor: draggable.ts `draggedNote`, entities/note/transform.ts `quantizeNote`).
// Signal works in MIDI ticks; these work in beats, the studio's unit. See src/studio/LICENSE-Signal.

import { HIGHEST_PITCH, LOWEST_PITCH } from "./music";
import type { Note } from "./types";

/** Which part of a note is being dragged: its body moves it, its edges change where it starts or ends. */
export type DragHandle = "left" | "center" | "right";

/** Where the pointer is, snapped: a beat from the clip start and a pitch. */
export type NotePoint = { startBeat: number; pitch: number };

/** The note as it would be with `handle` dragged to `point`. Never shorter than `minLength` or off the keyboard. */
export function draggedNote(note: Note, point: NotePoint, handle: DragHandle, minLength: number): Note {
  switch (handle) {
    case "center":
      return { ...note, startBeat: Math.max(0, point.startBeat), pitch: clampPitch(point.pitch) };
    case "left": {
      const end = note.startBeat + note.duration;
      const startBeat = Math.max(0, Math.min(point.startBeat, end - minLength));
      return { ...note, startBeat, duration: end - startBeat };
    }
    case "right":
      return { ...note, duration: Math.max(minLength, point.startBeat - note.startBeat) };
  }
}

/** Moves each note's start to the nearest grid line, keeping its length. */
export function quantizeNotes(notes: Note[], gridBeats: number): Note[] {
  return notes.map((n) => ({ ...n, startBeat: Math.round(n.startBeat / gridBeats) * gridBeats }));
}

function clampPitch(pitch: number) {
  return Math.min(HIGHEST_PITCH, Math.max(LOWEST_PITCH, pitch));
}
