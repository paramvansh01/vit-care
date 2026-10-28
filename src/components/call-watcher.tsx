"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Phone, PhoneOff } from "lucide-react";

type Incoming = {
  room_code: string;
  rang_at: string;
  caller_name: string | null;
  caller_role: string | null;
  appointment_id: number | null;
};

/**
 * Lives in the layout of every signed-in page. Its poll doubles as the
 * presence heartbeat (/api/calls bumps app_session.last_seen_at), and when a
 * call_session row is RINGING for this user it rings, wherever they are.
 */
export function CallWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [call, setCall] = useState<Incoming | null>(null);
  const dismissed = useRef(new Set<string>());
  const audio = useRef<{ ctx: AudioContext; stop: () => void } | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const res = await fetch("/api/calls", { cache: "no-store" });
        const data = (await res.json()) as { incoming: Incoming[] };
        const next =
          data.incoming.find(
            (c) =>
              !dismissed.current.has(`${c.room_code}@${c.rang_at}`) && !pathname.startsWith(`/call/${c.room_code}`),
          ) ?? null;
        if (alive) setCall((prev) => (prev?.room_code === next?.room_code && prev?.rang_at === next?.rang_at ? prev : next));
      } catch {
        /* offline for a moment; the next tick retries */
      }
      if (alive) timer = setTimeout(tick, 2500);
    }
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pathname]);

  // A two-tone ring while the dialog is up. Browsers may hold the audio until
  // the page has been clicked once; the dialog itself still shows.
  useEffect(() => {
    if (!call) return;
    try {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.frequency.value = 480;
      osc.connect(gain);
      osc.start();
      let on = false;
      const id = setInterval(() => {
        on = !on;
        gain.gain.setTargetAtTime(on ? 0.08 : 0, ctx.currentTime, 0.02);
        osc.frequency.setValueAtTime(on ? 480 : 620, ctx.currentTime);
      }, 450);
      audio.current = {
        ctx,
        stop: () => {
          clearInterval(id);
          osc.stop();
          void ctx.close();
        },
      };
    } catch {
      /* no audio — the dialog is enough */
    }
    return () => {
      audio.current?.stop();
      audio.current = null;
    };
  }, [call]);

  async function respond(action: "accept" | "decline") {
    if (!call) return;
    const code = call.room_code;
    dismissed.current.add(`${code}@${call.rang_at}`);
    setCall(null);
    await fetch(`/api/calls/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => {});
    if (action === "accept") router.push(`/call/${encodeURIComponent(code)}?join=1`);
  }

  if (!call) return null;

  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className="fade w-full max-w-[420px] rounded-md border border-brand bg-surface shadow-[0_12px_40px_rgb(15_40_35/0.18)]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white">
            <Phone size={18} />
            <span className="ring-pulse absolute inset-0 rounded-full border-2 border-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="label text-brand-deep">
              Incoming {call.appointment_id ? "consultation" : "video"} call
            </p>
            <p className="truncate font-serif text-[18px] leading-tight">{call.caller_name ?? "Unknown"}</p>
            <p className="mono text-[11px] text-ink-mute">
              {call.caller_role?.toLowerCase()} · room {call.room_code}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line">
          <button
            onClick={() => respond("decline")}
            className="flex items-center justify-center gap-2 border-r border-line py-2.5 text-[13px] font-medium text-danger transition hover:bg-danger-wash"
          >
            <PhoneOff size={14} /> Decline
          </button>
          <button
            onClick={() => respond("accept")}
            className="flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold text-brand-deep transition hover:bg-brand-wash"
          >
            <Phone size={14} /> Accept
          </button>
        </div>
      </div>
    </div>
  );
}
