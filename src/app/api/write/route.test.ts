import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultStyle } from "@/studio/generate/style";

const writeParts = vi.fn();
vi.mock("@/studio/write/write", async (actual) => ({ ...(await actual<object>()), writeParts }));

const { POST } = await import("./route");

const body = {
  plan: { bpm: 100, key: "C", scale: "major", beatsPerBar: 4, bars: 2, style: defaultStyle },
  melody: [{ pitch: 60, startBeat: 0, duration: 1 }],
  beat: [],
  parts: ["chords", "bass"],
  note: "",
};
const post = (b: unknown, signal?: AbortSignal) =>
  POST(new Request("http://hum.test/api/write", { method: "POST", body: typeof b === "string" ? b : JSON.stringify(b), signal }));

const saved = { key: process.env.ANTHROPIC_API_KEY, token: process.env.ANTHROPIC_AUTH_TOKEN };
beforeEach(() => {
  writeParts.mockReset();
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});
afterEach(() => {
  if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = saved.key;
  if (saved.token === undefined) delete process.env.ANTHROPIC_AUTH_TOKEN;
  else process.env.ANTHROPIC_AUTH_TOKEN = saved.token;
});

describe("POST /api/write", () => {
  it("says it isn't set up when there's no key, without calling Claude", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await (await post(body)).json()).toEqual({ ok: false, error: "not-configured" });
    expect(writeParts).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", "{nope"],
    ["an unknown part", { ...body, parts: ["vocals"] }],
    ["a note that's too long", { ...body, note: "x".repeat(301) }],
    ["a tempo out of range", { ...body, plan: { ...body.plan, bpm: 900 } }],
  ])("refuses a body with %s", async (_, b) => {
    const response = await post(b);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "bad-request" });
    expect(writeParts).not.toHaveBeenCalled();
  });

  it("writes with the request as sent and the request's abort signal", async () => {
    writeParts.mockResolvedValue({ ok: true, summary: "Held chords", parts: { chords: [] } });
    const controller = new AbortController();
    const response = await post(body, controller.signal);
    expect(await response.json()).toEqual({ ok: true, summary: "Held chords", parts: { chords: [] } });
    const [request, , signal] = writeParts.mock.calls[0];
    expect(request).toEqual(body);
    controller.abort();
    expect((signal as AbortSignal).aborted).toBe(true);
  });
});
