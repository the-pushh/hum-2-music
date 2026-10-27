import { captureIdea, sketchStore } from "@/sketches/client";
import type { LinkInput } from "@/sketches/types";
import { fetchOEmbed } from "./oembed";
import type { LinkTarget } from "./parseLink";

/**
 * Saves the link straight away (so it's never lost, even offline), then fills in its preview.
 * A failed preview leaves a plain URL card.
 */
export async function captureLink(openSketchId: string | null, target: LinkTarget) {
  const link: LinkInput = { kind: "link", url: target.url, provider: target.provider };
  const result = await captureIdea(openSketchId, link);
  void fetchPreview(target)
    .then((preview) => sketchStore().updateIdea(result.idea.id, { ...link, ...preview }))
    .catch(() => {});
  return result;
}

async function fetchPreview(target: LinkTarget) {
  if (target.provider !== "web") return fetchOEmbed(target);
  return {};
}
