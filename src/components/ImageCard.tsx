"use client";

import type { Idea, ImageInput } from "@/sketches/types";
import { objectUrlFor } from "@/ui/objectUrls";

export function ImageCard({ idea }: { idea: Idea & ImageInput }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a local Blob URL; next/image can't optimise it
    <img
      src={objectUrlFor(idea.id, idea.blob)}
      alt="Moodboard picture"
      width={idea.w}
      height={idea.h}
      loading="lazy"
      decoding="async"
      className="h-auto w-full rounded-2xl bg-surface"
    />
  );
}
