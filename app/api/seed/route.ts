import { NextResponse } from "next/server";
import { getDb, ensureIndexesAndSeed } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST() {
  try {
    const db = await getDb();
    await ensureIndexesAndSeed(db, true);
    return NextResponse.json({ status: "seeded" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถสร้างข้อมูลตัวอย่างได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
