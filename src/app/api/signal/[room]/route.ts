import { NextResponse } from "next/server";
import { all, run } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * WebRTC signalling relayed through `video_signal`. Each peer long-polls for
 * rows newer than the last id it saw, and posts its own offer / answer / ICE
 * candidates back. No third-party service is involved — the SDP handshake
 * literally travels through the project's own database.
 */

export async function GET(request: Request, { params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? 0) || 0;
  const me = url.searchParams.get("me") === "DOCTOR" ? "DOCTOR" : "STUDENT";

  // A peer only cares about what the *other* side sent.
  const signals = all<{ signal_id: number; sender: string; kind: string; payload: string }>(
    `SELECT signal_id, sender, kind, payload
       FROM video_signal
      WHERE room_code = ? AND signal_id > ? AND sender <> ?
      ORDER BY signal_id
      LIMIT 60`,
    room,
    since,
    me,
  );

  const peers = all<{ sender: string }>(
    `SELECT DISTINCT sender FROM video_signal
      WHERE room_code = ? AND created_at > datetime('now', '-40 second')`,
    room,
  ).map((r) => r.sender);

  return NextResponse.json({ signals, peers });
}

export async function POST(request: Request, { params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  const body = (await request.json()) as { sender?: string; kind?: string; payload?: unknown };

  const sender = body.sender === "DOCTOR" ? "DOCTOR" : "STUDENT";
  const kind = String(body.kind ?? "").toUpperCase();
  if (!["OFFER", "ANSWER", "ICE", "LEAVE"].includes(kind)) {
    return NextResponse.json({ error: `Unsupported signal kind: ${kind}` }, { status: 400 });
  }

  // A fresh offer means a new call in this room — clear the stale handshake so
  // the peers cannot pick up candidates from a previous session.
  if (kind === "OFFER") {
    run("DELETE FROM video_signal WHERE room_code = ?", room);
  }

  const info = run(
    "INSERT INTO video_signal (room_code, sender, kind, payload) VALUES (?, ?, ?, ?)",
    room,
    sender,
    kind,
    JSON.stringify(body.payload ?? null),
  );

  return NextResponse.json({ ok: true, signal_id: Number(info.lastInsertRowid) });
}
