import { pitchClass, type CleanupSettings, type Key, type Note, type Take } from "./types";

/** Notes shorter than this are breaths, clicks and consonants, not sung notes. */
const shortestNoteSec = 0.08;
/**
 * A held note the transcriber lost for a frame or two comes back as two same-pitch notes with a short gap between.
 * Re-sung notes either leave a longer gap or, when the transcriber heard a new onset, start exactly where the last ended.
 */
const splitGapSec = { min: 0.005, max: 0.03 };
/**
 * The voice scoops into notes, falls off them and wobbles around held ones, and the transcriber hears each slide as a
 * short note of its own. A note this brief, touching a note this close in pitch, is part of that note.
 */
const slide = { longestSec: 0.12, semitones: 2, gapSec: 0.05 };
/**
 * A voice holding a note wanders around it: vibrato, and pitch sitting between two semitones, flick the transcriber
 * back and forth between neighbouring notes. Averaged over this window, the pitch only moves to a new note when it
 * strays this many semitones from the one it's on. Notes closer than this gap are one stretch of continuous voice.
 */
const steady = { windowSec: 0.4, semitones: 0.7, gapSec: 0.08, frameSec: 0.01 };
/**
 * A hum often comes out as short notes with little gaps between them, which plays back choppy. A note this short, a gap
 * this small from a note this close in pitch, was part of that note.
 */
const staccato = { longestSec: 0.25, gapSec: 0.2, semitones: 2 };
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
    .map((n) => ({ ...n, pitch: Math.round(n.pitch), sung: n.pitch }))
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  notes = joinSplitNotes(notes, splitGapSec.min * beatsPerSec, splitGapSec.max * beatsPerSec);
  notes = oneAtATime(notes);
  notes = holdSteady(notes, beatsPerSec);
  // Slides are folded in before blips are dropped, so a scoop lengthens its note rather than leaving a hole.
  notes = foldSlides(notes, slide.longestSec * beatsPerSec, slide.gapSec * beatsPerSec);
  notes = notes.filter((n) => n.duration >= shortestNoteSec * beatsPerSec);
  notes = joinStaccato(notes, staccato.longestSec * beatsPerSec, staccato.gapSec * beatsPerSec);

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

/**
 * Regroups each stretch of continuous voice into the notes it holds. Same-pitch notes the transcriber kept apart were
 * sung again, so a stretch ends there as well as at a gap.
 */
function holdSteady(notes: Sung[], beatsPerSec: number): Sung[] {
  const steadied: Sung[] = [];
  let stretch: Sung[] = [];
  for (const n of notes) {
    const prev = stretch.at(-1);
    if (prev && (n.start - end(prev) > steady.gapSec * beatsPerSec || n.pitch === prev.pitch)) {
      steadied.push(...steadyStretch(stretch, beatsPerSec));
      stretch = [];
    }
    stretch.push(n);
  }
  steadied.push(...steadyStretch(stretch, beatsPerSec));
  return steadied;
}

/**
 * Splits a stretch of voice wherever its pitch, averaged over the window, leaves the note it's on, at the transcribed
 * note that starts nearest the move. Each group becomes one note at the pitch the voice spent most time on.
 */
function steadyStretch(stretch: Sung[], beatsPerSec: number): Sung[] {
  if (stretch.length < 2) return stretch;
  const frame = steady.frameSec * beatsPerSec;
  const half = Math.round(steady.windowSec / steady.frameSec / 2);
  const t0 = stretch[0].start;
  const frames = Math.max(1, Math.ceil((Math.max(...stretch.map(end)) - t0) / frame));
  const startFrame = stretch.map((n) => Math.round((n.start - t0) / frame));

  // The pitch at each frame, carrying the last note's pitch across the short gaps inside a stretch.
  const pitchAt: number[] = [];
  for (let i = 0, k = 0; i < frames; i++) {
    while (k + 1 < stretch.length && startFrame[k + 1] <= i) k++;
    pitchAt.push(stretch[k].pitch);
  }
  const sums = [0];
  for (const p of pitchAt) sums.push(sums.at(-1)! + p);
  const meanOver = (from: number, to: number) => {
    const a = Math.max(0, from);
    const b = Math.min(frames - 1, to);
    return (sums[b + 1] - sums[a]) / (b - a + 1);
  };

  const cuts = [0];
  let current = Math.round(meanOver(0, half));
  for (let i = 0; i < frames; i++) {
    if (Math.abs(meanOver(i - half, i + half) - current) <= steady.semitones) continue;
    let nearest = -1;
    for (let k = cuts.at(-1)! + 1; k < stretch.length; k++) {
      const distance = Math.abs(startFrame[k] - i);
      if (distance <= 2 * half && (nearest < 0 || distance < Math.abs(startFrame[nearest] - i))) nearest = k;
    }
    if (nearest < 0) continue;
    const next = Math.round(meanOver(startFrame[nearest], startFrame[nearest] + 2 * half));
    if (next === current) continue;
    cuts.push(nearest);
    current = next;
  }

  return cuts.map((from, c) => {
    const group = stretch.slice(from, cuts[c + 1] ?? stretch.length);
    const pitch = mostHeld(group);
    const start = group[0].start;
    const held = group.filter((n) => n.pitch === pitch);
    return {
      pitch,
      start,
      duration: Math.max(...group.map(end)) - start,
      velocity: Math.max(...group.map((n) => n.velocity)),
      sung: held.reduce((sum, n) => sum + n.sung * n.duration, 0) / held.reduce((sum, n) => sum + n.duration, 0),
    };
  });
}

