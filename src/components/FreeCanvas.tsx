"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { FrameCorners } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { TransformComponent, TransformWrapper, useTransformEffect, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import type { Place } from "@/sketches/types";
import { CARD_WIDTH, columnLayout, fitView, freeSpot, type Rect, type Size } from "@/ui/canvasLayout";

/** Arrow keys move a focused card this far; with Shift, four times as far. */
const KEY_STEP = 24;
/** A card that hasn't been measured yet counts as this tall. */
const GUESS_HEIGHT = 160;
const MIN_SCALE = 0.1;
const MAX_SCALE = 2;

/** Pressing on these inside a card works them (play, seek, export, type) instead of moving the card. */
const CONTROLS = 'button, input, textarea, select, label, [role="slider"], [draggable="true"], [contenteditable="true"]';
const onControl = (target: EventTarget | null) => target instanceof Element && !!target.closest(CONTROLS);

/** A mouse moves a card from anywhere on it but its controls. */
class CardMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: (...args: Parameters<(typeof MouseSensor.activators)[0]["handler"]>) =>
        !onControl(args[0].nativeEvent.target) && MouseSensor.activators[0].handler(...args),
    },
  ];
}

/** A finger presses and holds a card to lift it, so a quick swipe or a pinch never moves it by accident. */
class CardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: (...args: Parameters<(typeof TouchSensor.activators)[0]["handler"]>) =>
        !onControl(args[0].nativeEvent.target) && TouchSensor.activators[0].handler(...args),
    },
  ];
}

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Anything shown as a card on a canvas: an Idea, or a Sketch on the home page. */
type Item = { id: string; place?: Place };

type Props<T extends Item> = {
  items: T[];
  /** What a screen reader calls the card. */
  label: (item: T) => string;
  /** The card itself. */
  render: (item: T) => ReactNode;
  /** Saves a card the songwriter moved. */
  onPlace: (id: string, place: Place) => Promise<void>;
  /** Saves the places hum picked for cards that had none. */
  onLayOut: (places: Record<string, Place>) => Promise<void>;
};

/**
 * Cards on a freeform canvas. Drag a card to put it anywhere; drag the background, scroll or swipe to pan; pinch or Ctrl
 * and scroll to zoom. Cards with no place yet are laid out by hum: in columns when nothing has been laid out yet,
 * otherwise in a free spot in view.
 */
