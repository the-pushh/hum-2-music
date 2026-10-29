"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MagnetStraight } from "@phosphor-icons/react";
import { SNAP_BEATS, pitchName, scalePitchClasses } from "@/studio/music";
import { draggedNote, quantizeNotes, type DragHandle } from "@/studio/noteEdits";
import { useProjectStore } from "@/studio/store/project";
import { arrangementBars, previewNote } from "@/studio/transport";
import type { Clip, Note, Track } from "@/studio/types";
import { Choice } from "../Choice";
import { roleBg } from "./roleColors";
import { canvasControl } from "@/ui/canvasLayout";

/** Pixels per semitone row and per beat. Fingertip sized: a 1/8 note is still 24px wide. */
const rowPx = 24;
const beatPx = 48;
const lowPitch = 36;
const highPitch = 96;
/** A pointer that moves less than this is a tap, not a drag or a scroll. */
const tapSlopPx = 6;
const edgePx = 12;
const doubleTapMs = 350;

type Snap = "1/4" | "1/8" | "1/16";

type Drag = {
  note: Note;
  handle: DragHandle;
  /** For a move: how far into the note it was grabbed, so it doesn't jump to the pointer. */
  grabBeats: number;
  x: number;
  y: number;
  moved: boolean;
  draft: Note;
};

