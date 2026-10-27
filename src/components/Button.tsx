import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-ink text-canvas hover:bg-ink-muted",
  secondary: "bg-raised text-ink hover:bg-line",
  ghost: "bg-transparent text-ink-muted hover:bg-raised hover:text-ink",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants };

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-base font-semibold transition duration-300 ease-soft active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}
