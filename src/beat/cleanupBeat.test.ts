import { describe, expect, it } from "vitest";
import type { Note, Take } from "@/melody/types";
import { cleanupBeat } from "./cleanupBeat";

const click: Take = { mode: "beat", bpm: 100, click: true };
const free: Take = { mode: "beat", bpm: 100, click: false };
const hit = (pitch: number, start: number, velocity = 0.8): Note => ({ pitch, start, duration: 0.25, velocity });

// Kick, hat, snare, hat, played a little early and late.
const loose = [hit(36, 0.04), hit(42, 0.47), hit(38, 1.06), hit(42, 1.53)];

describe("cleaning up a beat", () => {
  it("snaps a clicked take's hits to eighth notes", () => {
    expect(cleanupBeat(loose, 8, click).map((h) => [h.pitch, h.start])).toEqual([
      [36, 0],
      [42, 0.5],
      [38, 1],
      [42, 1.5],
    ]);
  });

  it("snaps to sixteenths when asked", () => {
    expect(cleanupBeat([hit(42, 0.27), hit(42, 0.7)], 16, click).map((h) => h.start)).toEqual([0.25, 0.75]);
  });

  it("keeps the louder of two hits of the same drum that land on one step", () => {
    const cleaned = cleanupBeat([hit(36, 0.95, 0.4), hit(36, 1.05, 0.9), hit(42, 1.02)], 8, click);
    expect(cleaned.map((h) => [h.pitch, h.start, h.velocity])).toEqual([
      [36, 1, 0.9],
      [42, 1, 0.8],
    ]);
  });

  it("keeps a free take's timing", () => {
    expect(cleanupBeat(loose, 8, free)).toEqual(loose);
  });

  it("orders hits by time", () => {
    expect(cleanupBeat([hit(38, 1), hit(36, 0)], 8, click).map((h) => h.pitch)).toEqual([36, 38]);
  });
});
