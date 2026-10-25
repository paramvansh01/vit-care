import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    resetDatabase();
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
