import { NextResponse } from "next/server";
import { getDb, ensureIndexesAndSeed } from "@/lib/mongodb";
import {
  adminRequiredResponse,
  assertCsrfSafe,
  authRequiredResponse,
  getCurrentUser,
} from "@/lib/auth";

export const runtime = "nodejs";

// Wipes every issue and attachment, so Admin only
export async function POST(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const user = await getCurrentUser();
    if (!user) return authRequiredResponse();
    if (!user.isAdmin) return adminRequiredResponse();
    const db = await getDb();
    await ensureIndexesAndSeed(db, true);
    return NextResponse.json({ status: "seeded" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถสร้างข้อมูลตัวอย่างได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
