import { NextResponse } from "next/server";
import { getMonitorStats } from "@/lib/issue-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectKey = searchParams.get("projectKey") || undefined;
    const stats = await getMonitorStats(projectKey);
    return NextResponse.json({ stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถดึงข้อมูล Monitor ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
