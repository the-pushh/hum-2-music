"use client";

import { create } from "zustand";
import { withClaudeParts } from "@/studio/generate/parts";
import { useProjectStore } from "@/studio/store/project";
import { postWrite } from "./client";
import { writeRequestOf } from "./request";
import { maxBars, type WriteError } from "./write";

export type WriterState =
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

type Writer = {
  state: WriterState;
  /** The songwriter's note, kept so Another take and Rewrite ask the same thing. */
  note: string;
  setNote: (note: string) => void;
  /** Asks Claude to write with the current note, and puts the parts on the generated tracks as one undo step. */
  write: () => Promise<void>;
  cancel: () => void;
};

/**
 * Write with Claude's one writer, shared by the sheet on the transport and the studio's "doesn't follow the new style"
 * notice, so both show the same progress and a write can't start twice.
 */
export const useWriter = create<Writer>((set, get) => ({
  state: { status: "idle" },
  note: "",
  setNote: (note) => set({ note }),
  cancel: () => {
    const { state } = get();
    if (state.status === "writing") state.controller.abort();
  },
  write: async () => {
    const project = useProjectStore.getState().project;
    if (!project || get().state.status === "writing") return;
    const controller = new AbortController();
    set({ state: { status: "writing", controller } });
    try {
      const result = await postWrite(writeRequestOf(project, get().note), controller.signal);
      if (!result.ok) return set({ state: { status: "failed", message: errorText[result.error] } });
      // The arrangement as it is now: the songwriter may have edited while Claude wrote.
      const current = useProjectStore.getState().project;
      if (current) useProjectStore.getState().loadProject(withClaudeParts(current, result.parts));
      set({ state: { status: "written", summary: result.summary } });
    } catch {
      set({ state: { status: "failed", message: "Stopped. Your parts haven't changed.", quiet: true } });
    }
  },
}));
