import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

/** POST /api/reset            -> reference data only
 *  POST /api/reset?sample=1   -> reference data plus the sample people */
export async function POST(request: Request) {
  try {
    resetDatabase(new URL(request.url).searchParams.get("sample") === "1");
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
