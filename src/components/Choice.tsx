"use client";

type Option<T> = { value: T; label: string };

/** A row of mutually exclusive choices, like a segmented control. */
export function Choice<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-raised p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => o.value !== value && onChange(o.value)}
          className="rounded-md px-2 py-1 text-xs font-semibold text-ink-muted transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:bg-line aria-pressed:text-ink"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
