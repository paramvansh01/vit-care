import type { ReactNode } from "react";

/* ------------------------------------------------------------------ layout */

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto w-full px-5 py-7 sm:px-7 ${wide ? "max-w-[1600px]" : "max-w-[1240px]"}`}>
      {children}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  desc,
  right,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
        {desc && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({
  children,
  className = "",
  lift = false,
}: {
  children: ReactNode;
  className?: string;
  lift?: boolean;
}) {
  return <div className={`card ${lift ? "card-lift" : ""} ${className}`}>{children}</div>;
}

/* ------------------------------------------------------------------- atoms */

// One family of tints drawn from the mint palette, plus amber and coral for
// the two states that must stand out.
const CHIP_TONES: Record<string, string> = {
  neutral: "bg-sunk text-ink-soft border-line",
  brand: "bg-brand-wash text-brand-deep border-brand-tint",
  ok: "bg-brand text-white border-brand",
  warn: "bg-warn-wash text-warn border-warn/25",
  danger: "bg-danger-wash text-danger border-danger/25",
  info: "bg-brand-wash text-brand-deep border-brand-tint",
  violet: "bg-[#eef1f4] text-[#4b5d70] border-[#d8dfe6]",
  orange: "bg-warn-wash text-warn border-warn/25",
};

export type Tone = keyof typeof CHIP_TONES;

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={`chip ${CHIP_TONES[tone] ?? CHIP_TONES.neutral} ${className}`}>{children}</span>;
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const accent: Record<string, string> = {
    neutral: "text-ink",
    brand: "text-brand-deep",
    ok: "text-brand-deep",
    warn: "text-warn",
    danger: "text-danger",
    info: "text-ink",
    violet: "text-ink",
    orange: "text-warn",
  };
  return (
    <div className="card card-lift p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {icon && <span className="text-ink-mute">{icon}</span>}
      </div>
      <p className={`mt-2 font-serif text-[30px] font-semibold leading-none ${accent[tone]}`}>{value}</p>
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-ink-mute">{hint}</p>}
    </div>
  );
}

export function KeyVal({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <span className="text-[11.5px] text-ink-mute">{k}</span>
      <span className="mono text-right text-[11.5px] text-ink">{v}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-sunk/60 px-5 py-10 text-center text-[12.5px] text-ink-mute">
      {children}
    </div>
  );
}

export function Bar({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "ok" | "warn" | "danger" }) {
  const colors = {
    brand: "bg-brand",
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    danger: "bg-rose-500",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunk">
      <div
        className={`h-full rounded-full ${colors[tone]} transition-[width] duration-700 ease-out`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ tables */

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-[12.5px]">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className = "",
  ...rest
}: { children?: ReactNode; className?: string } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-ink-mute ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  ...rest
}: { children?: ReactNode; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`border-b border-line px-3 py-2 align-middle ${className}`} {...rest}>
      {children}
    </td>
  );
}

export function SqlBlock({ code, className = "" }: { code: string; className?: string }) {
  return (
    <pre
      className={`mono overflow-x-auto rounded-xl border border-line bg-[#fcfcfb] p-3.5 text-[11.5px] leading-[1.65] text-ink-soft ${className}`}
    >
      {code.trim()}
    </pre>
  );
}
