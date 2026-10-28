"use client";

import { useRef, useState } from "react";
import { ImageSquare } from "@phosphor-icons/react";
import { prepareImage } from "@/ui/prepareImage";
import type { ImageInput } from "@/sketches/types";
import { IdeaChip } from "./IdeaChip";

/** No `capture` attribute, so phones offer both the camera and the photo library. */
export function ImagePicker({ onSave }: { onSave: (image: ImageInput) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ kind: "image", ...(await prepareImage(file)) });
    } catch {
      setError("That file couldn't be opened as a picture. Try a JPEG, PNG or HEIC photo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <IdeaChip kind="image" icon={<ImageSquare size={16} />} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Adding" : "Image"}
      </IdeaChip>
      {error && (
        <p role="alert" className="w-full text-sm text-accent">
          {error}
        </p>
      )}
    </>
  );
}
