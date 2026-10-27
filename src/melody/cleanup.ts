import { pitchClass, type CleanupSettings, type Key, type Note, type Take } from "./types";

/** Notes shorter than this are breaths, clicks and consonants, not sung notes. */
const shortestNoteSec = 0.08;
/**
 * A held note the transcriber lost for a frame or two comes back as two same-pitch notes with a short gap between.
 * Re-sung notes either leave a longer gap or, when the transcriber heard a new onset, start exactly where the last ended.
 */
const splitGapSec = { min: 0.005, max: 0.03 };
/** Out-of-key notes held at least this long were meant: a blue note, a passing chromatic note. */
const heldNoteSec = 0.5;
/** Where the melody should sit for piano: around the octave above middle C. */
const comfortableCentre = 66;

// Krumhansl-Kessler key profiles, C major and C minor.
const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const majorSteps = [0, 2, 4, 5, 7, 9, 11];
// Natural minor plus the raised seventh melodies use to lead home.
const minorSteps = [0, 2, 3, 5, 7, 8, 10, 11];

/**
 * Turns a raw transcription into a clean, single-line melody and finds its key.
 * Pure and deterministic, so it can be re-run from the raw notes whenever the settings change.
 */
export function cleanup(raw: Note[], settings: CleanupSettings, take: Take): { notes: Note[]; key: Key } {
  const beatsPerSec = take.bpm / 60;
  let notes: Sung[] = raw
    .filter((n) => n.duration >= shortestNoteSec * beatsPerSec)
    .map((n) => ({ ...n, pitch: Math.round(n.pitch), sung: n.pitch }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  notes = joinSplitNotes(notes, splitGapSec.min * beatsPerSec, splitGapSec.max * beatsPerSec);
  notes = oneAtATime(notes);

  const key = settings.key === "auto" ? detectKey(notes) : settings.key;
  if (settings.snap) notes = snapToKey(notes, key, heldNoteSec * beatsPerSec);

  if (take.click) notes = oneAtATime(quantize(notes, 4 / settings.grid));
  else if (notes.length) notes = notes.map((n) => ({ ...n, start: n.start - notes[0].start }));

  return { notes: fitOctave(notes.map(({ pitch, start, duration, velocity }) => ({ pitch, start, duration, velocity }))), key };
}

/** A note rounded to a semitone, remembering the pitch the voice was actually at. */
type Sung = Note & { sung: number };

function end(n: Note) {
  return n.start + n.duration;
}

function joinSplitNotes<N extends Note>(notes: N[], minGap: number, maxGap: number): N[] {
  const joined: N[] = [];
  for (const n of notes) {
    const prev = joined.at(-1);
    const gap = prev ? n.start - end(prev) : 0;
    if (prev && prev.pitch === n.pitch && gap >= minGap && gap <= maxGap) {
      joined[joined.length - 1] = { ...prev, duration: Math.max(end(prev), end(n)) - prev.start, velocity: Math.max(prev.velocity, n.velocity) };
    } else {
      joined.push(n);
    }
  }
  return joined;
}

/** Reduces overlapping notes to one line. A small overlap is legato and trims the earlier note; a big one keeps the stronger note. */
function oneAtATime<N extends Note>(notes: N[]): N[] {
  const line: N[] = [];
  for (const n of notes) {
    const prev = line.at(-1);
    if (!prev || n.start >= end(prev)) {
      line.push(n);
      continue;
    }
    const overlap = Math.min(end(prev), end(n)) - n.start;
    const legato = overlap < Math.min(prev.duration, n.duration) / 2 && n.start > prev.start;
    if (legato) {
      line[line.length - 1] = { ...prev, duration: n.start - prev.start };
      line.push(n);
    } else if (strength(n) > strength(prev)) {
      line[line.length - 1] = n;
    }
  }
  return line;
}

function strength(n: Note) {
  return n.velocity * n.duration;
}

/** Krumhansl-Schmuckler: correlate duration-weighted pitch classes with each key's profile. */
export function detectKey(notes: Note[]): Key {
  const weights = new Array<number>(12).fill(0);
  for (const n of notes) weights[pitchClass(n.pitch)] += n.duration;

  let best: Key = { tonic: 0, mode: "major" };
  let bestScore = -Infinity;
  for (const mode of ["major", "minor"] as const) {
    const profile = mode === "major" ? majorProfile : minorProfile;
    for (let tonic = 0; tonic < 12; tonic++) {
      const score = correlation(weights, (pc) => profile[(pc - tonic + 12) % 12]);
      if (score > bestScore + 1e-9) {
        best = { tonic, mode };
        bestScore = score;
      }
    }
  }
  return best;
}

function correlation(xs: number[], profileAt: (pc: number) => number): number {
  const ys = xs.map((_, pc) => profileAt(pc));
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < 12; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

export function inKey(pitch: number, key: Key): boolean {
  const steps = key.mode === "major" ? majorSteps : minorSteps;
  return steps.includes(pitchClass(pitch - key.tonic));
}

/**
 * Moves brief out-of-key notes to the nearest note of the key. When both neighbours are in the key, it goes the way the
 * voice leaned, and towards the previous note when the voice was dead on.
 */
function snapToKey(notes: Sung[], key: Key, heldBeats: number): Sung[] {
  return notes.map((n, i) => {
    if (inKey(n.pitch, key) || n.duration >= heldBeats) return n;
    const down = n.pitch - 1;
    const up = n.pitch + 1;
    const candidates = [down, up].filter((p) => inKey(p, key));
    if (candidates.length === 1) return { ...n, pitch: candidates[0] };
    const lean = n.sung - n.pitch;
    if (Math.abs(lean) > 0.05) return { ...n, pitch: lean < 0 ? down : up };
    const prev = notes[i - 1]?.pitch ?? n.pitch;
    return { ...n, pitch: Math.abs(prev - down) <= Math.abs(prev - up) ? down : up };
  });
}

function quantize<N extends Note>(notes: N[], step: number): N[] {
  return notes.map((n) => {
    const start = Math.round(n.start / step) * step;
    const stop = Math.max(start + step, Math.round(end(n) / step) * step);
    return { ...n, start, duration: stop - start };
  });
}

/** Moves the whole melody by octaves so its middle sits in the piano's comfortable range. Intervals don't change. */
function fitOctave(notes: Note[]): Note[] {
  if (!notes.length) return notes;
  const sorted = notes.map((n) => n.pitch).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const shift = 12 * Math.round((comfortableCentre - median) / 12);
  return shift ? notes.map((n) => ({ ...n, pitch: n.pitch + shift })) : notes;
}
