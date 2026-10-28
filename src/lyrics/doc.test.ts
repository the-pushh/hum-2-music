import { describe, expect, it } from "vitest";
import { lyricsFromText, lyricsLines } from "./doc";

describe("lyrics written as plain lines", () => {
  it("become one verse, a line per line", () => {
    const doc = lyricsFromText("rainy bus window\nyour name on the glass");
    expect(lyricsLines(doc)).toEqual(["[Verse]", "rainy bus window", "your name on the glass"]);
  });

  it("keep blank lines between lines, so the editor shows the same gaps", () => {
    expect(lyricsLines(lyricsFromText("one\n\ntwo"))).toEqual(["[Verse]", "one", "", "two"]);
  });

  it("are an empty verse when nothing is written", () => {
    expect(lyricsFromText("")).toEqual({ type: "doc", content: [{ type: "section", attrs: { part: "verse" }, content: [{ type: "paragraph" }] }] });
  });
});
