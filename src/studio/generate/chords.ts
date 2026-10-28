import { NOTE_NAMES, scalePitchClasses } from "@/studio/music";
import type { PartNote } from "./bass";
import { atEnergy } from "./energy";
import type { MelodyNote, Plan } from "./plan";

export type { MelodyNote } from "./plan";

/** One bar's chord: a triad (or a seventh chord, in the sevenths Style) on a scale degree, voiced around middle C, root first. */
export type Chord = { bar: number; numeral: string; root: number; pitches: number[] };

type Triad = { numeral: string; root: number; third: number; fifth: number; favoured: boolean };

/** Triads by semitones from the tonic. Minor includes both v and the harmonic minor's V, as hum's key detection does. */
const triads: Record<"major" | "minor", Triad[]> = {
  major: [
    { numeral: "I", root: 0, third: 4, fifth: 7, favoured: true },
    { numeral: "ii", root: 2, third: 3, fifth: 7, favoured: false },
    { numeral: "iii", root: 4, third: 3, fifth: 7, favoured: false },
    { numeral: "IV", root: 5, third: 4, fifth: 7, favoured: true },
    { numeral: "V", root: 7, third: 4, fifth: 7, favoured: true },
    { numeral: "vi", root: 9, third: 3, fifth: 7, favoured: true },
  ],
  minor: [
    { numeral: "i", root: 0, third: 3, fifth: 7, favoured: true },
    { numeral: "III", root: 3, third: 4, fifth: 7, favoured: false },
    { numeral: "iv", root: 5, third: 3, fifth: 7, favoured: true },
    { numeral: "V", root: 7, third: 4, fifth: 7, favoured: true },
    { numeral: "v", root: 7, third: 3, fifth: 7, favoured: false },
    { numeral: "VI", root: 8, third: 4, fifth: 7, favoured: true },
    { numeral: "VII", root: 10, third: 4, fifth: 7, favoured: false },
  ],
};

/** A note counts more the longer it's held and the stronger the beat it starts on. */
function weight(note: MelodyNote, beatsPerBar: number): number {
  const beat = note.startBeat % beatsPerBar;
  const strength = beat === 0 ? 2 : beat === beatsPerBar / 2 ? 1.5 : 1;
  return note.duration * strength;
}

const favouredBonus = 0.25;
const sharedToneBonus = 0.1;
const homeBonus = 0.5;

/**
 * One chord per bar that fits the melody: the diatonic triad covering the most melody, by weight. Close calls go to
 * the common chords (I, IV, V, vi), then to whichever shares more notes with the chord before, and the last bar leans
 * home to the tonic. A bar with no melody keeps the chord before it. Always the same chords for the same melody.
 */
export function generateChords(plan: Plan, melody: MelodyNote[]): Chord[] {
  const tonic = NOTE_NAMES.indexOf(plan.key);
  const options = triads[plan.scale === "minor" ? "minor" : "major"];
  const chords: Chord[] = [];
  let previous: Triad | null = null;

  for (let bar = 0; bar < plan.bars; bar++) {
    const from = bar * plan.beatsPerBar;
    const inBar = melody
      .filter((n) => n.startBeat >= from && n.startBeat < from + plan.beatsPerBar)
      .map((n) => ({ pc: (((n.pitch - tonic) % 12) + 12) % 12, weight: weight(n, plan.beatsPerBar) }));
    const last = bar === plan.bars - 1;

    let best: Triad;
    if (!inBar.length) {
      best = previous && !last ? previous : options[0];
    } else {
      let bestScore = -Infinity;
      best = options[0];
      for (const triad of options) {
        const tones = new Set(toneSet(triad));
        let score = inBar.reduce((sum, n) => sum + (tones.has(n.pc) ? n.weight : 0), 0);
        if (triad.favoured) score += favouredBonus;
        if (previous) score += sharedToneBonus * toneSet(previous).filter((t) => tones.has(t)).length;
        if (last && triad === options[0]) score += homeBonus;
        // Strictly greater, so ties go to the earlier, more common degree.
        if (score > bestScore + 1e-9) {
          bestScore = score;
          best = triad;
        }
      }
    }
    previous = best;
    const pitches = voice(tonic, best);
    if (plan.style.chords === "sevenths") pitches.push(pitches[0] + seventh(best.root, scalePitchClasses(plan.key, plan.scale), tonic));
    chords.push({ bar, numeral: best.numeral, root: (tonic + best.root) % 12, pitches });
  }
  return chords;
}

function toneSet(t: Triad): number[] {
  return [t.root, (t.root + t.third) % 12, (t.root + t.fifth) % 12];
}

/** Root position with the root between E3 and D#4, so every chord sits around middle C. */
function voice(tonic: number, t: Triad): number[] {
  const rootPc = (tonic + t.root) % 12;
  const root = 52 + ((rootPc - 4 + 12) % 12);
  return [root, root + t.third, root + t.fifth];
}

/** Semitones from a chord's root up to its diatonic seventh: a major seventh if the key has it, otherwise a minor one. */
function seventh(rootFromTonic: number, inKey: Set<number>, tonic: number): number {
  return inKey.has((tonic + rootFromTonic + 11) % 12) ? 11 : 10;
}

/** Medium energy pulses on beats; high on eighths. */
const pulseBeats = { low: 1, medium: 1, high: 0.5 } as const;
const chordVelocity = 80;

/**
 * The chords as a part to play: each chord held for its bar, or pulsing (on beats, eighths at high energy, each a little
 * short of the next). Softer or harder with the Style's energy. Nothing when the Style has no chords.
 */
export function chordPart(plan: Plan, chords: Chord[]): PartNote[] {
  const { chords: colour, chordRhythm, energy } = plan.style;
  if (colour === "none") return [];
  const velocity = atEnergy(chordVelocity, energy);
  const step = chordRhythm === "pulsing" ? pulseBeats[energy] : plan.beatsPerBar;
  const duration = chordRhythm === "pulsing" ? step * 0.75 : step;
  const notes: PartNote[] = [];
  for (const chord of chords) {
    const from = chord.bar * plan.beatsPerBar;
    for (let at = 0; at < plan.beatsPerBar - 1e-9; at += step) {
      for (const pitch of chord.pitches) notes.push({ pitch, startBeat: from + at, duration, velocity });
    }
  }
  return notes;
}
