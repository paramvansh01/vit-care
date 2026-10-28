import { NextResponse } from "next/server";
import { touchSession } from "@/lib/auth";
import { callByCode, normaliseCode, ring, setStatus, sideFor } from "@/lib/calls";

export const dynamic = "force-dynamic";

/** accept / decline / ring / end — each is one UPDATE on call_session. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const me = await touchSession();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const code = normaliseCode(decodeURIComponent((await params).code));
  const call = callByCode(code);
  if (!call) return NextResponse.json({ error: `No call with code ${code}.` }, { status: 404 });

  const side = sideFor(call, me.user_id);
  if (!side) return NextResponse.json({ error: "This call is between two other people." }, { status: 403 });

  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  switch (action) {
    case "accept":
      setStatus(call.call_id, "ACTIVE");
      break;
    case "decline":
      if (side === "GUEST" && call.status === "RINGING") setStatus(call.call_id, "DECLINED");
      break;
    case "ring":
      if (side === "HOST") ring(call);
      break;
    case "end":
      if (call.status !== "DECLINED" && call.status !== "MISSED") setStatus(call.call_id, "ENDED");
      break;
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
