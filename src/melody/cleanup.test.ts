import { describe, expect, it } from "vitest";
import { cleanup } from "./cleanup";
import type { CleanupSettings, Note, Take } from "./types";

const free: Take = { bpm: 90, click: false };
const click: Take = { bpm: 90, click: true };
const auto: CleanupSettings = { key: "auto", snap: true, grid: 8 };

// "Twinkle Twinkle" in C, as written: [pitch, beats].
const twinkle: [number, number][] = [
  [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
  [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
];

/** The tune as a person hums it: late and early starts, drifting pitch, gaps between re-sung notes, a held note split in two and a breath. */
function hummedTwinkle(): Note[] {
  const wobble = [0.04, -0.03, 0.05, 0.02, -0.04, 0.03, 0.01, -0.02, 0.04, 0.03, -0.05, 0.02, 0.04, -0.01];
  const drift = [0.2, -0.15, 0.1, 0.3, -0.2, 0.15, -0.1, 0.25, -0.3, 0.1, 0.2, -0.25, 0.15, -0.2];
  const notes: Note[] = [];
  let beat = 0;
  twinkle.forEach(([pitch, beats], i) => {
    const start = beat + wobble[i];
    const length = beats - 0.15;
    if (beats === 2) {
      // The transcriber split this held note in two.
      notes.push({ pitch: pitch + drift[i], start, duration: 1, velocity: 0.7 });
      notes.push({ pitch: pitch - drift[i] / 2, start: start + 1.02, duration: length - 1.02, velocity: 0.6 });
    } else {
      notes.push({ pitch: pitch + drift[i], start, duration: length, velocity: 0.7 });
    }
    beat += beats;
  });
  // A breath between the two phrases.
  notes.push({ pitch: 55, start: 7.92, duration: 0.05, velocity: 0.3 });
  return notes;
}

const pitches = (notes: Note[]) => notes.map((n) => n.pitch);

describe("cleanup", () => {
  it("turns a hummed Twinkle Twinkle into the tune", () => {
    const { notes, key } = cleanup(hummedTwinkle(), auto, click);
    expect(key).toEqual({ tonic: 0, mode: "major" });
    expect(pitches(notes)).toEqual(twinkle.map(([p]) => p));
    let beat = 0;
    const written = twinkle.map(([, beats]) => {
      const n = { start: beat, duration: beats };
      beat += beats;
      return n;
    });
    expect(notes.map(({ start, duration }) => ({ start, duration }))).toEqual(written);
  });

  it("keeps a free take's natural timing, starting at its first note", () => {
    const hum: Note[] = [
      { pitch: 64, start: 1.3, duration: 0.7, velocity: 0.7 },
      { pitch: 62, start: 2.17, duration: 0.4, velocity: 0.7 },
      { pitch: 60, start: 2.9, duration: 1.1, velocity: 0.7 },
    ];
    const { notes } = cleanup(hum, auto, free);
    expect(notes.map((n) => n.start)).toEqual([0, 0.87, 1.6].map((x) => expect.closeTo(x, 9)));
    expect(notes.map((n) => n.duration)).toEqual([0.7, 0.4, 1.1]);
  });

  it("drops blips too short to be sung notes", () => {
    // At 90 BPM, 0.09 beats is 60 ms and 0.15 beats is 100 ms.
    const hum: Note[] = [
      { pitch: 60, start: 0, duration: 1, velocity: 0.7 },
      { pitch: 72, start: 1.2, duration: 0.09, velocity: 0.9 },
      { pitch: 64, start: 1.5, duration: 0.15, velocity: 0.7 },
    ];
    expect(pitches(cleanup(hum, auto, free).notes)).toEqual([60, 64]);
  });

  it("joins a held note the transcriber split, but keeps re-sung notes apart", () => {
    const hum: Note[] = [
      { pitch: 64, start: 0, duration: 1, velocity: 0.7 },
      { pitch: 64, start: 1.01, duration: 1, velocity: 0.5 }, // split: 7 ms gap
      { pitch: 64, start: 2.3, duration: 0.7, velocity: 0.7 }, // re-sung: 200 ms gap
    ];
    const { notes } = cleanup(hum, auto, free);
    expect(notes.map(({ pitch, duration }) => ({ pitch, duration }))).toEqual([
      { pitch: 64, duration: 2.01 },
      { pitch: 64, duration: 0.7 },
    ]);
  });

  it("keeps re-sung notes apart when the transcriber starts the second right where the first ends", () => {
    // basic-pitch starts a new note at each onset, so a re-sung note can begin exactly where the last one stopped.
    const hum: Note[] = [
      { pitch: 48, start: 0.89, duration: 1.01, velocity: 0.7 },
      { pitch: 48, start: 1.9, duration: 0.99, velocity: 0.7 },
      { pitch: 55, start: 2.93, duration: 0.97, velocity: 0.7 },
      { pitch: 55, start: 3.9, duration: 0.98, velocity: 0.7 },
    ];
    expect(cleanup(hum, auto, free).notes).toHaveLength(4);
  });

  describe("smoothing", () => {
    // At 90 BPM, 0.1 beats is 67 ms and 0.15 beats is 100 ms.
    const noSnap = { ...auto, snap: false };

    it("folds a scoop up into the note it lands on", () => {
      const hum: Note[] = [
        { pitch: 62, start: 0, duration: 0.15, velocity: 0.5 }, // sliding up from below
        { pitch: 64, start: 0.15, duration: 1.2, velocity: 0.7 },
      ];
      const { notes } = cleanup(hum, noSnap, free);
      expect(notes.map(({ pitch, start, duration }) => ({ pitch, start, duration }))).toEqual([
        { pitch: 64, start: 0, duration: expect.closeTo(1.35, 9) },
      ]);
    });

    it("folds a fall-off into the note it trails from", () => {
      const hum: Note[] = [
        { pitch: 67, start: 0, duration: 1.5, velocity: 0.7 },
        { pitch: 65, start: 1.52, duration: 0.15, velocity: 0.4 },
      ];
      const { notes } = cleanup(hum, noSnap, free);
      expect(pitches(notes)).toEqual([67]);
      expect(notes[0].duration).toBeCloseTo(1.67, 9);
    });

    it("hears a held note with a vibrato wobble as one note", () => {
      const hum: Note[] = [
        { pitch: 64, start: 0, duration: 0.8, velocity: 0.7 },
        { pitch: 65, start: 0.8, duration: 0.12, velocity: 0.6 },
        { pitch: 64, start: 0.92, duration: 0.1, velocity: 0.6 },
        { pitch: 63, start: 1.02, duration: 0.13, velocity: 0.6 },
        { pitch: 64, start: 1.15, duration: 0.9, velocity: 0.7 },
      ];
      const { notes } = cleanup(hum, noSnap, free);
      expect(notes.map(({ pitch, duration }) => ({ pitch, duration }))).toEqual([{ pitch: 64, duration: expect.closeTo(2.05, 9) }]);
    });

    /** Notes sung one after another with no gap, as [pitch, beats]. */
    const legato = (notes: [number, number][]): Note[] => {
      let start = 0;
      return notes.map(([pitch, duration]) => {
        const n = { pitch, start, duration, velocity: 0.7 };
        start += duration;
        return n;
      });
    };

    it("hears a voice sitting between two semitones as one note", () => {
      // At 90 BPM, 0.3 beats is 200 ms: too long to be a slide, but the voice is just flickering across a semitone line.
      const hum = legato([[64, 0.45], [65, 0.3], [64, 0.4], [65, 0.25], [64, 0.45]]);
      const { notes } = cleanup(hum, noSnap, free);
      expect(notes.map(({ pitch, duration }) => ({ pitch, duration }))).toEqual([{ pitch: 64, duration: expect.closeTo(1.85, 9) }]);
    });

    it("hears a slow, wide vibrato as one held note", () => {
      const hum = legato([[64, 0.35], [65, 0.25], [64, 0.3], [63, 0.25], [64, 0.3], [65, 0.25], [64, 0.4]]);
      expect(pitches(cleanup(hum, noSnap, free).notes)).toEqual([64]);
    });

    it("keeps a melody that moves in quick, legato notes", () => {
      const hum = legato([[62, 0.3], [64, 0.3], [66, 0.3], [67, 0.3], [69, 0.6], [67, 0.3], [66, 0.3], [64, 0.6]]);
      expect(pitches(cleanup(hum, noSnap, free).notes)).toEqual([62, 64, 66, 67, 69, 67, 66, 64]);
    });

    it("keeps a held step of a semitone", () => {
      const hum = legato([[64, 1], [65, 1], [64, 1]]);
      expect(pitches(cleanup(hum, noSnap, free).notes)).toEqual([64, 65, 64]);
    });

    it("keeps a quick note that leaps away", () => {
      const hum: Note[] = [
        { pitch: 62, start: 0, duration: 1, velocity: 0.7 },
        { pitch: 69, start: 1, duration: 0.15, velocity: 0.7 },
        { pitch: 62, start: 1.15, duration: 1, velocity: 0.7 },
      ];
      expect(pitches(cleanup(hum, noSnap, free).notes)).toEqual([62, 69, 62]);
    });

    it("keeps a quick stepwise run", () => {
      const hum: Note[] = [62, 64, 65, 67, 69].map((pitch, i) => ({ pitch, start: i * 0.15, duration: 0.15, velocity: 0.7 }));
      expect(pitches(cleanup(hum, noSnap, free).notes)).toEqual([62, 64, 65, 67, 69]);
    });

    it("keeps quick notes a beat apart from their neighbours", () => {
      const hum: Note[] = [
        { pitch: 60, start: 0, duration: 0.5, velocity: 0.7 },
        { pitch: 62, start: 0.7, duration: 0.15, velocity: 0.7 },
        { pitch: 64, start: 1, duration: 0.5, velocity: 0.7 },
      ];
      expect(pitches(cleanup(hum, noSnap, free).notes)).toEqual([60, 62, 64]);
    });
  });

  it("reduces overlapping notes to one line, keeping the stronger note", () => {
    const hum: Note[] = [
      { pitch: 60, start: 0, duration: 1, velocity: 0.7 },
      { pitch: 72, start: 0, duration: 0.3, velocity: 0.3 }, // an overtone under the sung note
      { pitch: 62, start: 1, duration: 1, velocity: 0.4 },
      { pitch: 67, start: 1.05, duration: 0.9, velocity: 0.8 }, // louder, so it wins
      { pitch: 64, start: 1.9, duration: 1, velocity: 0.7 }, // a small legato overlap trims the note before
    ];
    const { notes } = cleanup(hum, { ...auto, snap: false }, free);
    expect(pitches(notes)).toEqual([60, 67, 64]);
    expect(notes[1].duration).toBeCloseTo(0.85, 9);
  });

  describe("key", () => {
    it("detects a minor key", () => {
      // A minor: A C E D C B A
      const hum: Note[] = [69, 72, 76, 74, 72, 71, 69].map((pitch, i) => ({ pitch, start: i, duration: i === 6 ? 2 : 0.9, velocity: 0.7 }));
      expect(cleanup(hum, auto, free).key).toEqual({ tonic: 9, mode: "minor" });
    });

    it("detects a major key that isn't C", () => {
      // D major: D E F# G A F# D
      const hum: Note[] = [62, 64, 66, 67, 69, 66, 62].map((pitch, i) => ({ pitch, start: i, duration: i === 6 ? 2 : 0.9, velocity: 0.7 }));
      expect(cleanup(hum, auto, free).key).toEqual({ tonic: 2, mode: "major" });
    });

    it("uses the key the songwriter chose instead of detecting one", () => {
      const hum: Note[] = [60, 62, 64, 65.3, 67].map((pitch, i) => ({ pitch, start: i, duration: 0.5, velocity: 0.7 }));
      const g = { tonic: 7, mode: "major" as const };
      const { key, notes } = cleanup(hum, { ...auto, key: g }, free);
      expect(key).toEqual(g);
      expect(pitches(notes)).toEqual([60, 62, 64, 66, 67]); // a brief, sharp F is not in G major, so it snaps up to F#
    });
  });

  describe("snapping", () => {
    // C major, with a brief F# and a long held Eb.
    const hum: Note[] = [
      { pitch: 60, start: 0, duration: 0.9, velocity: 0.7 },
      { pitch: 64, start: 1, duration: 0.9, velocity: 0.7 },
      { pitch: 67, start: 2, duration: 0.9, velocity: 0.7 },
      { pitch: 66, start: 3, duration: 0.4, velocity: 0.7 },
      { pitch: 67, start: 3.5, duration: 0.9, velocity: 0.7 },
      { pitch: 63, start: 4.5, duration: 1.5, velocity: 0.7 },
      { pitch: 60, start: 6, duration: 2, velocity: 0.7 },
    ];
    const c = { tonic: 0, mode: "major" as const };

    it("snaps a brief out-of-key note to the nearest note of the key and keeps a long held one", () => {
      const { notes } = cleanup(hum, { ...auto, key: c }, free);
      expect(pitches(notes)).toEqual([60, 64, 67, 67, 67, 63, 60]);
    });

    it("snaps nothing when snapping is off", () => {
      const { notes } = cleanup(hum, { ...auto, key: c, snap: false }, free);
      expect(pitches(notes)).toEqual([60, 64, 67, 66, 67, 63, 60]);
    });
  });

  describe("grid", () => {
    const hum: Note[] = [
      { pitch: 60, start: 0.07, duration: 0.4, velocity: 0.7 },
      { pitch: 62, start: 0.68, duration: 0.2, velocity: 0.7 },
      { pitch: 64, start: 1.05, duration: 0.9, velocity: 0.7 },
    ];

    it("quantizes a click take to eighth notes", () => {
      const { notes } = cleanup(hum, auto, click);
      expect(notes.map(({ start, duration }) => [start, duration])).toEqual([[0, 0.5], [0.5, 0.5], [1, 1]]);
    });

    it("quantizes a click take to sixteenth notes", () => {
      const { notes } = cleanup(hum, { ...auto, grid: 16 }, click);
      expect(notes.map(({ start, duration }) => [start, duration])).toEqual([[0, 0.5], [0.75, 0.25], [1, 1]]);
    });
  });

  it("moves a low hum up by octaves into piano range, keeping its intervals", () => {
    // Twinkle's first phrase two octaves down, around C2.
    const hum: Note[] = [36, 36, 43, 43, 45, 45, 43].map((pitch, i) => ({ pitch, start: i, duration: 0.9, velocity: 0.7 }));
    expect(pitches(cleanup(hum, auto, free).notes)).toEqual([60, 60, 67, 67, 69, 69, 67]);
  });

  it("gives the same melody every time for the same input", () => {
    const hum = hummedTwinkle();
    expect(cleanup(hum, auto, free)).toEqual(cleanup(hum, auto, free));
    expect(cleanup(hum, auto, click)).toEqual(cleanup(structuredClone(hum).reverse(), auto, click));
  });

  it("returns nothing for a silent take", () => {
    expect(cleanup([], auto, free).notes).toEqual([]);
  });
});
