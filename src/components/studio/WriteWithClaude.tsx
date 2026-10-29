"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PenNib } from "@phosphor-icons/react";
import { withClaudeParts } from "@/studio/generate/parts";
import { useProjectStore } from "@/studio/store/project";
import { postWrite } from "@/studio/write/client";
import { writeRequestOf } from "@/studio/write/request";
import { maxBars, type WriteError } from "@/studio/write/write";
import { Button } from "../Button";

type State =
  | { status: "idle" }
  | { status: "writing"; controller: AbortController }
  | { status: "written"; summary: string }
  | { status: "failed"; message: string; quiet?: boolean };

/** What to tell the songwriter, and what to do next, for each way writing can fail. Parts are unchanged in every case. */
const errorText: Record<WriteError, string> = {
  "nothing-to-write": "Nothing for Claude to write: hum a melody first, or set a part in the Style to something other than none.",
  "too-long": `Claude writes for songs up to ${maxBars} bars. Trim the melody and try again.`,
  "bad-request": "hum couldn't send this song to Claude. Reload the studio and try again.",
  "not-configured": "Write with Claude isn't set up yet. Add ANTHROPIC_API_KEY to .env.local and restart hum.",
  offline: "Couldn't reach Claude. Check your connection and try again. Generate parts still works offline.",
  upstream: "Claude had a problem on its side. Try again in a moment.",
  timeout: "Claude took too long. Try again, maybe with a shorter note.",
  "invalid-output": "Claude's parts didn't come out playable. Try again.",
  declined: "Claude couldn't write for that note. Try saying it another way.",
};

/**
 * Write with Claude: a button on the transport and the sheet it opens. Claude writes chords, bass and drums for the
 * melody, following the Style and an optional note; hum tidies them onto the generated tracks as one undo step.
 */
export function WriteWithClaude({ buttonClassName }: { buttonClassName: string }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => () => (stateRef.current.status === "writing" ? stateRef.current.controller.abort() : undefined), []);

  async function write(e?: FormEvent) {
    e?.preventDefault();
    const project = useProjectStore.getState().project;
    if (!project || state.status === "writing") return;
    const controller = new AbortController();
    setState({ status: "writing", controller });
    try {
      const result = await postWrite(writeRequestOf(project, note), controller.signal);
      if (!result.ok) return setState({ status: "failed", message: errorText[result.error] });
      // The arrangement as it is now: the songwriter may have edited while Claude wrote.
      const current = useProjectStore.getState().project;
      if (current) useProjectStore.getState().loadProject(withClaudeParts(current, result.parts));
      setState({ status: "written", summary: result.summary });
    } catch {
      setState({ status: "failed", message: "Stopped. Your parts haven't changed.", quiet: true });
    }
  }

  return (
    <>
      <button type="button" popoverTarget="studio-write" className={`${buttonClassName} sm:w-auto sm:px-3`}>
        <PenNib size={20} aria-hidden />
        <span className="sr-only sm:not-sr-only sm:text-sm sm:font-semibold">Write with Claude</span>
      </button>
      <div id="studio-write" popover="auto" className="m-auto w-full max-w-md rounded-2xl bg-raised p-4 text-ink backdrop:bg-canvas/60">
        <form onSubmit={write} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Write with Claude</h2>
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-muted">Your melody&apos;s notes, the song&apos;s settings and this note go to Claude. Recordings and lyrics don&apos;t.</p>
            {state.status === "writing" ? (
              <Button type="button" variant="secondary" onClick={() => state.controller.abort()}>
                Cancel
              </Button>
            ) : state.status === "written" ? (
              <Button type="button" popoverTarget="studio-write" popoverTargetAction="hide">
                Done
              </Button>
            ) : (
              <Button type="submit">
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
