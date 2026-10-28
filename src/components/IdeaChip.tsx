import type { ButtonHTMLAttributes, ReactNode } from "react";
import { captureBg } from "@/ui/ideaColors";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { kind: keyof typeof captureBg; icon: ReactNode };

/** A capture action: a pill with the idea's color in a circle, like the studio's add-track menu. */
export function IdeaChip({ kind, icon, children, className = "", ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-2 rounded-full bg-raised py-1 pr-4 pl-1 text-base font-semibold text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 ${className}`}
    >
      <span className={`inline-flex size-8 items-center justify-center rounded-full text-canvas ${captureBg[kind]}`} aria-hidden>
        {icon}
      </span>
      {children}
    </button>
  );
}
