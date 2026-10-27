/** Dark or light text for a "#rrggbb" background, by WCAG relative luminance. */
export function readableInk(hex: string): "dark" | "light" {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // The crossover where black and white text have equal contrast against the colour.
  return luminance > 0.179 ? "dark" : "light";
}
