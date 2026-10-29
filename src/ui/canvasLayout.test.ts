import { describe, expect, it } from "vitest";
import { CARD_GAP, CARD_WIDTH, columnLayout, freeSpot, pageView, spanWidth, stack, type Rect } from "./canvasLayout";

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("column layout", () => {
  it("lays cards out in order, each in the shortest column", () => {
    const places = columnLayout(
      [
        { id: "a", h: 300 },
        { id: "b", h: 100 },
        { id: "c", h: 100 },
        { id: "d", h: 50 },
      ],
      2,
    );
    const col = CARD_WIDTH + CARD_GAP;
    expect(places).toEqual({
      a: { x: 0, y: 0 },
      b: { x: col, y: 0 },
      c: { x: col, y: 100 + CARD_GAP },
      d: { x: col, y: 200 + 2 * CARD_GAP },
    });
  });

  it("starts lower down and keeps the gap it's given", () => {
    const places = columnLayout([{ id: "a", h: 100 }, { id: "b", h: 50 }, { id: "c", h: 10 }], 2, { gap: 12, top: 400 });
    expect(places).toEqual({ a: { x: 0, y: 400 }, b: { x: CARD_WIDTH + 12, y: 400 }, c: { x: CARD_WIDTH + 12, y: 462 } });
  });

  it("lays a wide card across two columns, under the lower of the two", () => {
    const col = CARD_WIDTH + 12;
    const places = columnLayout(
      [
        { id: "a", h: 100 },
        { id: "wide", h: 300, span: 2 },
        { id: "b", h: 50 },
      ],
      3,
      { gap: 12 },
    );
    // "wide" takes columns 1 and 2, which are both empty; "b" then fits under "a".
    expect(places).toEqual({ a: { x: 0, y: 0 }, wide: { x: col, y: 0 }, b: { x: 0, y: 112 } });
  });

  it("lays a wide card in one column when there's only one", () => {
    expect(columnLayout([{ id: "wide", h: 300, span: 2 }, { id: "a", h: 10 }], 1, { gap: 12 })).toEqual({
      wide: { x: 0, y: 0 },
      a: { x: 0, y: 312 },
    });
  });

  it("says how wide a card spanning columns is", () => {
    expect(spanWidth(1, 12)).toBe(CARD_WIDTH);
    expect(spanWidth(2, 12)).toBe(2 * CARD_WIDTH + 12);
  });

  it("uses at least one column", () => {
    expect(columnLayout([{ id: "a", h: 10 }, { id: "b", h: 10 }], 0)).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 10 + CARD_GAP } });
  });
});

describe("free spot", () => {
  it("puts a card centred on the point when nothing is in the way", () => {
    expect(freeSpot([], { w: 240, h: 100 }, { x: 500, y: 300 })).toEqual({ x: 380, y: 250 });
  });

  it("never lands on another card, and stays near the point", () => {
    const taken: Rect[] = [{ x: 380, y: 250, w: 240, h: 100 }];
    const spot = freeSpot(taken, { w: 240, h: 100 }, { x: 500, y: 300 });
    const placed = { ...spot, w: 240, h: 100 };
    expect(overlaps(placed, taken[0])).toBe(false);
    expect(Math.hypot(spot.x - 380, spot.y - 250)).toBeLessThan(400);
  });

  it("keeps a gap between cards", () => {
    const taken: Rect[] = [{ x: 0, y: 0, w: 240, h: 240 }];
    const spot = freeSpot(taken, { w: 240, h: 240 }, { x: 120, y: 120 });
    const grown = { x: spot.x - CARD_GAP + 1, y: spot.y - CARD_GAP + 1, w: 240 + 2 * CARD_GAP - 2, h: 240 + 2 * CARD_GAP - 2 };
    expect(overlaps(grown, taken[0])).toBe(false);
  });

  it("can keep a smaller gap", () => {
    const taken: Rect[] = [{ x: 0, y: 0, w: 576, h: 64 }];
    expect(freeSpot(taken, { w: 576, h: 64 }, { x: 288, y: 72 + 32 }, 8)).toEqual({ x: 0, y: 72 });
  });

  it("finds room on a crowded canvas", () => {
    const taken: Rect[] = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) taken.push({ x: c * 264, y: r * 264, w: 240, h: 240 });
    const spot = freeSpot(taken, { w: 240, h: 240 }, { x: 1000, y: 1000 });
    expect(taken.some((t) => overlaps({ ...spot, w: 240, h: 240 }, t))).toBe(false);
  });
});

describe("stack", () => {
  it("puts sections one under another, at the left or right edge, and says where it ended", () => {
    const { places, bottom } = stack(
      [
        { id: "title", size: { w: 300, h: 80 } },
        { id: "capture", size: { w: 576, h: 200 } },
        { id: "tools", size: { w: 200, h: 40 }, align: "end" },
      ],
      { width: 1024, gap: 24 },
    );
    expect(places).toEqual({ title: { x: 0, y: 0 }, capture: { x: 0, y: 104 }, tools: { x: 824, y: 328 } });
    expect(bottom).toBe(368);
  });

  it("starts where it's told", () => {
    expect(stack([{ id: "a", size: { w: 10, h: 10 } }], { width: 100, gap: 8, top: 50 })).toEqual({ places: { a: { x: 0, y: 50 } }, bottom: 60 });
  });
});

describe("page view", () => {
  const viewport = { w: 1000, h: 600 };

  it("shows the canvas origin at actual size when there's nothing on it", () => {
    expect(pageView([], viewport)).toEqual({ x: 16, y: 32, scale: 1 });
  });

  it("shows the page at actual size from its top, centred when it fits", () => {
    expect(pageView([{ x: 0, y: 0, w: 600, h: 2000 }], viewport)).toEqual({ x: 200, y: 32, scale: 1 });
  });

  it("starts from the left edge, with a gutter, when the page is wider than the screen", () => {
    expect(pageView([{ x: -100, y: 50, w: 1500, h: 100 }], viewport)).toEqual({ x: 116, y: -18, scale: 1 });
  });
});
