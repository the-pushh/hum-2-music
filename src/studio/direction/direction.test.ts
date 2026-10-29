import { describe, expect, it } from "vitest";
import { directionSchema } from "./schema";

describe("reading a Direction", () => {
  it("accepts a well-formed Direction", () => {
    const raw = { understood: true, summary: "72 BPM · in D", bpm: 72, key: "D" };
    expect(directionSchema.parse(raw)).toEqual(raw);
  });

  it("accepts one that understood nothing", () => {
    expect(directionSchema.parse({ understood: false, summary: "" })).toEqual({ understood: false, summary: "" });
  });

  it.each([
    ["a tempo too fast", { bpm: 300 }],
    ["a tempo too slow", { bpm: 20 }],
    ["an unknown key", { key: "H" }],
    ["an unknown scale", { scale: "dorian" }],
  ])("rejects %s", (_, extra) => {
    expect(directionSchema.safeParse({ understood: true, summary: "x", ...extra }).success).toBe(false);
  });
});
