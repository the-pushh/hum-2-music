import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultStyle } from "@/studio/generate/style";

const readDescription = vi.fn();
vi.mock("@/studio/direction/describe", () => ({ readDescription }));

const { POST } = await import("./route");

const context = { bpm: 100, key: "C", scale: "major", style: defaultStyle, tracks: [{ id: "hum", name: "Hum 1", role: "melody", kind: "hummed melody", instrument: "piano" }] };
const post = (body: unknown, signal?: AbortSignal) =>
  POST(new Request("http://hum.test/api/describe", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), signal }));

const saved = { key: process.env.ANTHROPIC_API_KEY, token: process.env.ANTHROPIC_AUTH_TOKEN };
beforeEach(() => {
  readDescription.mockReset();
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = saved.key;
  process.env.ANTHROPIC_AUTH_TOKEN = saved.token;
  if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY;
  if (saved.token === undefined) delete process.env.ANTHROPIC_AUTH_TOKEN;
});

describe("POST /api/describe", () => {
  it("says it isn't set up when there's no key, without calling Claude", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await post({ description: "slower", context });
    expect(await response.json()).toEqual({ ok: false, error: "not-configured" });
    expect(readDescription).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", "{nope"],
    ["no description", { context }],
    ["a description that's too long", { description: "x".repeat(501), context }],
    ["an unknown style", { description: "x", context: { ...context, style: { ...defaultStyle, drums: "trap" } } }],
  ])("refuses a body with %s", async (_, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "bad-request" });
    expect(readDescription).not.toHaveBeenCalled();
  });

  it("reads the description with the words, the settings and the request's abort signal", async () => {
    readDescription.mockResolvedValue({ ok: true, direction: { understood: true, summary: "80 BPM", bpm: 80 } });
    const controller = new AbortController();
    const response = await post({ description: "around 80", context }, controller.signal);

    expect(await response.json()).toEqual({ ok: true, direction: { understood: true, summary: "80 BPM", bpm: 80 } });
    const [request, , signal] = readDescription.mock.calls[0];
    expect(request).toEqual({ description: "around 80", context });
    controller.abort();
    expect((signal as AbortSignal).aborted).toBe(true);
  });
});
