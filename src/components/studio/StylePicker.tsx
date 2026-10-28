"use client";

import { Faders } from "@phosphor-icons/react";
import { withStyle } from "@/studio/generate/parts";
import { defaultStyle, styleChoices, styleLabel, type Style } from "@/studio/generate/style";
import { useProjectStore } from "@/studio/store/project";

/** The parts of a Style the picker offers, with their headings. */
const rows: { key: keyof Style; label: string }[] = [{ key: "drums", label: "Drum feel" }];

/**
 * The Style chip on the timeline and its picker. A pick rewrites the generated parts in that style straight away, as
 * one undo step; with nothing generated yet, it's kept for the next Generate parts.
 */
export function StylePicker() {
  const project = useProjectStore((s) => s.project);
  if (!project) return null;
  const style = project.style ?? defaultStyle;

  function choose(changes: Partial<Style>) {
    const current = useProjectStore.getState().project;
    if (current) useProjectStore.getState().loadProject(withStyle(current, changes));
  }

  return (
    <>
      <button
        type="button"
        popoverTarget="studio-style"
        className="inline-flex h-8 items-center gap-2 rounded-lg bg-raised px-2 text-sm font-semibold text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Faders size={16} aria-hidden />
        {rows.map((r) => styleLabel[style[r.key]]).join(" · ")}
        <span className="sr-only">, change style</span>
      </button>
      <div id="studio-style" popover="auto" className="m-auto w-full max-w-sm rounded-2xl bg-raised p-4 text-ink backdrop:bg-canvas/60">
        <div className="flex flex-col gap-4">
          {rows.map(({ key, label }) => (
            <div key={key} role="group" aria-label={label} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-ink-muted">{label}</p>
              <div className="flex flex-wrap gap-1">
                {styleChoices[key].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={style[key] === value}
                    onClick={() => style[key] !== value && choose({ [key]: value })}
                    className="inline-flex h-8 items-center rounded-full bg-surface px-3 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:bg-ink aria-pressed:text-canvas"
                  >
                    {styleLabel[value]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-ink-muted">Generated parts follow the style. Your own takes stay as they are.</p>
        </div>
      </div>
    </>
  );
}
