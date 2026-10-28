import { describe, expect, it } from "vitest";
import { scalePitchClasses } from "@/studio/music";
import { generateChords, type MelodyNote } from "./chords";
import type { Plan } from "./plan";
import { defaultStyle } from "./style";

const cMajor: Plan = { bpm: 90, key: "C", scale: "major", beatsPerBar: 4, bars: 4, style: defaultStyle };
const aMinor: Plan = { ...cMajor, key: "A", scale: "minor" };

/** Quarter notes from beat 0, with optional longer notes as [pitch, beats]. */
function melody(...notes: (number | [number, number])[]): MelodyNote[] {
  let at = 0;
  return notes.map((n) => {
    const [pitch, duration] = typeof n === "number" ? [n, 1] : n;
    const note = { pitch, startBeat: at, duration };
    at += duration;
    return note;
  });
}

const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74;

describe("chords for a melody", () => {
  it("hears I IV V I in a melody that outlines them", () => {
    const tune = melody(C4, E4, G4, E4, F4, A4, C5, A4, G4, B4, D5, B4, [C5, 4]);
    expect(generateChords(cMajor, tune).map((c) => c.numeral)).toEqual(["I", "IV", "V", "I"]);
  });

  it("uses the raised seventh's major V in a minor key", () => {
    const Gs4 = 68;
    const tune = melody(A4 - 12, C4, E4, C4, D4, F4, A4, F4, E4, Gs4, B4, Gs4, [A4, 4]);
    expect(generateChords(aMinor, tune).map((c) => c.numeral)).toEqual(["i", "iv", "V", "i"]);
  });

  it("hears I I IV I in Twinkle Twinkle: one chord a bar can't change under A A G, and leans home at the end", () => {
    // C C G G | A A G- | F F E E | D D C-
    const twinkle = melody(C4, C4, G4, G4, A4, A4, [G4, 2], F4, F4, E4, E4, D4, D4, [C4, 2]);
    const chords = generateChords(cMajor, twinkle).map((c) => c.numeral);
    expect(chords).toEqual(["I", "I", "IV", "I"]);
  });

  it("changes chord at most once per bar, one chord for every bar of the plan", () => {
    const chords = generateChords({ ...cMajor, bars: 6 }, melody(C4, E4, G4));
    expect(chords.map((c) => c.bar)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("only uses notes of the key", () => {
    const inKey = scalePitchClasses("C", "major");
    const twinkle = melody(C4, C4, G4, G4, A4, A4, [G4, 2], F4, F4, E4, E4, D4, D4, [C4, 2]);
    for (const chord of generateChords(cMajor, twinkle)) {
      for (const pitch of chord.pitches) expect(inKey.has(pitch % 12), `${pitch} in ${chord.numeral}`).toBe(true);
    }
  });

  it("voices triads around middle C, root first", () => {
    const [I, IV, V] = generateChords(cMajor, melody(C4, E4, G4, E4, F4, A4, C5, A4, G4, B4, D5, B4));
    expect(I.pitches).toEqual([60, 64, 67]);
    expect(IV.pitches).toEqual([53, 57, 60]);
    expect(V.pitches).toEqual([55, 59, 62]);
  });

  it("gives the same chords every time", () => {
    const tune = melody(C4, D4, E4, F4, G4, A4, B4, C5);
    expect(generateChords(cMajor, tune)).toEqual(generateChords(cMajor, tune));
  });

  it("rests on the tonic when there's no melody", () => {
    expect(generateChords(aMinor, []).map((c) => c.numeral)).toEqual(["i", "i", "i", "i"]);
  });
});
