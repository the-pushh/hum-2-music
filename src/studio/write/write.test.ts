import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { defaultStyle } from "@/studio/generate/style";
import type { Clip, Project, Track } from "@/studio/types";
import { writeRequestOf } from "./request";
import { writeParts, type ParseParts, type WriteRequest } from "./write";

const request: WriteRequest = {
  plan: { bpm: 100, key: "C", scale: "major", beatsPerBar: 4, bars: 2, style: defaultStyle },
  melody: [{ pitch: 60, startBeat: 0, duration: 1 }],
  beat: [],
  parts: ["chords", "bass", "drums"],
  note: "busier bass",
};

/** A fake Claude call that answers with `reply`, or throws it. */
function claude(reply: { stop_reason: string; parsed_output: unknown } | Error): ParseParts & ReturnType<typeof vi.fn> {
  return vi.fn(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  }) as never;
}

const reply = {
  summary: "Held chords, a root bass, a backbeat",
  chords: [60, 64, 67].map((pitch) => ({ pitch, startBeat: 0, duration: 4, velocity: 70 })),
  bass: [{ pitch: 72, startBeat: 0.1, duration: 2, velocity: 100 }],
  drums: [{ pitch: 36, startBeat: 0, duration: 0.25, velocity: 110 }],
};

describe("writing parts with Claude", () => {
  it("returns Claude's parts tidied, with its summary", async () => {
    const result = await writeParts(request, claude({ stop_reason: "end_turn", parsed_output: reply }));
    expect(result).toEqual({
      ok: true,
      summary: "Held chords, a root bass, a backbeat",
      parts: {
        chords: [60, 64, 67].map((pitch) => ({ pitch, startBeat: 0, duration: 4, velocity: 70 })),
        bass: [{ pitch: 48, startBeat: 0, duration: 2, velocity: 100 }],
        drums: [{ pitch: 36, startBeat: 0, duration: 0.25, velocity: 110 }],
      },
    });
  });

  it("keeps only the parts it asked for", async () => {
    const result = await writeParts({ ...request, parts: ["bass"] }, claude({ stop_reason: "end_turn", parsed_output: reply }));
    expect(result.ok && Object.keys(result.parts)).toEqual(["bass"]);
  });

  it("sends only the plan, the melody, the beat, the parts to write and the note", async () => {
    const parse = claude({ stop_reason: "end_turn", parsed_output: reply });
    await writeParts(request, parse);
    const [params] = parse.mock.calls[0] as unknown as [{ messages: { content: string }[] }];
    expect(params.messages).toHaveLength(1);
    expect(JSON.parse(params.messages[0].content)).toEqual(request);
  });

  it("refuses a song longer than 32 bars without calling Claude", async () => {
    const parse = claude({ stop_reason: "end_turn", parsed_output: reply });
    expect(await writeParts({ ...request, plan: { ...request.plan, bars: 33 } }, parse)).toEqual({ ok: false, error: "too-long" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("has nothing to do when no parts are asked for", async () => {
    const parse = claude({ stop_reason: "end_turn", parsed_output: reply });
    expect(await writeParts({ ...request, parts: [] }, parse)).toEqual({ ok: false, error: "nothing-to-write" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("calls a reply with no playable notes invalid", async () => {
    const empty = { summary: "x", drums: [{ pitch: 81, startBeat: 0, duration: 0.25, velocity: 100 }] };
    expect(await writeParts(request, claude({ stop_reason: "end_turn", parsed_output: empty }))).toEqual({ ok: false, error: "invalid-output" });
    expect(await writeParts(request, claude({ stop_reason: "end_turn", parsed_output: null }))).toEqual({ ok: false, error: "invalid-output" });
    expect(await writeParts(request, claude({ stop_reason: "max_tokens", parsed_output: null }))).toEqual({ ok: false, error: "invalid-output" });
  });

  it("says when Claude declined", async () => {
    expect(await writeParts(request, claude({ stop_reason: "refusal", parsed_output: null }))).toEqual({ ok: false, error: "declined" });
  });

  it.each([
    ["not-configured", new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", new Headers())],
    ["timeout", new Anthropic.APIConnectionTimeoutError()],
    ["offline", new Anthropic.APIConnectionError({ message: "fetch failed" })],
    ["upstream", new Anthropic.InternalServerError(529, undefined, "overloaded", new Headers())],
  ])("maps a failed call to %s", async (error, thrown) => {
    expect(await writeParts(request, claude(thrown))).toEqual({ ok: false, error });
  });
});

describe("what to ask Claude for", () => {
  const hum: Track = { id: "hum", projectId: "p", name: "Hum 1", type: "midi", color: "melody", volume: 0.8, pan: 0, muted: false, solo: false, armed: false, order: 0, instrumentPreset: "hum-piano", origin: { kind: "hum", ideaId: "i" } };
  const humClip: Clip = { id: "c", trackId: "hum", type: "midi", name: "Hum", startBar: 0, lengthBars: 1, notes: [{ id: "n", pitch: 60, startBeat: 0, duration: 1, velocity: 100 }] };
  const project: Project = { id: "p", name: "Song", bpm: 100, key: "C", scale: "major", timeSignature: [4, 4], tracks: [hum], clips: [humClip], createdAt: 0, updatedAt: 0 };

  it("asks for chords, bass and drums for a hummed melody, with the note", () => {
    const asked = writeRequestOf(project, "  sparse  ");
    expect(asked).toMatchObject({ parts: ["chords", "bass", "drums"], note: "sparse", melody: [{ pitch: 60, startBeat: 0, duration: 1 }], beat: [] });
  });

  it("leaves out parts the Style sets to none", () => {
    const asked = writeRequestOf({ ...project, style: { ...defaultStyle, drums: "none", bass: "none" } }, "");
    expect("parts" in asked && asked.parts).toEqual(["chords"]);
  });

  it("sends a hummed beat's hits and doesn't ask for drums over it", () => {
    const beat: Track = { ...hum, id: "beat", name: "Beat 1", type: "drum", color: "drums", instrumentPreset: "hum-drums", origin: { kind: "hum", ideaId: "b" } };
    const beatClip: Clip = { id: "bc", trackId: "beat", type: "drum", name: "Beat", startBar: 1, lengthBars: 1, notes: [{ id: "k", pitch: 36, startBeat: 0.5, duration: 0.25, velocity: 100 }] };
    const asked = writeRequestOf({ ...project, tracks: [hum, beat], clips: [humClip, beatClip] }, "");
    expect(asked).toMatchObject({ parts: ["chords", "bass"], beat: [{ pitch: 36, startBeat: 4.5 }] });
  });

  it("asks only for drums when there's no melody", () => {
    expect(writeRequestOf({ ...project, clips: [] }, "")).toMatchObject({ parts: ["drums"] });
  });
});
