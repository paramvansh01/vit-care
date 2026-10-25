"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center transition-colors hover:bg-sunk/50"
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronRight
          size={15}
          className={`mr-3 shrink-0 text-ink-mute transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && <div className="fade">{children}</div>}
    </div>
  );
}
