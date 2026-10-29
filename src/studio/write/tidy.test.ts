import { describe, expect, it } from "vitest";
import type { Plan } from "@/studio/generate/plan";
import { defaultStyle } from "@/studio/generate/style";
import { maxNotesPerPart, tidyParts } from "./tidy";

/** Two bars of 4/4: the song ends at beat 8. */
const plan: Plan = { bpm: 100, key: "C", scale: "major", beatsPerBar: 4, bars: 2, style: defaultStyle };
const n = (pitch: number, startBeat: number, duration = 1, velocity = 90) => ({ pitch, startBeat, duration, velocity });
const shape = (notes: { pitch: number; startBeat: number; duration: number; velocity?: number }[] = []) => notes.map((x) => [x.pitch, x.startBeat, x.duration]);

describe("tidying the parts Claude wrote", () => {
  it("snaps starts and lengths to sixteenths", () => {
    expect(shape(tidyParts(plan, { bass: [n(40, 0.13, 0.9), n(43, 1.49, 0.12)] })?.bass)).toEqual([
      [40, 0.25, 1],
      [43, 1.5, 0.25],
    ]);
  });

  it("drops notes that start after the song and trims ones that run past its end", () => {
    expect(shape(tidyParts(plan, { bass: [n(40, 7, 4), n(40, 8, 1), n(40, 12, 1)] })?.bass)).toEqual([[40, 7, 1]]);
  });

  it("moves a bass note that's too high down by octaves into the bass range", () => {
    expect(shape(tidyParts(plan, { bass: [n(72, 0)] })?.bass)).toEqual([[48, 0, 1]]);
  });

  it("moves a chord note that's too low up by octaves into the chord range", () => {
    expect(shape(tidyParts(plan, { chords: [n(24, 0)] })?.chords)).toEqual([[48, 0, 1]]);
  });

  it("drops drums the kit can't play and keeps the ones it can", () => {
    expect(shape(tidyParts(plan, { drums: [n(36, 0, 0.25), n(81, 1, 0.25), n(38, 1, 0.25)] })?.drums)).toEqual([
      [36, 0, 0.25],
      [38, 1, 0.25],
    ]);
  });

  it("keeps velocity to MIDI's 1–127", () => {
    expect(tidyParts(plan, { bass: [n(40, 0, 1, 300), n(41, 1, 1, -5)] })?.bass?.map((x) => x.velocity)).toEqual([127, 1]);
  });

  it("collapses duplicates of the same note at the same time", () => {
    expect(shape(tidyParts(plan, { chords: [n(60, 0), n(60, 0.02), n(64, 0)] })?.chords)).toEqual([
      [60, 0, 1],
      [64, 0, 1],
    ]);
  });

  it("drops notes that aren't notes at all", () => {
    expect(shape(tidyParts(plan, { chords: [n(-3, 0), n(200, 0), n(60, -1), n(64, 0, 0), n(67, 0)] })?.chords)).toEqual([[67, 0, 1]]);
  });

  it("caps a part at the most notes a part can have", () => {
    const many = Array.from({ length: maxNotesPerPart + 50 }, (_, i) => n(36, (i % 32) * 0.25, 0.25));
    expect((tidyParts({ ...plan, bars: 64 }, { drums: many.map((x, i) => ({ ...x, startBeat: i * 0.25 })) })?.drums ?? []).length).toBe(maxNotesPerPart);
  });

  it("orders each part by time, then pitch", () => {
    expect(shape(tidyParts(plan, { chords: [n(67, 4), n(64, 0), n(60, 0)] })?.chords)).toEqual([
      [60, 0, 1],
      [64, 0, 1],
      [67, 4, 1],
    ]);
  });

  it("counts a part left with no notes as not written", () => {
    expect(tidyParts(plan, { bass: [n(40, 0)], drums: [n(81, 0)] })).toEqual({ bass: [{ pitch: 40, startBeat: 0, duration: 1, velocity: 90 }] });
  });

  it("finds nothing when every part is empty", () => {
    expect(tidyParts(plan, { chords: [], drums: [n(81, 0)] })).toBeNull();
    expect(tidyParts(plan, {})).toBeNull();
  });
});
