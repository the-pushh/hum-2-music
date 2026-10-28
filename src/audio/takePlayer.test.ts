import { afterEach, describe, expect, it, vi } from "vitest";

/** A fake smplr instrument: records each scheduled note and whether it was cancelled. */
const started: { note: number | string; cancelled: boolean }[] = [];
const fakeSound = {
  ready: Promise.resolve(),
  start(event: { note: number | string }) {
    const entry = { note: event.note, cancelled: false };
    started.push(entry);
    return () => {
      entry.cancelled = true;
    };
  },
  stop: vi.fn(),
};

vi.mock("./context", () => ({ audioContext: async () => ({ currentTime: 0 }) }));
vi.mock("@/instruments/sound", () => ({ createSound: () => fakeSound, sampleVelocity: (v: number) => Math.round(40 + v * 70) }));
vi.mock("@/instruments/drums", () => ({ createDrums: () => fakeSound, drumSample: (pitch: number) => (pitch === 36 ? "kick" : undefined) }));

const { playBeat, playMelody } = await import("./takePlayer");

const notes = [0, 1, 2, 3].map((i) => ({ pitch: 60 + i, start: i, duration: 1, velocity: 0.7 }));

afterEach(() => {
  started.length = 0;
});

describe("playing a take on the card", () => {
  it("stops every note when paused, including ones not played yet", async () => {
    const onEnded = vi.fn();
    const playback = await playMelody(notes, 90, "strings", onEnded);
    expect(started).toHaveLength(4);

    playback.pause();
    expect(started.every((n) => n.cancelled)).toBe(true);
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it("stops a beat's hits when paused", async () => {
    const playback = await playBeat([{ pitch: 36, start: 0, duration: 0.25, velocity: 1 }, { pitch: 36, start: 2, duration: 0.25, velocity: 1 }], 90, () => {});
    playback.pause();
    expect(started.map((n) => [n.note, n.cancelled])).toEqual([
      ["kick", true],
      ["kick", true],
    ]);
  });
});
