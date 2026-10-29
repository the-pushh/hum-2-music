"use client";

import { PenNib } from "@phosphor-icons/react";
import { claudePartsFollowStyle, withGeneratedParts } from "@/studio/generate/parts";
import { useProjectStore } from "@/studio/store/project";
import { useWriter } from "@/studio/write/writer";
import { Button } from "../Button";
import { WriterStatus } from "./WriteWithClaude";

/**
 * Shown when the Style changes after Claude wrote parts: they're kept as written, so the songwriter chooses whether
 * Claude rewrites them in the new Style or the rule-based Generators take over. Either is one undo step.
 */
export function StyleDriftNotice() {
  const project = useProjectStore((s) => s.project);
  const { state, write } = useWriter();
  if (!project || claudePartsFollowStyle(project)) return null;

  function takeRules() {
    const current = useProjectStore.getState().project;
    if (current) useProjectStore.getState().loadProject(withGeneratedParts(current));
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="w-full text-sm text-ink sm:w-auto sm:flex-1">Claude&apos;s parts don&apos;t follow the new Style.</p>
        <Button variant="secondary" className="text-sm" disabled={state.status === "writing"} onClick={() => void write()}>
          <PenNib size={16} aria-hidden />
          Rewrite with Claude
        </Button>
        <Button variant="ghost" className="text-sm" disabled={state.status === "writing"} onClick={takeRules}>
          Use rules
        </Button>
      </div>
      {state.status !== "written" && <WriterStatus />}
    </div>
  );
}
