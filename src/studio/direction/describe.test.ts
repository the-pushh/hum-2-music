import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { defaultStyle } from "@/studio/generate/style";
import { readDescription, type DescribeContext, type ParseDirection } from "./describe";

const context: DescribeContext = {
  bpm: 100,
  key: "C",
  scale: "major",
  style: defaultStyle,
  tracks: [
    { id: "hum", name: "Hum 1", role: "melody", kind: "hummed melody", instrument: "piano" },
    { id: "beat", name: "Beat 1", role: "drums", kind: "hummed beat" },
    { id: "chords", name: "Chords", role: "keys", kind: "generated" },
  ],
};

/** A fake Claude call that answers with `reply`, or throws it. */
function claude(reply: { stop_reason: string; parsed_output: unknown } | Error): ParseDirection & ReturnType<typeof vi.fn> {
  return vi.fn(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  }) as never;
}

const good = { understood: true, summary: "72 BPM · in D", bpm: 72, key: "D" };

describe("reading a description", () => {
  it("returns the Direction Claude read", async () => {
    const result = await readDescription({ description: "slower, half-time", context }, claude({ stop_reason: "end_turn", parsed_output: good }));
    expect(result).toEqual({ ok: true, direction: good });
  });

  it("sends only the words and the arrangement's settings", async () => {
    const parse = claude({ stop_reason: "end_turn", parsed_output: good });
    await readDescription({ description: "slower, half-time", context }, parse);
    const [params] = parse.mock.calls[0] as unknown as [{ messages: { role: string; content: string }[] }];
    expect(params.messages).toHaveLength(1);
    expect(JSON.parse(params.messages[0].content)).toEqual({ description: "slower, half-time", arrangement: context });
  });

  it("calls output Claude couldn't shape into a Direction invalid", async () => {
    const result = await readDescription({ description: "x", context }, claude({ stop_reason: "end_turn", parsed_output: { understood: true, summary: "", bpm: 999 } }));
    expect(result).toEqual({ ok: false, error: "invalid-output" });
    expect(await readDescription({ description: "x", context }, claude({ stop_reason: "end_turn", parsed_output: null }))).toEqual({ ok: false, error: "invalid-output" });
  });

  it("says when Claude declined", async () => {
    expect(await readDescription({ description: "x", context }, claude({ stop_reason: "refusal", parsed_output: null }))).toEqual({ ok: false, error: "declined" });
  });

  it("says when the API key is missing or wrong", async () => {
    const unauthorized = new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", new Headers());
    expect(await readDescription({ description: "x", context }, claude(unauthorized))).toEqual({ ok: false, error: "not-configured" });
  });

  it("says when Claude took too long", async () => {
    expect(await readDescription({ description: "x", context }, claude(new Anthropic.APIConnectionTimeoutError()))).toEqual({ ok: false, error: "timeout" });
  });

  it("says when Claude couldn't be reached", async () => {
    expect(await readDescription({ description: "x", context }, claude(new Anthropic.APIConnectionError({ message: "fetch failed" })))).toEqual({ ok: false, error: "offline" });
  });

  it("says when Claude's side failed", async () => {
    const overloaded = new Anthropic.InternalServerError(529, undefined, "overloaded", new Headers());
    expect(await readDescription({ description: "x", context }, claude(overloaded))).toEqual({ ok: false, error: "upstream" });
  });

  it("refuses an empty description without calling Claude", async () => {
    const parse = claude({ stop_reason: "end_turn", parsed_output: good });
    expect(await readDescription({ description: "   ", context }, parse)).toEqual({ ok: false, error: "empty" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("passes through instruments for hummed melodies", async () => {
    const voiced = { understood: true, summary: "Hum 1 on strings", instruments: [{ trackId: "hum", instrument: "strings" }] };
    expect(await readDescription({ description: "hook on strings", context }, claude({ stop_reason: "end_turn", parsed_output: voiced }))).toEqual({ ok: true, direction: voiced });
  });

  it.each([
    ["a track it wasn't told about", "nope"],
    ["a hummed beat", "beat"],
    ["a generated track", "chords"],
  ])("calls an instrument for %s invalid", async (_, trackId) => {
    const bad = { understood: true, summary: "x", instruments: [{ trackId, instrument: "strings" }] };
    expect(await readDescription({ description: "x", context }, claude({ stop_reason: "end_turn", parsed_output: bad }))).toEqual({ ok: false, error: "invalid-output" });
  });
});

