import { NextResponse } from "next/server";
import { touchSession } from "@/lib/auth";
import { PRESENCE_SECONDS, callByCode, normaliseCode, setStatus, sideFor } from "@/lib/calls";
import { all, one, run, scalar } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * WebRTC signalling relayed through `video_signal`. Each peer polls for rows
 * newer than the last id it saw and posts its own HELLO / offer / answer / ICE
 * candidates back. No third-party service is involved — the SDP handshake
 * travels through the project's own database. Which side a browser speaks for
 * is decided here from its session, never taken from the request.
 */

async function resolve(params: Promise<{ room: string }>) {
  const me = await touchSession();
  if (!me) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  const code = normaliseCode(decodeURIComponent((await params).room));
  const call = callByCode(code);
  if (!call) return { error: NextResponse.json({ error: `No call with code ${code}.` }, { status: 404 }) };
  const side = sideFor(call, me.user_id);
  if (!side) {
    return { error: NextResponse.json({ error: "This call is between two other people." }, { status: 403 }) };
  }
  return { call, side, code };
}

export async function GET(request: Request, { params }: { params: Promise<{ room: string }> }) {
  const r = await resolve(params);
  if ("error" in r) return r.error;
  const { call, side, code } = r;
  const since = Number(new URL(request.url).searchParams.get("since") ?? 0) || 0;

  run(
    `UPDATE call_session SET ${side === "HOST" ? "host_seen_at" : "guest_seen_at"} = datetime('now')
      WHERE call_id = ?`,
    call.call_id,
  );

  // A peer only cares about what the *other* side sent.
  const signals = all<{ signal_id: number; kind: string; payload: string }>(
    `SELECT signal_id, kind, payload FROM video_signal
      WHERE room_code = ? AND signal_id > ? AND sender <> ?
      ORDER BY signal_id LIMIT 80`,
    code,
    since,
    side,
  );

  const state = one<{ status: string; peer_here: number }>(
    `SELECT status,
            COALESCE(${side === "HOST" ? "guest_seen_at" : "host_seen_at"} > datetime('now', ?), 0) AS peer_here
       FROM call_session WHERE call_id = ?`,
    `-${PRESENCE_SECONDS} second`,
    call.call_id,
  );

  return NextResponse.json({
    side,
    signals,
    lastId: scalar<number>("SELECT COALESCE(MAX(signal_id), 0) FROM video_signal WHERE room_code = ?", code),
    status: state?.status ?? call.status,
    peerHere: Boolean(state?.peer_here),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ room: string }> }) {
  const r = await resolve(params);
  if ("error" in r) return r.error;
  const { call, side, code } = r;

  const body = (await request.json().catch(() => ({}))) as { kind?: string; payload?: unknown };
  const kind = String(body.kind ?? "").toUpperCase();
  if (!["HELLO", "OFFER", "ANSWER", "ICE", "LEAVE"].includes(kind)) {
    return NextResponse.json({ error: `Unsupported signal kind: ${kind}` }, { status: 400 });
  }

  // A fresh offer starts a new negotiation round: whatever the previous round
  // left in the room can only confuse the peers, so it goes.
  if (kind === "OFFER") run("DELETE FROM video_signal WHERE room_code = ?", code);

  const info = run(
    "INSERT INTO video_signal (room_code, sender, kind, payload) VALUES (?, ?, ?, ?)",
    code,
    side,
    kind,
    JSON.stringify(body.payload ?? null),
  );

  if (kind === "HELLO" && side === "GUEST") setStatus(call.call_id, "ACTIVE");
  if (kind === "LEAVE") {
    run(
      `UPDATE call_session SET ${side === "HOST" ? "host_seen_at" : "guest_seen_at"} = NULL
        WHERE call_id = ?`,
      call.call_id,
    );
    // The host hanging up also stops the guest's phone from ringing.
    if (call.status === "ACTIVE" || (side === "HOST" && call.status === "RINGING")) {
      setStatus(call.call_id, "ENDED");
    }
  }

  return NextResponse.json({ ok: true, signal_id: Number(info.lastInsertRowid) });
}
