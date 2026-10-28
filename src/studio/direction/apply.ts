import { withStyle } from "@/studio/generate/parts";
import type { Project } from "@/studio/types";
import type { Direction } from "./schema";

/**
 * The arrangement with a Direction applied: a new tempo (notes stay where they are in beats) and Style changes, with
 * generated parts rewritten to follow. What the Direction doesn't name stays as it is. Loaded into the studio as one
 * change, so one undo takes it all back.
 */
export function applyDirection(project: Project, direction: Direction): Project {
  let next = project;
  if (direction.bpm !== undefined && direction.bpm !== project.bpm) next = { ...next, bpm: direction.bpm };
  const style = Object.fromEntries(Object.entries(direction.style ?? {}).filter(([, v]) => v !== undefined));
  if (Object.keys(style).length) next = withStyle(next, style);
  return next;
}
