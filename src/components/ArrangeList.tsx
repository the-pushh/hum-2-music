"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, Trash } from "@phosphor-icons/react";
import type { Idea } from "@/sketches/types";
import { ideaSummary } from "./ideaSummary";

type Props = { ideas: Idea[]; onMove: (id: string, toIndex: number) => void; onDelete: (idea: Idea) => void };

/**
 * The sketch in edit mode: drag rows to reorder (mouse, touch, or keyboard: Space to lift, arrows to move,
 * Space to drop) and delete ideas.
 */
export function ArrangeList({ ideas, onMove, onDelete }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // A short press before dragging, so a touch can still scroll the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Screen reader announcements by label and position, not raw ids.
  const label = (id: string | number) => ideaSummary(ideas.find((i) => i.id === id)!).label;
  const place = (id: string | number) => `position ${ideas.findIndex((i) => i.id === id) + 1} of ${ideas.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}, ${place(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} is now at ${place(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${label(active.id)} at ${place(over.id)}.` : `Dropped ${label(active.id)}.`),
    onDragCancel: ({ active }) => `Cancelled. ${label(active.id)} stays at ${place(active.id)}.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMove(String(active.id), ideas.findIndex((i) => i.id === over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements }}>
      <SortableContext items={ideas.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2" aria-label="Ideas in order">
          {ideas.map((idea) => (
            <ArrangeRow key={idea.id} idea={idea} onDelete={() => onDelete(idea)} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function ArrangeRow({ idea, onDelete }: { idea: Idea; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id });
  const { icon: KindIcon, label } = ideaSummary(idea);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-2xl bg-surface p-2 ${isDragging ? "relative z-10 opacity-90 ring-2 ring-ink" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move: ${label}`}
        className="inline-flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink-muted transition duration-300 ease-soft hover:bg-raised hover:text-ink active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-ink"
      >
        <DotsSixVertical size={20} aria-hidden />
      </button>
      {idea.kind === "color" ? (
        <span className="size-6 shrink-0 rounded-sm border border-line" style={{ backgroundColor: idea.hex }} aria-hidden />
      ) : (
        <KindIcon size={20} className="shrink-0 text-ink-muted" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-base text-ink">{label}</span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete: ${label}`}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-muted transition duration-300 ease-soft hover:bg-raised hover:text-accent active:scale-98 focus-visible:outline-2 focus-visible:outline-ink"
      >
        <Trash size={20} aria-hidden />
      </button>
    </li>
  );
}
