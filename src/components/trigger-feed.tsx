"use client";

import { useEffect, useRef, useState } from "react";
import type { TriggerEvent } from "@/lib/queries";

const TONE: Record<string, { dot: string; text: string }> = {
  "AFTER INSERT": { dot: "bg-emerald-500", text: "text-emerald-700" },
  "AFTER UPDATE": { dot: "bg-blue-500", text: "text-blue-700" },
  "BEFORE INSERT": { dot: "bg-amber-500", text: "text-amber-700" },
};

/**
 * Polls trigger_log so the stream keeps ticking while the user drives the
 * app in another tab. New rows animate in at the top.
 */
export function TriggerFeed({ initial }: { initial: TriggerEvent[] }) {
  const [events, setEvents] = useState(initial);
  const seen = useRef(new Set(initial.map((e) => e.log_id)));

  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/trigger-log?limit=24", { cache: "no-store" });
        const data = (await res.json()) as { events: TriggerEvent[] };
        if (!live || !data.events) return;
        setEvents(data.events);
        for (const e of data.events) seen.current.add(e.log_id);
      } catch {
        /* the stream is best-effort */
      }
    };
    const id = setInterval(poll, 4000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  if (!events.length) {
    return (
      <p className="px-4 py-8 text-center text-[12px] text-ink-mute">
        No trigger has fired yet. Book an appointment or verify a certificate.
      </p>
    );
  }

  return (
    <ol className="max-h-[440px] divide-y divide-line overflow-y-auto">
      {events.map((e, i) => {
        const tone = TONE[e.event] ?? { dot: "bg-slate-400", text: "text-slate-600" };
        return (
          <li
            key={e.log_id}
            className="fade px-4 py-2.5"
            style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}
          >
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
              <span className="mono truncate text-[10.5px] font-semibold text-ink">
                {e.trigger_name.replace(/^trg_/, "")}
              </span>
              <span className={`mono ml-auto shrink-0 text-[9px] ${tone.text}`}>{e.event}</span>
            </div>
            <p className="mt-1 pl-3.5 text-[11.5px] leading-snug text-ink-soft">{e.message}</p>
            <p className="mono mt-0.5 pl-3.5 text-[9.5px] text-ink-mute">
              on {e.table_name} · {e.at}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
