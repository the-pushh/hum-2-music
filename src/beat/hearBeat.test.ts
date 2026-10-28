import { describe, expect, it } from "vitest";
import type { Take } from "@/melody/types";
import { hearBeat, type BeatFrame } from "./hearBeat";

const hopSec = 0.01;
const take: Take = { mode: "beat", bpm: 120, click: true };

/** The sound of each beatboxed hit, as the analyser measures it. */
const sounds = {
  kick: { centroid: 180, flatness: 0.1, lowShare: 0.8 },
  snare: { centroid: 2200, flatness: 0.45, lowShare: 0.15 },
  hat: { centroid: 7500, flatness: 0.7, lowShare: 0.02 },
};

type Hit = { at: number; sound: keyof typeof sounds; level?: number };

/** A take's frames: near-silence, with each hit a sharp rise that decays over 80 ms. `at` is in seconds. */
function frames(lengthSec: number, hits: Hit[]): BeatFrame[] {
  const out: BeatFrame[] = Array.from({ length: Math.round(lengthSec / hopSec) }, () => ({ rms: 0.002, centroid: 3000, flatness: 0.9, lowShare: 0.1 }));
  for (const { at, sound, level = 0.5 } of hits) {
    const first = Math.round(at / hopSec);
    for (let i = 0; i < 8 && first + i < out.length; i++) out[first + i] = { rms: level * (1 - i / 8), ...sounds[sound] };
  }
  return out;
}

describe("hearing a beat", () => {
  it("hears a kick-shaped burst as a kick on the beat it was made", () => {
    // At 120 BPM a beat is 0.5 s, so 0.5 s is beat 1.
    const hits = hearBeat(frames(2, [{ at: 0.5, sound: "kick" }]), hopSec, take);
    expect(hits).toHaveLength(1);
    expect(hits[0].pitch).toBe(36);
    expect(hits[0].start).toBeCloseTo(1, 1);
  });

  it("hears a backbeat: kick, hat, snare, hat across a bar", () => {
    const pattern: Hit[] = [
      { at: 0, sound: "kick" },
      { at: 0.25, sound: "hat" },
      { at: 0.5, sound: "snare" },
      { at: 0.75, sound: "hat" },
      { at: 1, sound: "kick" },
      { at: 1.25, sound: "hat" },
      { at: 1.5, sound: "snare" },
      { at: 1.75, sound: "hat" },
    ];
    const hits = hearBeat(frames(2.2, pattern), hopSec, take);
    expect(hits.map((h) => h.pitch)).toEqual([36, 42, 38, 42, 36, 42, 38, 42]);
    hits.forEach((h, i) => expect(h.start).toBeCloseTo(i * 0.5, 1));
  });

  it("hears nothing in a silent take", () => {
    expect(hearBeat(frames(2, []), hopSec, take)).toEqual([]);
    expect(hearBeat([], hopSec, take)).toEqual([]);
  });

  it("hears one hit, not several, while a hit rings on", () => {
    const ringing = frames(1, [{ at: 0.2, sound: "snare" }]);
    // A second, smaller bump 30 ms in, inside the same hit.
    ringing[23] = { ...ringing[23], rms: 0.45 };
    expect(hearBeat(ringing, hopSec, take)).toHaveLength(1);
  });

  it("gives harder hits a higher velocity", () => {
    const [soft, hard] = hearBeat(frames(1.5, [{ at: 0.2, sound: "kick", level: 0.15 }, { at: 0.8, sound: "kick", level: 0.6 }]), hopSec, take);
    expect(hard.velocity).toBe(1);
    expect(soft.velocity).toBeLessThan(hard.velocity);
    expect(soft.velocity).toBeGreaterThan(0);
  });

  it("measures hits in beats at the take's tempo", () => {
    const slow: Take = { mode: "beat", bpm: 60, click: false };
    const [hit] = hearBeat(frames(3, [{ at: 2, sound: "hat" }]), hopSec, slow);
    expect(hit.start).toBeCloseTo(2, 1);
  });
});
