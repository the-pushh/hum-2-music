"use client";

/** The parts of the Web Speech API hum uses. TypeScript's DOM types don't include it, and Safari still prefixes it. */
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Whether this browser can turn speech into text. Firefox can't, so the speak button is hidden there. */
export function canRecognizeSpeech(): boolean {
  return recognitionClass() !== undefined;
}

export type Listening = { cancel: () => void };

/**
 * Listens for one short phrase and hands back what was said. The browser's speech service does the hearing; hum only
 * keeps the text. `onDone` gets the transcript, or an error message, and runs once.
 */
export function listenForPhrase(onDone: (result: { text: string } | { error: string }) => void): Listening {
  const Recognition = recognitionClass();
  if (!Recognition) {
    onDone({ error: "This browser can't hear speech. Type it instead." });
    return { cancel() {} };
  }
  const recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let done = false;
  const finish = (result: { text: string } | { error: string }) => {
    if (done) return;
    done = true;
    onDone(result);
  };
  recognition.onresult = (e) => finish({ text: e.results[0]?.[0]?.transcript ?? "" });
  recognition.onerror = (e) =>
    finish({ error: e.error === "not-allowed" ? "hum needs the mic to hear you. Allow it in your browser, or type it." : "Didn't catch that. Try again, or type it." });
  recognition.onend = () => finish({ error: "Didn't catch that. Try again, or type it." });
  recognition.start();
  return {
    cancel() {
      done = true;
      recognition.abort();
    },
  };
}
