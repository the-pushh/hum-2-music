"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { ArrowCounterClockwise, FrameCorners } from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { TransformComponent, TransformWrapper, useTransformEffect, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { sketchStore } from "@/sketches/client";
import type { Place } from "@/sketches/types";
import { canvasControl, freeSpot, pageView, type Rect, type Size } from "@/ui/canvasLayout";
import { ConfirmDialog } from "./ConfirmDialog";

/** Arrow keys move a focused piece this far; with Shift, four times as far. */
const KEY_STEP = 24;
/** A piece that hasn't been measured yet counts as this tall. */
const GUESS_HEIGHT = 160;
const MIN_SCALE = 0.1;
const MAX_SCALE = 2;
/** The least room kept around a piece put at its spot in the page's first layout: the old list's gap. */
const HOME_GAP = 8;

/** Pressing on these inside a piece works them (play, seek, export, type) instead of moving the piece. */
const CONTROLS = `button, input, textarea, select, label, [role="slider"], [draggable="true"], [contenteditable="true"], .${canvasControl}`;
const onControl = (target: EventTarget | null) => target instanceof Element && !!target.closest(CONTROLS);

/** A mouse moves a piece from anywhere on it but its controls. */
class PieceMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: (...args: Parameters<(typeof MouseSensor.activators)[0]["handler"]>) =>
        !onControl(args[0].nativeEvent.target) && MouseSensor.activators[0].handler(...args),
    },
  ];
}

/** A finger presses and holds a piece to lift it, so a swipe over it pans the page and a pinch never moves it. */
class PieceTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: (...args: Parameters<(typeof TouchSensor.activators)[0]["handler"]>) =>
        !onControl(args[0].nativeEvent.target) && TouchSensor.activators[0].handler(...args),
    },
  ];
}

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** How wide the screen is, for sizing a page's pieces as the page used to be. A desktop's width before hydration. */
export function useScreenWidth() {
  return useSyncExternalStore(subscribeToResize, () => window.innerWidth, () => 1280);
}

/** One movable piece of a page: a section (its title, the capture bar) or a card (an Idea, a Sketch). */
export type Piece = {
  id: string;
  /** What a screen reader calls it. */
  label: string;
  /** Its width on the canvas, or its own width when left out (a row of buttons). Its height is always its own. */
  width?: number;
  node: ReactNode;
  /**
   * Where it goes the first time it shows up on a page that's already laid out: near its spot in the page's first
   * layout, or with "view" (a new idea or sketch, so it's seen), near the middle of the screen when that spot is off it.
   */
  arrives?: "view";
};

type Props = {
  /** Which page's layout this is: "home", "sketch:<id>" or "studio:<id>". */
  layoutId: string;
  pieces: Piece[];
  /** The page as it was before it was a canvas, from each piece's size. Used for pieces with no place yet. */
  firstLayout: (sizes: Record<string, Size>) => Record<string, Place>;
  /** Pinned to the screen over the canvas, whatever the pan and zoom: the studio's transport, messages. */
  overlay?: ReactNode;
};

/**
 * A whole page as a freeform canvas. Every piece can be dragged anywhere (or moved with the arrow keys while it has
 * focus); drag the background, scroll or swipe to pan; pinch or Ctrl and scroll to zoom. It opens as the page always
 * looked. Reset view goes back to that view; Reset layout (after asking) puts every piece back where it started.
 */