/** Edit a track's notes by touch or mouse: tap to add, drag to move, drag an end to resize, double tap to delete. */
export function PianoRoll({ track }: { track: Track }) {
  const project = useProjectStore((s) => s.project)!;
  const { addClip, addNote, updateNote, deleteNote, resizeClip, updateClip } = useProjectStore.getState();
  const clip = project.clips.find((c) => c.trackId === track.id);
  const [snap, setSnap] = useState<Snap>("1/8");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef<{ id: string; at: number } | null>(null);

  const step = SNAP_BEATS[snap];
  const beatsPerBar = project.timeSignature[0];
  const bars = Math.max(arrangementBars(project), clip?.lengthBars ?? 0) + 1;
  const beats = bars * beatsPerBar;
  const inKey = scalePitchClasses(project.key, project.scale);
  const notes = clip?.notes ?? [];
  const pitches = Array.from({ length: highPitch - lowPitch + 1 }, (_, i) => highPitch - i);

  // Open on the notes, or around middle C.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sorted = notes.map((n) => n.pitch).sort((a, b) => a - b);
    const centre = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 60;
    el.scrollTop = (highPitch - centre) * rowPx - el.clientHeight / 2;
  }, [track.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The beat and pitch under the pointer. */
  function pointAt(e: { clientX: number; clientY: number }) {
    const rect = gridRef.current!.getBoundingClientRect();
    return {
      beat: Math.max(0, (e.clientX - rect.left) / beatPx),
      pitch: highPitch - Math.floor((e.clientY - rect.top) / rowPx),
    };
  }

  /** The track's clip, made when the first note is written into an empty track. */
  function ensureClip(endBeat: number): Clip {
    const lengthBars = Math.max(arrangementBars(project), Math.ceil(endBeat / beatsPerBar));
    const existing = useProjectStore.getState().project!.clips.find((c) => c.trackId === track.id);
    if (!existing) return addClip(track.id, track.type === "drum" ? "drum" : "midi", 0, lengthBars);
    if (existing.lengthBars < Math.ceil(endBeat / beatsPerBar)) resizeClip(existing.id, Math.ceil(endBeat / beatsPerBar));
    return existing;
  }

  function onGridPointerDown(e: ReactPointerEvent) {
    press.current = { x: e.clientX, y: e.clientY };
  }

  function onGridPointerUp(e: ReactPointerEvent) {
    const start = press.current;
    press.current = null;
    if (!start || e.target !== gridRef.current) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > tapSlopPx) return;
    const { beat, pitch } = pointAt(e);
    const startBeat = Math.floor(beat / step) * step;
    const duration = Math.max(step, 0.5);
    const target = ensureClip(startBeat + duration);
    const note = addNote(target.id, { pitch, startBeat, duration, velocity: 96 });
    if (note) setSelectedId(note.id);
    void previewNote(track, pitch);
  }

  function onNotePointerDown(e: ReactPointerEvent<HTMLDivElement>, note: Note) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    const handle: DragHandle =
      rect.width - offset < edgePx ? "right" : offset < edgePx / 2 && rect.width > edgePx * 3 ? "left" : "center";
    setSelectedId(note.id);
    setDrag({ note, handle, grabBeats: pointAt(e).beat - note.startBeat, x: e.clientX, y: e.clientY, moved: false, draft: note });
  }

  function onNotePointerMove(e: ReactPointerEvent) {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > tapSlopPx;
    if (!moved) return;
    const { beat, pitch } = pointAt(e);
    const target = drag.handle === "center" ? beat - drag.grabBeats : beat;
    const draft = draggedNote(drag.note, { startBeat: Math.round(target / step) * step, pitch }, drag.handle, step);
    if (draft.pitch !== drag.draft.pitch) void previewNote(track, draft.pitch, 0.25);
    setDrag({ ...drag, moved, draft });
  }

  function onNotePointerUp(e: ReactPointerEvent) {
    if (!drag || !clip) return setDrag(null);
    const { note, draft, moved } = drag;
    setDrag(null);
    if (moved) {
      ensureClip(draft.startBeat + draft.duration);
      updateNote(clip.id, note.id, { startBeat: draft.startBeat, pitch: draft.pitch, duration: draft.duration });
      return;
    }
    const now = e.timeStamp;
    if (lastTap.current?.id === note.id && now - lastTap.current.at < doubleTapMs) {
      deleteNote(clip.id, note.id);
      lastTap.current = null;
    } else {
      lastTap.current = { id: note.id, at: now };
      void previewNote(track, note.pitch);
    }
  }

  function onKeyDown(e: React.KeyboardEvent, note: Note) {
    if (!clip) return;
    const nudges: Record<string, Partial<Note>> = {
      ArrowUp: { pitch: Math.min(highPitch, note.pitch + 1) },
      ArrowDown: { pitch: Math.max(lowPitch, note.pitch - 1) },
      ArrowLeft: { startBeat: Math.max(0, note.startBeat - step) },
      ArrowRight: { startBeat: note.startBeat + step },
    };
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteNote(clip.id, note.id);
    } else if (nudges[e.key]) {
      e.preventDefault();
      updateNote(clip.id, note.id, nudges[e.key]);
      if (nudges[e.key].pitch !== undefined) void previewNote(track, nudges[e.key].pitch!, 0.25);
    }
  }

  function quantize() {
    if (!clip?.notes) return;
    updateClip(clip.id, { notes: quantizeNotes(clip.notes, step) });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Choice<Snap>
          label="Snap to"
          value={snap}
          onChange={setSnap}
          options={[
            { value: "1/4", label: "1/4" },
            { value: "1/8", label: "1/8" },
            { value: "1/16", label: "1/16" },
          ]}
        />
        <button
          type="button"
          onClick={quantize}
          disabled={!notes.length}
          className="inline-flex items-center gap-1 rounded-lg bg-raised px-2 py-1 text-xs font-semibold text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          <MagnetStraight size={16} aria-hidden />
          Quantize to {snap}
        </button>
        <p className="w-full text-xs text-ink-muted sm:w-auto">Tap to add. Drag to move, drag the end to resize, double tap to delete.</p>
      </div>
      <div ref={scrollRef} className={`relative max-h-96 overflow-auto rounded-2xl bg-canvas select-none ${canvasControl}`}>
        <div className="flex w-max">
          <div className="sticky left-0 z-10 flex w-12 shrink-0 flex-col bg-surface" aria-hidden>
            {pitches.map((p) => (
              <div key={p} className={`flex h-6 items-center px-1 font-mono text-xs ${inKey.has(p % 12) ? "text-ink" : "text-ink-muted"}`}>
                {p % 12 === 0 || inKey.has(p % 12) ? pitchName(p) : ""}
              </div>
            ))}
          </div>
          <div
            ref={gridRef}
            role="application"
            aria-label={`${track.name} notes in ${project.key} ${project.scale}`}
            onPointerDown={onGridPointerDown}
            onPointerUp={onGridPointerUp}
            className="relative touch-manipulation"
            style={{ width: beats * beatPx, height: pitches.length * rowPx }}
          >
            {pitches.map((p, i) =>
              inKey.has(p % 12) ? (
                <div key={p} className="pointer-events-none absolute inset-x-0 h-6 bg-surface" style={{ top: i * rowPx }} aria-hidden />
              ) : null,
            )}
            {Array.from({ length: beats + 1 }, (_, b) => (
              <div
                key={b}
                className={`pointer-events-none absolute inset-y-0 w-px ${b % beatsPerBar === 0 ? "bg-ink-muted" : "bg-line"}`}
                style={{ left: b * beatPx }}
                aria-hidden
              />
            ))}
            {notes.map((stored) => {
              const n = drag?.note.id === stored.id ? drag.draft : stored;
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${pitchName(n.pitch)} at beat ${+(n.startBeat + 1).toFixed(2)}`}
                  aria-pressed={selectedId === n.id}
                  onPointerDown={(e) => onNotePointerDown(e, stored)}
                  onPointerMove={onNotePointerMove}
                  onPointerUp={onNotePointerUp}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(e) => onKeyDown(e, stored)}
                  className={`absolute touch-none rounded-sm ${roleBg[track.color]} cursor-grab focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:outline-2 aria-pressed:outline-ink ${drag?.note.id === n.id ? "opacity-80" : ""}`}
                  style={{
                    left: n.startBeat * beatPx,
                    top: (highPitch - n.pitch) * rowPx + 2,
                    width: Math.max(8, n.duration * beatPx - 2),
                    height: rowPx - 4,
                  }}
                >
                  <span className="pointer-events-none absolute inset-y-1 right-1 w-0.5 rounded-full bg-canvas opacity-50" aria-hidden />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
