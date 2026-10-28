/** The faint dot grid behind every page, like a DAW's canvas. A pattern of dots, not a gradient. */
export function DotGrid() {
  return (
    <svg aria-hidden className="pointer-events-none fixed inset-0 -z-10 size-full text-line">
      <defs>
        <pattern id="hum-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-current" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hum-dots)" />
    </svg>
  );
}
