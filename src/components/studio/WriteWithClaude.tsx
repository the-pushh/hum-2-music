"use client";

import type { FormEvent } from "react";
import { ArrowsClockwise, PenNib } from "@phosphor-icons/react";
import { useProjectStore } from "@/studio/store/project";
import { maxBars, writeRequestOf } from "@/studio/write/request";
import { errorText, useWriter } from "@/studio/write/writer";
import { Button } from "../Button";

/**
 * Write with Claude: a button on the transport and the sheet it opens. Claude writes chords, bass and drums for the
 * melody, following the Style and an optional note; hum tidies them onto the generated tracks as one undo step.
 * Another version asks again with the same note; Undo brings back the version before.
 */
export function WriteWithClaude({ buttonClassName }: { buttonClassName: string }) {
  const { state, note, setNote, write, cancel } = useWriter();
  const project = useProjectStore((s) => s.project);
  // Said up front, so an empty or too long song doesn't cost a trip to Claude.
  const asked = project ? writeRequestOf(project, note) : null;
  const blocked = !asked?.parts.length ? errorText["nothing-to-write"] : asked.plan.bars > maxBars ? errorText["too-long"] : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    void write();
  }

  return (
    <>
      <button type="button" popoverTarget="studio-write" className={`${buttonClassName} sm:w-auto sm:px-3`}>
        <PenNib size={20} aria-hidden />
        <span className="sr-only sm:not-sr-only sm:text-sm sm:font-semibold">Write with Claude</span>
      </button>
      <div id="studio-write" popover="auto" role="dialog" aria-labelledby="studio-write-title" className="m-auto w-full max-w-md rounded-2xl bg-raised p-4 text-ink backdrop:bg-canvas/60">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="studio-write-title" className="text-base font-semibold">
              Write with Claude
            </h2>
            <p className="text-sm text-ink-muted">Claude writes chords, bass and drums for your melody, in the song&apos;s Style.</p>
          </div>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-muted">
            A note for Claude (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Sparser at the start, busier bass in the last bars"
              disabled={state.status === "writing"}
              className="resize-none rounded-lg bg-surface px-3 py-2 text-base font-normal text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            />
          </label>

          {blocked && state.status !== "writing" ? <p className="text-sm text-ink-muted">{blocked}</p> : <WriterStatus />}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">Your melody&apos;s notes, the song&apos;s settings and this note go to Claude. Recordings and lyrics don&apos;t.</p>
            {state.status === "writing" ? (
              <Button type="button" variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            ) : state.status === "written" ? (
              <div className="flex gap-2">
                <Button type="submit" variant="secondary" disabled={!!blocked}>
                  <ArrowsClockwise size={16} aria-hidden />
                  Another version
                </Button>
                <Button type="button" popoverTarget="studio-write" popoverTargetAction="hide">
                  Done
                </Button>
              </div>
            ) : (
              <Button type="submit" disabled={!!blocked}>
                <PenNib size={16} aria-hidden />
                Write
              </Button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}

/** Where a write stands: writing, written (with Claude's summary), or why it didn't work. */
export function WriterStatus() {
  const state = useWriter((s) => s.state);
  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {state.status === "writing" && (
        <div className="flex flex-col gap-1" aria-busy>
          <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface" aria-hidden />
          <span className="text-xs text-ink-muted">Claude is writing. This can take up to a minute; the studio keeps playing.</span>
        </div>
      )}
      {state.status === "written" && (
        <p className="text-sm text-ink">
          <span className="font-semibold">{state.summary}</span>. It&apos;s on your generated tracks; Undo takes it back.
        </p>
      )}
      {state.status === "failed" && (
        <p role={state.quiet ? undefined : "alert"} className={`text-sm ${state.quiet ? "text-ink-muted" : "text-accent"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
