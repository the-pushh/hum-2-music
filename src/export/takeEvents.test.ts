import { describe, expect, it } from "vitest";
import type { Note } from "@/melody/types";
import { takeEvents } from "./takeEvents";

const note = (pitch: number, start: number, duration: number, velocity: number): Note => ({ pitch, start, duration, velocity });

describe("a take as sound events", () => {
  it("plays melody notes in seconds at the take's tempo, on the instrument's velocity range", () => {
    // 120 BPM: half a second a beat.
    expect(takeEvents([note(60, 0, 1, 0), note(64, 2, 0.5, 1)], 120, false)).toEqual([
      { note: 60, time: 0, duration: 0.5, velocity: 40 },
      { note: 64, time: 1, duration: 0.25, velocity: 110 },
    ]);
  });

  it("plays beat hits on the drum machine's samples, skipping drums it doesn't have", () => {
    expect(takeEvents([note(36, 0, 0.25, 1), note(81, 1, 0.25, 1), note(38, 1, 0.25, 0.5)], 60, true)).toEqual([
      { note: "kick", time: 0, duration: 0.25, velocity: 127 },
      { note: "snare-m", time: 1, duration: 0.25, velocity: 64 },
    ]);
  });

  it("starts later when asked, for playing a moment after now", () => {
    expect(takeEvents([note(60, 1, 1, 0.5)], 60, false, 0.05)[0].time).toBeCloseTo(1.05);
  });
});
