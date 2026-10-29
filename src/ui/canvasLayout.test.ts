import { describe, expect, it } from "vitest";
import { CARD_GAP, CARD_WIDTH, columnLayout, fitView, freeSpot, type Rect } from "./canvasLayout";

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

  it("finds room on a crowded canvas", () => {
    const taken: Rect[] = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) taken.push({ x: c * 264, y: r * 264, w: 240, h: 240 });
    const spot = freeSpot(taken, { w: 240, h: 240 }, { x: 1000, y: 1000 });
    expect(taken.some((t) => overlaps({ ...spot, w: 240, h: 240 }, t))).toBe(false);
  });
});

describe("fit view", () => {
  const viewport = { w: 1000, h: 600 };

  it("shows the canvas origin at actual size when there's nothing on it", () => {
    expect(fitView([], viewport)).toEqual({ x: 48, y: 48, scale: 1 });
  });

  it("centres a small group of cards at actual size", () => {
    expect(fitView([{ x: 0, y: 0, w: 200, h: 100 }], viewport)).toEqual({ x: 400, y: 250, scale: 1 });
  });

  it("zooms out until every card fits inside the padding", () => {
    const view = fitView(
      [
        { x: 0, y: 0, w: 240, h: 200 },
        { x: 1760, y: 800, w: 240, h: 200 },
      ],
      viewport,
    );
    expect(view.scale).toBeCloseTo((1000 - 2 * 48) / 2000);
    // The group's left edge sits at the padding, and it's centred vertically.
    expect(view.x).toBeCloseTo(48);
    expect(view.y).toBeCloseTo((600 - 1000 * view.scale) / 2);
  });

  it("never zooms out past the smallest scale", () => {
    expect(fitView([{ x: 0, y: 0, w: 100000, h: 100 }], viewport, { minScale: 0.2 }).scale).toBe(0.2);
  });
});
