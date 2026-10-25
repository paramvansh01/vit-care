"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarClock,
  Database,
  Home,
  UserRound,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Layers3,
  Network,
  Pill,
  ScrollText,
  Stethoscope,
  Table2,
  Terminal,
} from "lucide-react";

const NAV = [
  {
    label: "The three segments",
    items: [
      { href: "/student", label: "Student Portal", icon: UserRound, badge: "you" },
      { href: "/doctor", label: "Doctor Console", icon: Stethoscope, badge: "admin" },
      { href: "/database", label: "How the DB works", icon: Database },
    ],
  },
  {
    label: "Overview",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/dashboard", label: "Live Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Database",
    items: [
      { href: "/er-diagram", label: "ER Diagram", icon: Network, badge: "live" },
      { href: "/schema", label: "Schema Explorer", icon: Table2 },
      { href: "/triggers", label: "Triggers & Views", icon: GitBranch },
      { href: "/normalization", label: "Normalization", icon: Layers3 },
      { href: "/sql", label: "SQL Console", icon: Terminal },
    ],
  },
  {
    label: "Modules",
    items: [
      { href: "/appointments", label: "Teleconsultation", icon: CalendarClock },
      { href: "/pharmacy", label: "e-Pharmacy", icon: Pill },
      { href: "/condonation", label: "Condonation", icon: ScrollText },
      { href: "/lab", label: "Trigger Lab", icon: FlaskConical },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <span className="relative grid h-9 w-9 place-items-center rounded-[10px] bg-brand-deep text-white shadow-sm">
          <Activity size={18} strokeWidth={2.4} />
          <span
            className="absolute inset-0 rounded-[10px] border border-brand"
            style={{ animation: "pulse-ring 2.6s ease-out infinite" }}
          />
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight">VIT-Care</span>
          <span className="block text-[10.5px] text-ink-mute">CSE2003 · DBMS</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="eyebrow px-2.5 pb-1.5">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={[
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
                        active
                          ? "bg-brand-wash font-semibold text-brand-deep"
                          : "text-ink-soft hover:bg-sunk hover:text-ink",
                      ].join(" ")}
                    >
                      {active && (
                        <span className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
                      )}
                      <Icon
                        size={15.5}
                        strokeWidth={active ? 2.3 : 1.9}
                        className={active ? "text-brand" : "text-ink-mute group-hover:text-ink-soft"}
                      />
                      <span className="truncate">{item.label}</span>
                      {"badge" in item && item.badge && (
                        <span className="ml-auto flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-brand">
                          <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand" />
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-4">
        <p className="text-[11px] leading-relaxed text-ink-mute">
          Param Vansh Singh · 25BCE2256
          <br />
          Harshit Aryan · 25BCE2378
        </p>
        <p className="mt-1.5 text-[10.5px] text-ink-mute">Guide: Prof. Saraswathi U</p>
      </div>
    </aside>
  );
}
