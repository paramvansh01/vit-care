import { NextResponse } from "next/server";
import { touchSession } from "@/lib/auth";
import { expireRinging, incomingFor, placeCall } from "@/lib/calls";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Polled every couple of seconds by every signed-in tab. The poll is also the
 * presence heartbeat, and the moment unanswered calls are rung out.
 */
export async function GET() {
  const me = await touchSession();
  if (!me) return NextResponse.json({ me: null, incoming: [] });
  expireRinging();
  const incoming = incomingFor(me.user_id).map((c) => ({
    room_code: c.room_code,
    rang_at: c.rang_at ?? c.created_at,
    caller_name: c.caller_name,
    caller_role: c.caller_role,
    appointment_id: c.appointment_id,
  }));
  return NextResponse.json({ me: { user_id: me.user_id, name: me.display_name }, incoming });
}

/** Places a call to another user, or opens a room anyone can join by its code. */
export async function POST(request: Request) {
  const me = await touchSession();
  if (!me) return NextResponse.json({ error: "Sign in to place a call." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { calleeId?: number };
  const calleeId = Number(body.calleeId) || null;

  if (calleeId !== null) {
    if (calleeId === me.user_id) {
      return NextResponse.json({ error: "You cannot call yourself." }, { status: 400 });
    }
    if (!one("SELECT 1 FROM app_user WHERE user_id = ?", calleeId)) {
      return NextResponse.json({ error: "That person no longer has an account." }, { status: 404 });
    }
  }

  return NextResponse.json({ code: placeCall(me.user_id, calleeId) });
}
