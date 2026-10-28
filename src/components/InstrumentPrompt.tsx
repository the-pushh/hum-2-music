"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Microphone, Stop } from "@phosphor-icons/react";
import { canRecognizeSpeech, listenForPhrase, type Listening } from "@/audio/speech";
import { instrumentIds, instruments, type InstrumentId } from "@/instruments/instruments";
import { askClaudeForInstrument } from "@/instruments/askClaude";
import { readInstruction } from "@/instruments/readInstruction";
import { sketchStore } from "@/sketches/client";
import type { VoiceIdea } from "@/sketches/types";

/** A pill on the bright melody card: dark when chosen, faint dark otherwise. */
const chip =
  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-semibold transition duration-300 ease-soft active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas disabled:opacity-50 aria-pressed:bg-canvas aria-pressed:text-ink";

/** A round button on the card, dark ink on a faint dark circle. Pair with sr-only text. */
const roundButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas/10 transition duration-300 ease-soft hover:bg-canvas/20 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas disabled:opacity-50 aria-pressed:bg-canvas aria-pressed:text-ink";

/** What hum made of the songwriter's words; `asking` while Claude is reading words the keyword reader couldn't. */
type Heard = { words: string; instrument: InstrumentId | undefined; asking?: boolean };

/**
 * "What should it play as?" on a melody card: asked once its notes are ready, and again whenever the songwriter taps
 * the instrument to change it. Answered with a chip, or in words, typed or spoken, which hum reads and checks back.
 * Words that name no instrument outright ("something dreamy and 80s") go to Claude.
 */
export function InstrumentPrompt({ idea, onDone, onDismiss }: { idea: VoiceIdea; onDone?: () => void; onDismiss?: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState("");
  const [heard, setHeard] = useState<Heard | null>(null);
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState(false);
  const listenRef = useRef<Listening | null>(null);
  const askRef = useRef<AbortController | null>(null);

  // Known only in the browser, after hydration.
  useEffect(() => setSpeech(canRecognizeSpeech()), []); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(
    () => () => {
      listenRef.current?.cancel();
      askRef.current?.abort();
    },
    [],
  );

  async function choose(instrument: InstrumentId) {
    setError(null);
    try {
      await sketchStore().setInstrument(idea.id, instrument);
      setHeard(null);
      setWords("");
      onDone?.();
    } catch {
      setError("That choice couldn't be saved. Try again.");
    }
  }

  async function read(text: string) {
    setError(null);
    askRef.current?.abort();
    if (!text.trim()) return;
    const instrument = readInstruction(text);
    if (instrument) return setHeard({ words: text, instrument });
    setHeard({ words: text, instrument: undefined, asking: true });
    const controller = new AbortController();
    askRef.current = controller;
    const answer = await askClaudeForInstrument(idea, text, controller.signal);
    if (controller.signal.aborted) return;
    // Whatever went wrong, the nudge and the chips are still there.
    setHeard({ words: text, instrument: "instrument" in answer ? answer.instrument : undefined });
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
    setError(null);
    setHeard(null);
    setListening(true);
    listenRef.current = listenForPhrase((result) => {
      listenRef.current = null;
      setListening(false);
      if ("error" in result) return setError(result.error);
      setWords(result.text);
      void read(result.text);
    });
  }

  const labelId = `plays-as-${idea.id}`;

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2 rounded-sm bg-canvas/10 p-2">
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="px-1 text-sm font-semibold">
          What should it play as?
        </span>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className={`${chip} hover:bg-canvas/10`}>
            {idea.instrument ? "Cancel" : "Not now"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {instrumentIds.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={idea.instrument === id}
            onClick={() => void choose(id)}
            className={`${chip} bg-canvas/10 hover:bg-canvas/20`}
          >
            {instruments[id].label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex items-center gap-1">
        <label htmlFor={`${labelId}-words`} className="sr-only">
          Or say it in your own words
        </label>
        <input
          id={`${labelId}-words`}
          value={words}
          onChange={(e) => {
            setWords(e.target.value);
            setHeard(null);
          }}
          placeholder={speech ? "Or say it: “make it strings”" : "Or type it: “make it strings”"}
          enterKeyHint="go"
          className="h-8 min-w-0 flex-1 rounded-full bg-canvas/10 px-3 text-sm font-semibold placeholder:font-normal placeholder:text-canvas/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas"
        />
        {speech && (
          <button type="button" onClick={listen} aria-pressed={listening} className={`${roundButton} ${listening ? "animate-pulse" : ""}`}>
            {listening ? <Stop size={16} weight="fill" aria-hidden /> : <Microphone size={16} weight="fill" aria-hidden />}
            <span className="sr-only">{listening ? "Stop listening" : "Say the instrument"}</span>
          </button>
        )}
      </form>
      <div aria-live="polite" className="flex flex-col gap-1">
        {speech && !heard && !error && (
          <span className="px-1 text-xs opacity-70">
            {listening ? "Listening…" : "Speaking it?"} Your browser&apos;s speech service hears what you say.
          </span>
        )}
        {heard && heard.instrument && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-sm">
              Sounds like <span className="font-semibold">{instruments[heard.instrument].label}</span>.
            </span>
            <button type="button" onClick={() => void choose(heard.instrument!)} className={`${chip} bg-canvas text-ink hover:opacity-90`}>
              <Check size={12} weight="bold" aria-hidden />
              Use {instruments[heard.instrument].label}
            </button>
          </div>
        )}
        {heard?.asking && (
          <span className="flex items-center gap-2 px-1 text-xs">
            <span className="h-3 w-24 animate-pulse rounded-sm bg-canvas/20" aria-hidden />
            Asking Claude what “{heard.words}” sounds like
          </span>
        )}
        {heard && !heard.instrument && !heard.asking && (
          <span className="px-1 text-xs font-semibold">
            hum didn&apos;t catch an instrument in “{heard.words}”. Try “piano”, “strings” or “bass”, or tap one above.
          </span>
        )}
        {error && (
          <span role="alert" className="px-1 text-xs font-semibold">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
