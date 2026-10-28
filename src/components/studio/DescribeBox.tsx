"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Check, Microphone, Sparkle, Stop, X } from "@phosphor-icons/react";
import { canRecognizeSpeech, listenForPhrase, type Listening } from "@/audio/speech";
import { applyDirection } from "@/studio/direction/apply";
import { contextOf } from "@/studio/direction/context";
import type { DescribeError, DescribeResult } from "@/studio/direction/describe";
import type { Direction } from "@/studio/direction/schema";
import { useProjectStore } from "@/studio/store/project";

type State =
  | { status: "idle" }
  | { status: "reading"; controller: AbortController }
  | { status: "read"; direction: Direction }
  | { status: "failed"; error: DescribeError | "cancelled" };

/** What to tell the songwriter, and what to do next, for each way reading can fail. */
const errorText: Record<DescribeError | "cancelled", string> = {
  empty: "Say what you want the song to feel like.",
  "not-configured": "Describe it isn't set up yet. Add ANTHROPIC_API_KEY to .env.local and restart hum.",
  offline: "Couldn't reach Claude. Check your connection and try again.",
  upstream: "Claude had a problem on its side. Try again in a moment.",
  timeout: "Claude took too long. Try again, or say it more simply.",
  "invalid-output": "Claude couldn't turn that into changes. Try saying it another way.",
  declined: "Claude couldn't help with that description. Try saying it another way.",
  cancelled: "Stopped. Your song hasn't changed.",
};

const round =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full transition duration-300 ease-soft active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50";

/**
 * Describe it: the songwriter says what the song should feel like, Claude reads it into a Direction, and hum shows
 * what it understood before anything changes. Apply is one undo step.
 */
export function DescribeBox() {
  const [words, setWords] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState(false);
  const listenRef = useRef<Listening | null>(null);

  // Known only in the browser, after hydration.
  useEffect(() => setSpeech(canRecognizeSpeech()), []); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => () => listenRef.current?.cancel(), []);

  async function read(text: string) {
    const project = useProjectStore.getState().project;
    if (!project || !text.trim()) return;
    if (state.status === "reading") state.controller.abort();
    const controller = new AbortController();
    setState({ status: "reading", controller });
    try {
      const response = await fetch("/api/describe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: text, context: contextOf(project) }),
        signal: controller.signal,
      });
      const result: DescribeResult = response.ok ? await response.json() : { ok: false, error: "upstream" };
      setState(result.ok ? { status: "read", direction: result.direction } : { status: "failed", error: result.error });
    } catch {
      setState({ status: "failed", error: controller.signal.aborted ? "cancelled" : "offline" });
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void read(words);
  }

  function listen() {
    if (listening) {
      listenRef.current?.cancel();
      listenRef.current = null;
      return setListening(false);
    }
    setListening(true);
    listenRef.current = listenForPhrase((result) => {
      listenRef.current = null;
      setListening(false);
      if ("error" in result) return setState({ status: "failed", error: "empty" });
      setWords(result.text);
      void read(result.text);
    });
  }

  function apply(direction: Direction) {
    const project = useProjectStore.getState().project;
    if (project) useProjectStore.getState().loadProject(applyDirection(project, direction));
    setState({ status: "idle" });
    setWords("");
  }

  const reading = state.status === "reading";

  return (
    <section aria-label="Describe it" className="flex flex-col gap-2 rounded-3xl bg-surface p-2">
      <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl bg-raised p-1 pl-3">
        <Sparkle size={20} className="shrink-0 text-ink-muted" aria-hidden />
        <label htmlFor="describe-it" className="sr-only">
          Describe how the song should feel
        </label>
        <input
          id="describe-it"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder="Describe it: “slower, half-time, chill”"
          maxLength={500}
          enterKeyHint="send"
          className="h-10 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted focus-visible:outline-none"
        />
        {speech && (
          <button type="button" onClick={listen} aria-pressed={listening} disabled={reading} className={`${round} bg-surface text-ink hover:bg-line aria-pressed:bg-ink aria-pressed:text-canvas`}>
            {listening ? <Stop size={16} weight="fill" aria-hidden /> : <Microphone size={16} weight="fill" aria-hidden />}
            <span className="sr-only">{listening ? "Stop listening" : "Say it"}</span>
          </button>
        )}
        {reading ? (
          <button type="button" onClick={() => state.controller.abort()} className={`${round} bg-surface text-ink hover:bg-line`}>
            <X size={16} weight="bold" aria-hidden />
            <span className="sr-only">Cancel</span>
          </button>
        ) : (
          <button type="submit" disabled={!words.trim()} className={`${round} bg-accent text-accent-ink hover:opacity-90`}>
            <ArrowUp size={16} weight="bold" aria-hidden />
            <span className="sr-only">Describe</span>
          </button>
        )}
      </form>

      <div aria-live="polite" className="flex flex-col gap-2 px-2 pb-1">
        {reading && (
          <div className="flex flex-col gap-1" aria-busy>
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-raised" aria-hidden />
            <span className="text-xs text-ink-muted">Reading what you said</span>
          </div>
        )}
        {state.status === "read" && state.direction.understood && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="w-full text-base font-semibold text-ink sm:w-auto sm:flex-1">{state.direction.summary}</p>
            <button type="button" onClick={() => apply(state.direction)} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-canvas transition duration-300 ease-soft hover:opacity-90 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <Check size={16} weight="bold" aria-hidden />
              Apply
            </button>
            <button type="button" onClick={() => setState({ status: "idle" })} className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-ink-muted transition duration-300 ease-soft hover:bg-raised hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              Not this
            </button>
          </div>
        )}
        {state.status === "read" && !state.direction.understood && (
          <p className="text-sm text-ink">
            hum didn&apos;t find anything to change in that. Try the tempo (“around 80”), the drums (“four on the floor”), the chords (“lush”), the bass (“walking”) or the energy (“chill”).
          </p>
        )}
        {state.status === "failed" && (
          <p role={state.error === "cancelled" ? undefined : "alert"} className={`text-sm ${state.error === "cancelled" ? "text-ink-muted" : "text-accent"}`}>
            {errorText[state.error]}
          </p>
        )}
        {state.status === "idle" && <p className="text-xs text-ink-muted">Your words and the song&apos;s settings go to Claude. Your recordings and lyrics don&apos;t.</p>}
      </div>
    </section>
  );
}
