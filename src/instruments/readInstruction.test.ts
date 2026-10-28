import { describe, expect, it } from "vitest";
import { readInstruction } from "./readInstruction";

describe("reading an instrument from words", () => {
  it.each([
    ["I want it as a piano", "piano"],
    ["make it the bassline", "bass"],
    ["Rhodes", "electric-piano"],
    ["electric piano please", "electric-piano"],
    ["not piano, strings", "strings"],
    ["a cool synth lead", "synth-lead"],
    ["This is a bass line.", "bass"],
    ["Violins!", "strings"],
    ["play it on an acoustic guitar", "guitar"],
    ["give me horns", "brass"],
    ["FLUTE", "flute"],
    ["some warm pad", "pad"],
  ])("reads %j as %s", (words, instrument) => {
    expect(readInstruction(words)).toBe(instrument);
  });

  it.each([[""], ["   "], ["I don't know yet"], ["make it sadder"], ["pianist"], ["leader"]])("reads nothing in %j", (words) => {
    expect(readInstruction(words)).toBeUndefined();
  });
});
