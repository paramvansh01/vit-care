"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Loader2, LogOut, Plus, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { resetDb, signOut } from "@/app/auth-actions";

const TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "VIT-Care", sub: "Sign in or create an account" },
  "/student": { title: "Student Portal", sub: "Profile, consultations, cart and medical leave" },
  "/doctor": { title: "Doctor Console", sub: "Queue, video consultation, prescribing and leave" },
  "/calls": { title: "Calls", sub: "Video-call anyone on VIT-Care, or join a room by its code" },
  "/doctors": { title: "Doctors", sub: "Every registered clinician, live from the doctor relation" },
  "/database": { title: "How the Database Works", sub: "The triggers and views doing the work underneath" },
  "/dashboard": { title: "Dashboard", sub: "Operational rollup straight from the database" },
  "/er-diagram": { title: "ER Diagram", sub: "Introspected live from sqlite_master and PRAGMA" },
  "/schema": { title: "Schema", sub: "Every table, key, index and row" },
  "/triggers": { title: "Triggers & Views", sub: "Procedural logic and RBAC projections" },
  "/normalization": { title: "Normalization", sub: "1NF → 2NF → 3NF on the real relations" },
  "/sql": { title: "SQL Console", sub: "Read-only queries against the live database" },
  "/appointments": { title: "Teleconsultation", sub: "Slot booking guarded by a database trigger" },
  "/pharmacy": { title: "e-Pharmacy", sub: "Catalogue, cart and cash-on-delivery checkout" },
  "/condonation": { title: "Attendance Condonation", sub: "Certificate → request → faculty decision" },
  "/lab": { title: "Trigger Lab", sub: "Fire each trigger and watch the database react" },
  "/about": { title: "About VIT-Care", sub: "CSE2003 · Database Management Systems" },
  "/secure": { title: "Secure connection", sub: "Trust this laptop's certificate once per device" },
};

type User = { name: string; role: string; username: string } | null;

function tabsFor(user: User) {
  const own =
    user?.role === "DOCTOR"
      ? [{ href: "/doctor", label: "Console" }]
      : user?.role === "STUDENT"
        ? [{ href: "/student", label: "My portal" }]
        : [{ href: "/", label: "Sign in" }];
  return {
    main: [
      ...own,
      { href: "/calls", label: "Calls" },
      { href: "/doctors", label: "Doctors" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/pharmacy", label: "Pharmacy" },
      { href: "/condonation", label: "Condonation" },
    ],
    db: [
      { href: "/database", label: "How it works" },
      { href: "/er-diagram", label: "ER diagram" },
      { href: "/schema", label: "Schema" },
      { href: "/triggers", label: "Triggers" },
      { href: "/normalization", label: "Normalization" },
      { href: "/sql", label: "SQL" },
      { href: "/lab", label: "Lab" },
      { href: "/about", label: "About" },
    ],
  };
}

export function AppHeader({ user, lan, secureLan }: { user: User; lan: string | null; secureLan: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const key = pathname.startsWith("/call/") ? "/calls" : pathname;
  const meta = TITLES[key] ?? { title: "VIT-Care", sub: "" };
  const tabs = tabsFor(user);

  useEffect(() => {
    if (!menu) return;
    function away(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [menu]);

  function reset(withSample: boolean) {
    const msg = withSample
      ? "Wipe everything and rebuild with the sample students and doctors?"
      : "Wipe everything — all accounts, bookings and calls — and start empty?";
    if (!confirm(msg)) return;
    setMenu(false);
    start(async () => {
      const res = await resetDb(withSample);
      if (res.ok && withSample) alert(res.message);
      router.push("/");
      router.refresh();
    });
  }

  function logout() {
    start(async () => {
      await signOut();
      router.push("/");
      router.refresh();
    });
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : key === href || key.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[#f8fcfb]">
      {/* --------------------------------------------------------- title row */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-3 sm:px-6">
        <Link
          href={user ? (user.role === "DOCTOR" ? "/doctor" : "/student") : "/"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand text-white"
          aria-label="VIT-Care home"
        >
          <Plus size={22} strokeWidth={3} />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-serif text-[22px] font-semibold leading-none tracking-tight">{meta.title}</p>
          <p className="mt-1 truncate text-[12.5px] text-ink-soft">{meta.sub}</p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {lan && (
            <Link
              href="/secure"
              title={
                secureLan
                  ? `Others on this Wi-Fi can open https://${lan}:3443`
                  : `Run "npm run lan" so others on this Wi-Fi can join over HTTPS`
              }
              className="label hidden items-center gap-1.5 rounded border border-dashed border-line-strong px-2.5 py-1.5 text-ink-soft transition hover:border-brand md:flex"
            >
              {secureLan ? <Wifi size={13} /> : <WifiOff size={13} />}
              {secureLan ? `LAN ${lan}` : "Local only"}
            </Link>
          )}

          {user ? (
            <span className="label hidden items-center gap-1.5 rounded bg-brand px-2.5 py-1.5 text-white sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {user.role}
            </span>
          ) : null}

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenu((m) => !m)}
              className="flex items-center gap-2 rounded border border-line bg-surface px-2.5 py-1.5 text-[13px] transition hover:border-line-strong"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : null}
              <span className="max-w-[160px] truncate">{user ? user.name : "Not signed in"}</span>
              <ChevronDown size={14} className="text-ink-mute" />
            </button>
            {menu && (
              <div className="fade absolute right-0 top-full mt-1.5 w-64 rounded-md border border-line bg-surface py-1 shadow-lg">
                {user && (
                  <>
                    <div className="border-b border-line px-3 py-2">
                      <p className="text-[13px] font-medium">{user.name}</p>
                      <p className="mono text-[11px] text-ink-mute">{user.username}</p>
                    </div>
                    <MenuButton onClick={logout}>
                      <LogOut size={14} /> Sign out
                    </MenuButton>
                  </>
                )}
                <p className="eyebrow px-3 pb-1 pt-2.5">Database</p>
                <MenuButton onClick={() => reset(false)}>
                  <RotateCcw size={14} /> Reset — start empty
                </MenuButton>
                <MenuButton onClick={() => reset(true)}>
                  <RotateCcw size={14} /> Reset — load sample people
                </MenuButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ tab row */}
      <nav className="flex items-end gap-0 overflow-x-auto border-t border-line bg-toolbar px-2 sm:px-4">
        {tabs.main.map((t) => (
          <Tab key={t.href} href={t.href} active={isActive(t.href)}>
            {t.label}
          </Tab>
        ))}
        <span className="mx-2 mb-2 h-4 w-px shrink-0 self-end bg-line-strong" />
        {tabs.db.map((t) => (
          <Tab key={t.href} href={t.href} active={isActive(t.href)} quiet>
            {t.label}
          </Tab>
        ))}
      </nav>
    </header>
  );
}

function Tab({
  href,
  active,
  quiet = false,
  children,
}: {
  href: string;
  active: boolean;
  quiet?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "label shrink-0 border-b-2 px-3 py-2.5 transition-colors",
        active
          ? "border-brand-deep text-ink"
          : `border-transparent hover:text-ink ${quiet ? "text-ink-mute" : "text-ink-soft"}`,
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-soft transition hover:bg-sunk hover:text-ink"
    >
      {children}
    </button>
  );
}