/** The pitch held longest across some notes; the lower one on a tie. */
function mostHeld(notes: Note[]): number {
  const time = new Map<number, number>();
  for (const n of notes) time.set(n.pitch, (time.get(n.pitch) ?? 0) + n.duration);
  return [...time].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
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

/**
 * Folds each slide into the held note it belongs to, briefest first, so a run of wobbles folds in from the notes around it.
 * Slides only fold into notes long enough to be sung notes, so a quick run of short notes stays as it is.
 * A wobble between two of the same note joins them into one held note; otherwise the slide goes to the longer neighbour.
 */
function foldSlides<N extends Note>(notes: N[], longest: number, maxGap: number): N[] {
  const line = [...notes];
  const belongsTo = (n: N, other: N | undefined, gap: number) =>
    other !== undefined && other.duration >= longest && gap <= maxGap && Math.abs(other.pitch - n.pitch) <= slide.semitones;
  for (;;) {
    let best = -1;
    for (let i = 0; i < line.length; i++) {
      const n = line[i];
      if (n.duration >= longest || (best >= 0 && n.duration >= line[best].duration)) continue;
      const prev = line[i - 1];
      const next = line[i + 1];
      if (belongsTo(n, prev, prev ? n.start - end(prev) : 0) || belongsTo(n, next, next ? next.start - end(n) : 0)) best = i;
    }
    if (best < 0) return line;

    const n = line[best];
    const prev = line[best - 1];
    const next = line[best + 1];
    const toPrev = prev !== undefined && belongsTo(n, prev, n.start - end(prev));
    const toNext = next !== undefined && belongsTo(n, next, next.start - end(n));
    if (toPrev && toNext && prev.pitch === next.pitch) {
      line.splice(best - 1, 3, { ...prev, duration: end(next) - prev.start, velocity: Math.max(prev.velocity, next.velocity) });
    } else if (toPrev && (!toNext || prev.duration >= next.duration)) {
      line.splice(best - 1, 2, { ...prev, duration: end(n) - prev.start });
    } else {
      line.splice(best, 2, { ...next, start: n.start, duration: end(next) - n.start });
    }
  }
}

/**
 * Joins each short note across a small gap to the note beside it, shortest first, so a choppy run becomes one held note.
 * Notes sung right after one another have no gap and aren't staccato, so quick legato lines are left alone. A short
 * note joins the neighbour closer in pitch, or the longer one, and the pair takes the longer note's pitch.
 */
function joinStaccato<N extends Note>(notes: N[], longest: number, maxGap: number): N[] {
  const line = [...notes];
  const gapBetween = (a: N, b: N) => b.start - end(a);
  const joins = (n: N, other: N | undefined, gap: number) =>
    other !== undefined && gap > 1e-9 && gap <= maxGap && Math.abs(other.pitch - n.pitch) <= staccato.semitones;
  for (;;) {
    let best = -1;
    for (let i = 0; i < line.length; i++) {
      const n = line[i];
      if (n.duration >= longest || (best >= 0 && n.duration >= line[best].duration)) continue;
      const prev = line[i - 1];
      const next = line[i + 1];
      if ((prev && joins(n, prev, gapBetween(prev, n))) || (next && joins(n, next, gapBetween(n, next)))) best = i;
    }
    if (best < 0) return line;

    const n = line[best];
    const prev = line[best - 1];
    const next = line[best + 1];
    const toPrev = prev !== undefined && joins(n, prev, gapBetween(prev, n));
    const toNext = next !== undefined && joins(n, next, gapBetween(n, next));
    const closer = (a: N, b: N) => Math.abs(a.pitch - n.pitch) - Math.abs(b.pitch - n.pitch) || b.duration - a.duration;
    const withPrev = toPrev && (!toNext || closer(prev, next) <= 0);
    const [first, second] = withPrev ? [prev, n] : [n, next];
    const longer = first.duration >= second.duration ? first : second;
    const joined = { ...longer, start: first.start, duration: end(second) - first.start, velocity: Math.max(first.velocity, second.velocity) };
    line.splice(withPrev ? best - 1 : best, 2, joined);
  }
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