export function FreeCanvas<T extends Item>({ items, label, render, onPlace, onLayOut }: Props<T>) {
  const zoom = useRef<ReactZoomPanPinchRef>(null);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  // Places shown before the store hands them back, so a card never snaps back for a moment.
  const [moved, setMoved] = useState<Record<string, Place>>({});
  const [auto, setAuto] = useState<Record<string, Place>>({});
  // Cards moved last sit on top.
  const [front, setFront] = useState<string[]>([]);
  const fitted = useRef(false);
  const justDragged = useRef(false);
  // Where each card was last put, ahead of the render that shows it, so held arrow keys add up.
  const lastPut = useRef<Record<string, Place>>({});

  const placeOf = (item: T): Place | undefined => moved[item.id] ?? item.place ?? auto[item.id];
  const rectOf = (item: T): Rect | null => {
    const place = placeOf(item);
    return place ? { ...place, w: CARD_WIDTH, h: sizes[item.id]?.h ?? GUESS_HEIGHT } : null;
  };

  function viewport(): Size {
    const el = zoom.current?.instance.wrapperComponent;
    return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 };
  }

  function showAll(animate: boolean) {
    const rects = items.map(rectOf).filter((r): r is Rect => !!r);
    const { x, y, scale } = fitView(rects, viewport(), { minScale: MIN_SCALE });
    void zoom.current?.setTransform(x, y, scale, animate && !reducedMotion() ? 300 : 0, "easeOut");
  }

  // Lay out cards that have no place yet, once they've been measured.
  const unplaced = items.filter((i) => !placeOf(i));
  const measured = unplaced.every((i) => sizes[i.id]);
  useEffect(() => {
    if (unplaced.length === 0 || !measured || !zoom.current) return;
    const placed = items.map(rectOf).filter((r): r is Rect => !!r);
    let places: Record<string, Place>;
    if (placed.length === 0) {
      const columns = Math.min(4, Math.max(2, Math.floor(viewport().w / (CARD_WIDTH + 24))));
      places = columnLayout(unplaced.map((i) => ({ id: i.id, h: sizes[i.id].h })), columns);
    } else {
      // Near the middle of what's on screen now, in canvas pixels.
      const { positionX, positionY, scale } = zoom.current.instance.state;
      const { w, h } = viewport();
      const middle = { x: (w / 2 - positionX) / scale, y: (h / 2 - positionY) / scale };
      places = {};
      for (const item of unplaced) {
        const size = { w: CARD_WIDTH, h: sizes[item.id].h };
        places[item.id] = freeSpot(placed, size, middle);
        placed.push({ ...places[item.id], ...size });
      }
    }
    setAuto((a) => ({ ...a, ...places }));
    void onLayOut(places);
  }, [unplaced.map((i) => i.id).join(), measured]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show every card the first time they're all laid out and measured.
  const ready = unplaced.length === 0 && items.every((i) => sizes[i.id]);
  useEffect(() => {
    if (!ready || fitted.current) return;
    fitted.current = true;
    showAll(false);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function place(id: string, to: Place) {
    const rounded = { x: Math.round(to.x), y: Math.round(to.y) };
    lastPut.current[id] = rounded;
    setMoved((m) => ({ ...m, [id]: rounded }));
    setFront((f) => [...f.filter((i) => i !== id), id]);
    void onPlace(id, rounded);
  }

  const sensors = useSensors(
    useSensor(CardMouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // A drag moves the pointer in screen pixels; the card moves in canvas pixels.
  const toCanvas: Modifier = ({ transform }) => {
    const scale = zoom.current?.instance.state.scale ?? 1;
    return { ...transform, x: transform.x / scale, y: transform.y / scale };
  };

  function onDragEnd({ active, delta }: DragEndEvent) {
    const item = items.find((i) => i.id === active.id);
    const from = item && placeOf(item);
    if (!from) return;
    place(item.id, { x: from.x + delta.x, y: from.y + delta.y });
    // The press that ended the drag mustn't also open the card (a sketch, lyrics) or a link.
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false));
  }

  /** A card reached with Tab that's off screen is brought into view, keeping the zoom. */
  function revealCard(el: HTMLElement) {
    const z = zoom.current;
    const wrapper = z?.instance.wrapperComponent;
    if (!z || !wrapper) return;
    const outer = wrapper.getBoundingClientRect();
    const card = el.getBoundingClientRect();
    if (card.left >= outer.left && card.right <= outer.right && card.top >= outer.top && card.bottom <= outer.bottom) return;
    const { positionX, positionY, scale } = z.instance.state;
    const dx = outer.left + outer.width / 2 - (card.left + card.width / 2);
    const dy = outer.top + Math.min(outer.height / 2, card.height / 2 + 48) - card.top;
    void z.setTransform(positionX + dx, positionY + dy, scale, reducedMotion() ? 0 : 300, "easeOut");
  }

  return (
    <div className="relative size-full overflow-hidden rounded-2xl border border-line bg-canvas">
      <TransformWrapper
        ref={zoom}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        limitToBounds={false}
        disablePadding
        smooth
        wheel={{ wheelDisabled: true, step: 0.003 }}
        trackPadPanning={{ disabled: false, velocityDisabled: true }}
        panning={{ excluded: ["canvas-card"], velocityDisabled: true }}
        doubleClick={{ disabled: true }}
      >
        <CanvasDots />
        <TransformComponent
          wrapperClass="relative touch-none cursor-grab active:cursor-grabbing"
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: 1, height: 1 }}
          wrapperProps={{
            // Focusing a card can scroll the canvas's box itself; the view is moved by the transform alone.
            onScroll: (e) => {
              e.currentTarget.scrollTop = 0;
              e.currentTarget.scrollLeft = 0;
            },
          }}
        >
          <DndContext sensors={sensors} modifiers={[toCanvas]} autoScroll={false} onDragEnd={onDragEnd}>
            {items.map((item) => {
              const at = placeOf(item);
              const z = front.indexOf(item.id) + 1;
              return (
                <CanvasCard
                  key={item.id}
                  id={item.id}
                  label={label(item)}
                  at={at}
                  z={z}
                  onSize={(size) =>
                    setSizes((s) => (s[item.id]?.w === size.w && s[item.id]?.h === size.h ? s : { ...s, [item.id]: size }))
                  }
                  onNudge={(dx, dy) => {
                    const from = lastPut.current[item.id] ?? at;
                    if (from) place(item.id, { x: from.x + dx, y: from.y + dy });
                  }}
                  onFocus={revealCard}
                  onClickCapture={(e) => {
                    if (!justDragged.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {render(item)}
                </CanvasCard>
              );
            })}
          </DndContext>
        </TransformComponent>
      </TransformWrapper>
      <button
        type="button"
        onClick={() => showAll(true)}
        title="Reset view"
        className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition duration-300 ease-soft hover:bg-raised active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <FrameCorners size={20} aria-hidden />
        <span className="sr-only">Reset view</span>
      </button>
    </div>
  );
}

type CardProps = {
  id: string;
  label: string;
  at: Place | undefined;
  z: number;
  children: ReactNode;
  onSize: (size: Size) => void;
  onNudge: (dx: number, dy: number) => void;
  onFocus: (el: HTMLElement) => void;
  onClickCapture: (e: React.MouseEvent) => void;
};

/** One card on the canvas: moved by dragging it, or with the arrow keys while it has focus. */
function CanvasCard({ id, label, at, z, children, onSize, onNudge, onFocus, onClickCapture }: CardProps) {
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({ id });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // offsetWidth/Height are the card's own size, unaffected by the canvas's zoom.
    const measure = () => onSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e: KeyboardEvent) {
    // Only the card itself: arrow keys on its controls (like the waveform) keep their own meaning.
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
      aria-roledescription="movable card"
      aria-label={`${label}. Arrow keys move it.`}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.target === e.currentTarget && onFocus(e.currentTarget)}
      onClickCapture={onClickCapture}
      // Links and pictures would start the browser's own drag and swallow the move; only parts made to be dragged out
      // of the page (the MIDI and Audio chips) keep it.
      onDragStart={(e) => e.target instanceof Element && !e.target.closest('[draggable="true"]') && e.preventDefault()}
      className={`canvas-card absolute cursor-grab touch-none rounded-2xl select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        at ? "" : "invisible"
      } ${isDragging ? "cursor-grabbing opacity-90 ring-2 ring-ink" : ""}`}
      style={{
        width: CARD_WIDTH,
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

/** The dot grid, drawn on the canvas so it pans and zooms with the cards. */
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