export function FreeCanvas({ layoutId, pieces, firstLayout, overlay }: Props) {
  // undefined while loading; empty for a page nothing has been placed on.
  const saved = useLiveQuery(async () => (await sketchStore().getLayout(layoutId))?.places ?? {}, [layoutId]);
  const zoom = useRef<ReactZoomPanPinchRef>(null);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  // Places shown before the store hands them back, so a piece never snaps back for a moment.
  const [moved, setMoved] = useState<Record<string, Place>>({});
  const [auto, setAuto] = useState<Record<string, Place>>({});
  // Pieces moved last sit on top.
  const [front, setFront] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // A mouse pans from the background only; a finger pans from anywhere, and holds a piece to lift it.
  const [mouse] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(pointer: fine)").matches);
  const viewed = useRef(false);
  const justDragged = useRef(false);
  // Where each piece was last put, ahead of the render that shows it, so held arrow keys add up.
  const lastPut = useRef<Record<string, Place>>({});

  const placeOf = (id: string): Place | undefined => moved[id] ?? saved?.[id] ?? auto[id];
  const rectOf = (piece: Piece): Rect | null => {
    const place = placeOf(piece.id);
    const size = sizes[piece.id];
    return place ? { ...place, w: size?.w ?? piece.width ?? 0, h: size?.h ?? GUESS_HEIGHT } : null;
  };

  /** Saves a change to the layout, showing a message if this browser's storage refuses it. */
  async function attempt(change: () => Promise<void>, failure: string) {
    setError(null);
    try {
      await change();
    } catch {
      setError(failure);
    }
  }

  function viewport(): Size {
    const el = zoom.current?.instance.wrapperComponent;
    return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 };
  }

  function showPage(animate: boolean) {
    const rects = pieces.map(rectOf).filter((r): r is Rect => !!r);
    const { x, y, scale } = pageView(rects, viewport());
    void zoom.current?.setTransform(x, y, scale, animate && !reducedMotion() ? 300 : 0, "easeOut");
  }

  // Lay out pieces that have no place yet, once every piece has been measured.
  const unplaced = saved ? pieces.filter((p) => !placeOf(p.id)) : [];
  const measured = pieces.every((p) => sizes[p.id]);
  useEffect(() => {
    if (!saved || unplaced.length === 0 || !measured || !zoom.current) return;
    const first = firstLayout(sizes);
    let places: Record<string, Place>;
    if (Object.keys(saved).length === 0) {
      places = Object.fromEntries(unplaced.map((p) => [p.id, first[p.id]]));
    } else {
      const taken = pieces.map(rectOf).filter((r): r is Rect => !!r);
      // The middle of what's on screen now, in canvas pixels.
      const { positionX, positionY, scale } = zoom.current.instance.state;
      const { w, h } = viewport();
      const middle = { x: (w / 2 - positionX) / scale, y: (h / 2 - positionY) / scale };
      places = {};
      for (const piece of unplaced) {
        const size = sizes[piece.id];
        const home = { x: first[piece.id].x + size.w / 2, y: first[piece.id].y + size.h / 2 };
        const homeInView = Math.abs(home.x - middle.x) * scale < w / 2 && Math.abs(home.y - middle.y) * scale < h / 2;
        // At its own spot it keeps the page's own spacing; dropped into the view it keeps clear of its neighbours.
        places[piece.id] = piece.arrives === "view" && !homeInView ? freeSpot(taken, size, middle) : freeSpot(taken, size, home, HOME_GAP);
        taken.push({ ...places[piece.id], ...size });
      }
    }
    setAuto((a) => ({ ...a, ...places }));
    void attempt(() => sketchStore().layOutPieces(layoutId, places), "This page's layout couldn't be saved.");
  }, [!!saved, unplaced.map((p) => p.id).join(), measured]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open at the page view once everything is placed and measured.
  const ready = !!saved && unplaced.length === 0 && measured;
  useEffect(() => {
    if (!ready || viewed.current) return;
    viewed.current = true;
    showPage(false);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function place(id: string, to: Place) {
    const rounded = { x: Math.round(to.x), y: Math.round(to.y) };
    lastPut.current[id] = rounded;
    setMoved((m) => ({ ...m, [id]: rounded }));
    setFront((f) => [...f.filter((i) => i !== id), id]);
    void attempt(() => sketchStore().placePiece(layoutId, id, rounded), "That piece's new spot couldn't be saved. Try moving it again.");
  }

  /** Puts every piece back where the page first had it, then shows the page from the top. */
  async function resetLayout() {
    setConfirmingReset(false);
    setMoved({});
    setAuto({});
    setFront([]);
    lastPut.current = {};
    // Shown again once everything has its first place back.
    viewed.current = false;
    await attempt(() => sketchStore().resetLayout(layoutId), "The layout couldn't be reset. Try again.");
  }

  const sensors = useSensors(
    useSensor(PieceMouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(PieceTouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // A drag moves the pointer in screen pixels; the piece moves in canvas pixels.
  const toCanvas: Modifier = ({ transform }) => {
    const scale = zoom.current?.instance.state.scale ?? 1;
    return { ...transform, x: transform.x / scale, y: transform.y / scale };
  };

  // Screen readers hear pieces by name, not by id.
  const named = (id: string | number) => pieces.find((p) => p.id === id)?.label ?? "Piece";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${named(active.id)}.`,
    onDragOver: () => undefined,
    onDragEnd: ({ active }) => `Put down ${named(active.id)}.`,
    onDragCancel: ({ active }) => `${named(active.id)} is back where it was.`,
  };

  function onDragEnd({ active, delta }: DragEndEvent) {
    setDragging(false);
    const id = String(active.id);
    const from = placeOf(id);
    if (!from) return;
    place(id, { x: from.x + delta.x, y: from.y + delta.y });
    // The press that ended the drag mustn't also open the piece (a sketch, lyrics) or a link in it.
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false));
  }

  /** A piece reached with Tab that's off screen is brought into view, keeping the zoom. */
  function revealPiece(el: HTMLElement) {
    const z = zoom.current;
    const wrapper = z?.instance.wrapperComponent;
    if (!z || !wrapper) return;
    const outer = wrapper.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (box.left >= outer.left && box.right <= outer.right && box.top >= outer.top && box.bottom <= outer.bottom) return;
    const { positionX, positionY, scale } = z.instance.state;
    const dx = box.width > outer.width ? outer.left + 16 - box.left : outer.left + outer.width / 2 - (box.left + box.width / 2);
    const dy = outer.top + 48 - box.top;
    void z.setTransform(positionX + dx, positionY + dy, scale, reducedMotion() ? 0 : 300, "easeOut");
  }

  return (
    <div className="relative size-full overflow-hidden bg-canvas">
      <TransformWrapper
        ref={zoom}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        limitToBounds={false}
        disablePadding
        smooth
        wheel={{ wheelDisabled: true, step: 0.003 }}
        trackPadPanning={{ disabled: false, velocityDisabled: true, excluded: [canvasControl] }}
        panning={{ disabled: dragging, excluded: mouse ? ["canvas-piece", canvasControl] : [canvasControl], velocityDisabled: true }}
        doubleClick={{ disabled: true }}
      >
        <CanvasDots />
        <TransformComponent
          wrapperClass="relative touch-none cursor-grab active:cursor-grabbing"
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: 1, height: 1 }}
          wrapperProps={{
            // Focusing a piece can scroll the canvas's box itself; the view is moved by the transform alone.
            onScroll: (e) => {
              e.currentTarget.scrollTop = 0;
              e.currentTarget.scrollLeft = 0;
            },
          }}
        >
          <DndContext
            sensors={sensors}
            modifiers={[toCanvas]}
            autoScroll={false}
            onDragStart={() => setDragging(true)}
            onDragCancel={() => setDragging(false)}
            onDragEnd={onDragEnd}
            accessibility={{ announcements }}
          >
            {pieces.map((piece) => {
              const at = placeOf(piece.id);
              return (
                <CanvasPiece
                  key={piece.id}
                  id={piece.id}
                  label={piece.label}
                  width={piece.width}
                  at={at}
                  z={front.indexOf(piece.id) + 1}
                  onSize={(size) =>
                    setSizes((s) => (s[piece.id]?.w === size.w && s[piece.id]?.h === size.h ? s : { ...s, [piece.id]: size }))
                  }
                  onNudge={(dx, dy) => {
                    const from = lastPut.current[piece.id] ?? at;
                    if (from) place(piece.id, { x: from.x + dx, y: from.y + dy });
                  }}
                  onFocus={revealPiece}
                  onClickCapture={(e) => {
                    if (!justDragged.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {piece.node}
                </CanvasPiece>
              );
            })}
          </DndContext>
        </TransformComponent>
      </TransformWrapper>
      {error && (
        <p role="alert" className="absolute top-4 left-4 rounded-lg bg-raised px-3 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="absolute top-4 right-4 flex gap-2">
        <button type="button" onClick={() => setConfirmingReset(true)} title="Reset layout" className={viewButton}>
          <ArrowCounterClockwise size={20} aria-hidden />
          <span className="sr-only">Reset layout</span>
        </button>
        <button type="button" onClick={() => showPage(true)} title="Reset view" className={viewButton}>
          <FrameCorners size={20} aria-hidden />
          <span className="sr-only">Reset view</span>
        </button>
      </div>
      {confirmingReset && (
        <ConfirmDialog
          title="Reset this page's layout?"
          body="Everything on this page goes back to where it started. Nothing in it is deleted or changed."
          confirmLabel="Reset layout"
          onConfirm={() => void resetLayout()}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
      {overlay}
    </div>
  );
}

const viewButton =
  "inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition duration-300 ease-soft hover:bg-raised active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

type PieceProps = {
  id: string;
  label: string;
  width: number | undefined;
  at: Place | undefined;
  z: number;
  children: ReactNode;
  onSize: (size: Size) => void;
  onNudge: (dx: number, dy: number) => void;
  onFocus: (el: HTMLElement) => void;
  onClickCapture: (e: React.MouseEvent) => void;
};

/** One piece on the canvas: moved by dragging it, or with the arrow keys while it has focus. */
function CanvasPiece({ id, label, width, at, z, children, onSize, onNudge, onFocus, onClickCapture }: PieceProps) {
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({ id });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      // offsetWidth/Height are the piece's own size, unaffected by the canvas's zoom.
      onSize({ w: el.offsetWidth, h: el.offsetHeight });
      // The highlight follows the piece's corners, so they match the card inside it (a capture card's are rounder).
      const inner = el.firstElementChild && getComputedStyle(el.firstElementChild).borderRadius;
      el.style.borderRadius = inner && inner !== "0px" ? inner : "";
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e: KeyboardEvent) {
    // Only the piece itself: arrow keys on its controls (like a waveform) keep their own meaning.
    if (e.target !== e.currentTarget) return;
    const step = e.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    onNudge(...move);
  }

  return (
    <div
      ref={(el) => {
        box.current = el;
        setNodeRef(el);
      }}
      {...listeners}
      tabIndex={0}
      role="group"
      aria-roledescription="movable piece"
      aria-label={`${label}. Arrow keys move it.`}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.target === e.currentTarget && onFocus(e.currentTarget)}
      onClickCapture={onClickCapture}
      // Links and pictures would start the browser's own drag and swallow the move; only parts made to be dragged out
      // of the page (the MIDI and Audio chips) keep it.
      onDragStart={(e) => e.target instanceof Element && !e.target.closest('[draggable="true"]') && e.preventDefault()}
      className={`canvas-piece absolute rounded-2xl focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-bass/60 ${
        at ? "" : "invisible"
      } ${isDragging ? "opacity-90 ring-1 ring-bass/60" : ""}`}
      style={{
        width: width ?? "max-content",
        left: at?.x ?? 0,
        top: at?.y ?? 0,
        zIndex: isDragging ? 1000 : z,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** The dot grid, drawn on the canvas so it pans and zooms with the page. */
function CanvasDots() {
  const pattern = useRef<SVGPatternElement>(null);
  useTransformEffect(({ state }) => {
    pattern.current?.setAttribute("patternTransform", `translate(${state.positionX} ${state.positionY}) scale(${state.scale})`);
  });
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full text-line">
      <defs>
        <pattern ref={pattern} id="hum-canvas-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-current" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hum-canvas-dots)" />
    </svg>
  );
}
