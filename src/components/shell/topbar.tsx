"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Database, Loader2, RotateCcw } from "lucide-react";

const TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "VIT-Care", sub: "Telemedicine & Attendance Condonation Platform" },
  "/dashboard": { title: "Live Dashboard", sub: "Operational rollup straight from the database" },
  "/student": { title: "Student Portal", sub: "Your profile, consultations, cart and medical leave" },
  "/doctor": { title: "Doctor Console", sub: "Queue, video consultation, prescribing and medical leave" },
  "/database": { title: "How the Database Works", sub: "The triggers and views doing the work underneath" },
  "/er-diagram": { title: "ER Diagram", sub: "Introspected live from sqlite_master and PRAGMA" },
  "/schema": { title: "Schema Explorer", sub: "Every table, key, index and row" },
  "/triggers": { title: "Triggers & Views", sub: "Procedural logic and RBAC projections" },
  "/normalization": { title: "Normalization", sub: "1NF → 2NF → 3NF, proven on real relations" },
  "/sql": { title: "SQL Console", sub: "Run read-only queries against the live database" },
  "/appointments": { title: "Teleconsultation", sub: "Slot booking guarded by a database trigger" },
  "/pharmacy": { title: "e-Pharmacy", sub: "Catalog, cart and cash-on-delivery checkout" },
  "/condonation": { title: "Attendance Condonation", sub: "Certificate → request → faculty decision" },
  "/lab": { title: "Trigger Lab", sub: "Fire each trigger and watch the database react" },
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const meta = TITLES[pathname] ?? { title: "VIT-Care", sub: "" };

  async function reset() {
    await fetch("/api/reset", { method: "POST" });
    setConfirming(false);
    startTransition(() => router.refresh());
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-line bg-surface/85 px-5 backdrop-blur-md sm:px-7">
      <div className="min-w-0">
        <h1 className="truncate text-[14.5px] font-semibold tracking-tight">{meta.title}</h1>
        <p className="truncate text-[11.5px] text-ink-mute">{meta.sub}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-line bg-sunk px-2.5 py-1 text-[11px] text-ink-soft sm:flex">
          <Database size={12} className="text-brand" />
          <span className="mono">vitcare.db</span>
          <span className="live-dot ml-0.5 h-1.5 w-1.5 rounded-full bg-ok" />
        </span>

        {confirming ? (
          <span className="flex items-center gap-1.5">
            <button
              onClick={reset}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg bg-danger px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Confirm reset
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-ink-soft transition hover:bg-sunk"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            title="Drop every object and rebuild from schema.sql + triggers.sql + seed.sql"
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-ink-soft transition hover:border-line-strong hover:bg-sunk"
          >
            <RotateCcw size={12} />
            Reset DB
          </button>
        )}
      </div>
    </header>
  );
}
