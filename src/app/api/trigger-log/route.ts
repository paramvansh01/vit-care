import { NextResponse } from "next/server";
import { triggerFeed } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 24) || 24, 200);
  return NextResponse.json({ events: triggerFeed(limit) });
}
