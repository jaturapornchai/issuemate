import { NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/issue-service";
import { getCollections, attachmentKeysOf, removeUnreferencedAttachments } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถดึงรายการโปรเจกต์ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await createProject({
      key: String(body.key || ""),
      name: String(body.name || ""),
      description: body.description ? String(body.description) : "",
      repoOrServer: body.repoOrServer ? String(body.repoOrServer) : undefined,
      color: body.color ? String(body.color) : "#10b981",
      icon: body.icon ? String(body.icon) : "Server",
    });
    return NextResponse.json({ project: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถสร้างโปรเจกต์ได้";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = (searchParams.get("key") || "").trim().toUpperCase();
    if (!key) {
      return NextResponse.json({ error: "กรุณาระบุรหัสโปรเจกต์" }, { status: 400 });
    }
    const { projects, issues } = await getCollections();
    const droppedKeys = await attachmentKeysOf(issues, { projectKey: key });
    await Promise.all([
      projects.deleteOne({ key }),
      issues.deleteMany({ projectKey: key }),
    ]);
    await removeUnreferencedAttachments(issues, droppedKeys);
    return NextResponse.json({ deleted: key });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ไม่สามารถลบโปรเจกต์ได้";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
