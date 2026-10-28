import { describe, expect, it } from "vitest";
import { scalePitchClasses } from "@/studio/music";
import { generateBass } from "./bass";
import type { Chord } from "./chords";
import { generateDrums } from "./drums";
import type { Plan } from "./plan";
import { defaultStyle, type Style } from "./style";

const plan: Plan = { bpm: 100, key: "C", scale: "major", beatsPerBar: 4, bars: 4, style: defaultStyle };

/** I IV V I in C, as the chords Generator voices them. */
const progression: Chord[] = [
  { bar: 0, numeral: "I", root: 0, pitches: [60, 64, 67] },
  { bar: 1, numeral: "IV", root: 5, pitches: [53, 57, 60] },
  { bar: 2, numeral: "V", root: 7, pitches: [55, 59, 62] },
  { bar: 3, numeral: "I", root: 0, pitches: [60, 64, 67] },
];

const C2 = 36, D2 = 38, E2 = 40, F2 = 41, G2 = 43;

describe("bass", () => {
  it("plays each chord's root on beats 1 and 3, stepping into the next chord on beat 4", () => {
    expect(generateBass(plan, progression).map((n) => [n.pitch, n.startBeat, n.duration])).toEqual([
      [C2, 0, 2],
      [C2, 2, 1],
      [E2, 3, 1], // up into F
      [F2, 4, 2],
      [F2, 6, 1],
      [F2, 7, 1], // up into G: the step below G in C major is F
      [G2, 8, 2],
      [G2, 10, 1],
      [D2, 11, 1], // down into C
      [C2, 12, 2],
      [C2, 14, 2],
    ]);
  });

  it("holds the root through the bar when the next chord is the same", () => {
    const same: Chord[] = [progression[0], { ...progression[0], bar: 1 }];
    expect(generateBass({ ...plan, bars: 2 }, same).map((n) => [n.pitch, n.startBeat, n.duration])).toEqual([
      [C2, 0, 2],
      [C2, 2, 2],
      [C2, 4, 2],
      [C2, 6, 2],
    ]);
  });

  it("stays in the key, in the second octave", () => {
    const inKey = scalePitchClasses("C", "major");
    for (const n of generateBass(plan, progression)) {
      expect(inKey.has(n.pitch % 12)).toBe(true);
      expect(n.pitch).toBeGreaterThanOrEqual(36);
      expect(n.pitch).toBeLessThan(48);
    }
  });

  it("gives the same line every time", () => {
    expect(generateBass(plan, progression)).toEqual(generateBass(plan, progression));
  });
});

describe("pop/rock drums", () => {
  const hits = (pitch: number, bars = 2) =>
    generateDrums({ ...plan, bars })
      .filter((n) => n.pitch === pitch)
      .map((n) => n.startBeat);

  it("kicks on 1 and 3 and snares on 2 and 4, every bar", () => {
    expect(hits(36)).toEqual([0, 2, 4, 6]);
    expect(hits(38)).toEqual([1, 3, 5, 7]);
  });

  it("plays eighth note hats", () => {
    expect(hits(42, 1)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  });

  it("crashes once, on the first downbeat", () => {
    expect(hits(49, 4)).toEqual([0]);
  });

  it("is the default drum feel", () => {
    expect(defaultStyle.drums).toBe("pop-rock");
  });

  it("covers exactly the bars of the plan with short hits", () => {
    const drums = generateDrums(plan);
    expect(Math.max(...drums.map((n) => n.startBeat))).toBeLessThan(plan.bars * plan.beatsPerBar);
    expect(drums.every((n) => n.duration === 0.25)).toBe(true);
    expect(drums).toEqual(generateDrums(plan));
  });
});

describe("drum feels", () => {
  /** The second bar of a feel (the first has the crash), as [drum, beat in the bar]. */
  const bar = (drums: Style["drums"]) =>
    generateDrums({ ...plan, bars: 2, style: { ...defaultStyle, drums } })
      .filter((n) => n.startBeat >= 4)
      .map((n) => [name[n.pitch], n.startBeat - 4]);
  const name: Record<number, string> = { 36: "kick", 38: "snare", 42: "hat", 46: "open" };

  it("four on the floor: a kick on every beat, snares on 2 and 4, open hats on the offbeats", () => {
    expect(bar("four-on-the-floor")).toEqual([
      ["kick", 0],
      ["open", 0.5],
      ["kick", 1],
      ["snare", 1],
      ["open", 1.5],
      ["kick", 2],
      ["open", 2.5],
      ["kick", 3],
      ["snare", 3],
      ["open", 3.5],
    ]);
  });

  it("half-time: a kick on 1, a snare only on 3, eighth hats", () => {
    const b = bar("half-time");
    expect(b.filter(([d]) => d === "kick")).toEqual([["kick", 0]]);
    expect(b.filter(([d]) => d === "snare")).toEqual([["snare", 2]]);
    expect(b.filter(([d]) => d === "hat").map(([, at]) => at)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  });

  it("boom bap: kicks on 1, the and of 2 and the and of 3, snares on 2 and 4", () => {
    const b = bar("boom-bap");
    expect(b.filter(([d]) => d === "kick")).toEqual([
      ["kick", 0],
      ["kick", 1.5],
      ["kick", 2.5],
    ]);
    expect(b.filter(([d]) => d === "snare")).toEqual([
      ["snare", 1],
      ["snare", 3],
    ]);
  });

  it("none: no drums at all", () => {
    expect(generateDrums({ ...plan, style: { ...defaultStyle, drums: "none" } })).toEqual([]);
  });

  it("crashes on the first downbeat in every feel that has drums", () => {
    for (const drums of ["pop-rock", "four-on-the-floor", "half-time", "boom-bap"] as const) {
      const first = generateDrums({ ...plan, style: { ...defaultStyle, drums } }).filter((n) => n.pitch === 49);
      expect(first.map((n) => n.startBeat)).toEqual([0]);
    }
  });
});
