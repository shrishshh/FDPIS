"use client";

import { useId, useState } from "react";

/**
 * Minimal hover/focus tooltip. Keyboard reachable, no library.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className = "",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span tabIndex={0} aria-describedby={open ? id : undefined} className="inline-flex rounded">
        {children}
      </span>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-lift ${
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
