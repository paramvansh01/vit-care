"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import type { ActionResult } from "@/app/actions";
import { SqlBlock } from "@/components/ui";

/* ------------------------------------------------------------------- fields */

export function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1.5">
        <span className="text-[11.5px] font-medium text-ink-soft">{label}</span>
        {required && <span className="text-[11px] text-danger">*</span>}
        {hint && <span className="text-[10.5px] text-ink-mute">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** A small segmented control. Works both controlled and as a plain form field. */
export function Segmented({
  name,
  value,
  defaultValue,
  onChange,
  options,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const controlled = value !== undefined;

  return (
    <div className="inline-flex rounded-lg border border-line bg-sunk p-0.5">
      {options.map((opt) => {
        const active = controlled ? value === opt.value : undefined;
        return (
          <label
            key={opt.value}
            className={[
              "cursor-pointer rounded-[6px] px-3 py-1.5 text-[11.5px] font-medium transition",
              active === true
                ? "bg-surface text-brand-deep shadow-sm"
                : active === false
                  ? "text-ink-mute hover:text-ink-soft"
                  : "text-ink-soft has-[:checked]:bg-surface has-[:checked]:text-brand-deep has-[:checked]:shadow-sm",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={controlled ? value === opt.value : undefined}
              defaultChecked={controlled ? undefined : defaultValue === opt.value}
              onChange={() => onChange?.(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- feedback */

/** Renders an action's outcome plus whatever the triggers did underneath it. */
export function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;

  return (
    <div
      className={[
        "mt-4 rounded-xl border p-3.5 fade",
        result.ok ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70",
      ].join(" ")}
    >
      <p
        className={`flex items-start gap-2 text-[12.5px] font-medium ${
          result.ok ? "text-emerald-800" : "text-rose-800"
        }`}
      >
        {result.ok ? (
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        )}
        {result.message}
      </p>

      {result.detail && result.detail.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 border-t border-black/5 pt-2.5">
          {result.detail.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-soft">
              <Zap size={11} className="mt-0.5 shrink-0 text-amber-500" />
              <span className="mono">{line}</span>
            </li>
          ))}
        </ul>
      )}

      {result.sql && <SqlBlock code={result.sql} className="mt-2.5" />}
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

export function money(value: number) {
  return `₹${value.toFixed(2)}`;
}

/** "Today" / "Tomorrow" / "Mon 29 Sep" — friendlier than a raw ISO date. */
export function whenLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
