/** Reads a design-token colour so canvas-drawn waveforms match the CSS theme. */
export function tokenColor(name: "ink" | "ink-muted" | "line" | "accent" | "canvas"): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}
