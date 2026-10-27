"use client";

import { useRef, useState } from "react";
import { Palette } from "@phosphor-icons/react";
import type { ColorInput } from "@/sketches/types";
import { Button } from "./Button";

/** The platform colour picker: a full picker on desktop, the system sheet on phones. Saves when the picker closes. */
export function ColorPicker({ onSave }: { onSave: (color: ColorInput) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(hex: string) {
    setError(null);
    try {
      await onSave({ kind: "color", hex: hex.toLowerCase() });
    } catch {
      setError("Couldn't save the colour. Try picking it again.");
    }
  }

  return (
    <>
      <input
        ref={input}
        type="color"
        defaultValue="#ff5a36"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        // `change` fires once when the picker closes, not on every drag like `input`.
        onChange={(e) => void save(e.target.value)}
      />
      <Button variant="secondary" onClick={() => input.current?.click()}>
        <Palette size={20} aria-hidden />
        Color
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-accent">
          {error}
        </p>
      )}
    </>
  );
}
