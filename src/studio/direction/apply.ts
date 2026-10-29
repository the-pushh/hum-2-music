import { instrumentPreset, instruments } from "@/instruments/instruments";
import { isClaudePart, withGeneratedParts, withStyle } from "@/studio/generate/parts";
import { NOTE_NAMES } from "@/studio/music";
import type { Project, Track } from "@/studio/types";
import type { Direction } from "./schema";

/** Semitones above the tonic that differ between major and minor: the 3rd, 6th and 7th, in major. */
const majorOnly = new Set([4, 9, 11]);
const minorOnly = new Set([3, 8, 10]);

/**
 * The arrangement with a Direction applied, everything the Direction doesn't name left as it is:
 * - a new tempo (notes stay where they are in beats);
 * - a new key: melodic tracks move to the new tonic by the smallest interval, drums never move;
 * - a new mode: melodic notes on the 3rd, 6th and 7th move a semitone into the parallel major or minor;
 * - hummed melodies re-voiced on new instruments, taking each instrument's role;
 * - Style changes;
 * and generated parts rewritten to follow. Loaded into the studio as one change, so one undo takes it all back.
 */
export function applyDirection(project: Project, direction: Direction): Project {
  let next = project;
  if (direction.bpm !== undefined && direction.bpm !== project.bpm) next = { ...next, bpm: direction.bpm };

  const key = direction.key ?? project.key;
  const scale = direction.scale ?? project.scale;
  const shift = smallestMove(NOTE_NAMES.indexOf(project.key), NOTE_NAMES.indexOf(key));
  const modeChange = scale !== project.scale && (scale === "major" || scale === "minor") ? scale : undefined;
  if (shift || modeChange) next = { ...next, key, scale, clips: next.clips.map((clip) => (melodic(trackOf(next, clip.trackId)) ? { ...clip, notes: clip.notes?.map((n) => ({ ...n, pitch: moved(n.pitch) })) } : clip)) };

  function moved(pitch: number): number {
    const p = pitch + shift;
    if (!modeChange) return p;
    const degree = (((p - NOTE_NAMES.indexOf(key)) % 12) + 12) % 12;
    if (modeChange === "minor" && majorOnly.has(degree)) return p - 1;
    if (modeChange === "major" && minorOnly.has(degree)) return p + 1;
    return p;
  }

  let revoiced = false;
  for (const { trackId, instrument } of direction.instruments ?? []) {
    const track = trackOf(next, trackId);
    if (track?.origin?.kind !== "hum" || track.type === "drum") continue;
    const voiced = { ...track, instrumentPreset: instrumentPreset(instrument), color: instruments[instrument].role };
    next = { ...next, tracks: next.tracks.map((t) => (t.id === trackId ? voiced : t)) };
    revoiced = true;
  }

  const style = Object.fromEntries(Object.entries(direction.style ?? {}).filter(([, v]) => v !== undefined));
  if (Object.keys(style).length) return withStyle(next, style);
  // A new key or mode, or a hum moved into or out of the bass, means new chords and bass even with the Style unchanged.
  return (shift || modeChange || revoiced) && next.tracks.some((t) => t.origin?.kind === "generated")
    ? withGeneratedParts(next, { keepClaudeParts: true })
    : next;
}

/** From one pitch class to another the short way round: -6 to +5 semitones. */
function smallestMove(from: number, to: number): number {
  return ((((to - from + 6) % 12) + 12) % 12) - 6;
}

function trackOf(project: Project, id: string): Track | undefined {
  return project.tracks.find((t) => t.id === id);
}

/** Tracks with pitched notes that a key change moves: hums, hand-added tracks and Claude's parts. Rule-written ones are rewritten instead. */
function melodic(track: Track | undefined): boolean {
  return !!track && track.type !== "drum" && (track.origin?.kind !== "generated" || isClaudePart(track));
}
