import { describe, expect, it } from "vitest";
import { lineSyllables } from "./syllables";

describe("lineSyllables", () => {
  it("counts the syllables in a lyric line", () => {
    expect(lineSyllables("Twinkle twinkle little star")).toBe(7);
  });

  it("ignores punctuation", () => {
    expect(lineSyllables("Hold on, hold on... (hold on!)")).toBe(6);
  });

  it("counts contractions as they're sung", () => {
    expect(lineSyllables("I don't know where we're going")).toBe(7);
  });

  it("gives blank lines no count", () => {
    expect(lineSyllables("")).toBeNull();
    expect(lineSyllables("   ")).toBeNull();
  });

  it("gives bracketed section tags no count", () => {
    expect(lineSyllables("[Chorus]")).toBeNull();
    expect(lineSyllables("(Verse 2)")).toBeNull();
  });
});
