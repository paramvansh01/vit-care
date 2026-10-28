"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Phone, Plus } from "lucide-react";

async function place(calleeId: number | null) {
  const res = await fetch("/api/calls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calleeId ? { calleeId } : {}),
  });
  const data = (await res.json()) as { code?: string; error?: string };
  if (!res.ok || !data.code) throw new Error(data.error ?? "Could not place the call.");
  return data.code;
}

/** Rings one person: creates a RINGING call_session and opens the room. */
export function CallButton({
  userId,
  name,
  online,
  compact = false,
}: {
  userId: number;
  name: string;
  online: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function call() {
    setError(null);
    start(async () => {
      try {
        const code = await place(userId);
        router.push(`/call/${code}?join=1`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={call}
        disabled={pending}
        title={online ? `Call ${name}` : `${name} is offline — the call will ring when they open VIT-Care`}
        className={`label flex items-center gap-1.5 rounded px-3 py-1.5 transition disabled:opacity-60 ${
          online
            ? "bg-brand text-white hover:bg-brand-deep"
            : "border border-line-strong text-brand-deep hover:bg-brand-wash"
        }`}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
        {compact ? "Call" : `Call ${name.split(" ").slice(0, 2).join(" ")}`}
      </button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </span>
  );
}

/** Opens a room with no callee yet; whoever enters the code takes the seat. */
export function NewRoomButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => router.push(`/call/${await place(null)}?join=1`))}
      disabled={pending}
      className="flex items-center gap-2 rounded bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
      New room with a code
    </button>
  );
}

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const clean = code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (clean.length >= 6) router.push(`/call/${clean}?join=1`);
      }}
      className="flex gap-2"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABC-123"
        maxLength={12}
        className="inp mono w-40 uppercase tracking-widest"
        aria-label="Room code"
      />
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded border border-line-strong px-3.5 py-2 text-[13px] font-medium text-brand-deep transition hover:bg-brand-wash"
      >
        <LogIn size={14} /> Join
      </button>
    </form>
  );
}
