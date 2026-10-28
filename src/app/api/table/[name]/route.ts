import { NextResponse } from "next/server";
import { all, redactRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 25) || 25, 500);

  // Only names that exist as real tables or views are allowed through, so the
  // identifier can never be attacker-controlled SQL.
  const known = all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'",
  ).map((r) => r.name);

  if (!known.includes(name)) {
    return NextResponse.json({ error: `Unknown table: ${name}` }, { status: 404 });
  }

  const rows = all(`SELECT * FROM "${name}" LIMIT ?`, limit).map(redactRow);
  const total = all<{ n: number }>(`SELECT COUNT(*) AS n FROM "${name}"`)[0]?.n ?? 0;

  return NextResponse.json({ name, total, rows });
}
