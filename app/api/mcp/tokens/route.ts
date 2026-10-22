import { NextResponse } from "next/server";
import {
  listMcpTokens,
  generateMcpToken,
  revokeMcpToken,
} from "@/lib/mcp-tokens";
import {
  assertCsrfSafe,
  authRequiredResponse,
  canUserAccessProject,
  getCurrentUser,
  listAllowedUsers,
  getSuperAdminEmail,
  maskEmail,
} from "@/lib/auth";
import { listProjects, normalizeProjectKey } from "@/lib/issue-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return authRequiredResponse();
    const isAuthenticatedAdmin = currentUser.isAdmin;
    const { searchParams } = new URL(req.url);
    // Members only ever see their own tokens; Admin may filter by owner
    const ownerEmail = isAuthenticatedAdmin
      ? searchParams.get("ownerEmail") || undefined
      : currentUser.email;
    const [tokens, allUsers, allProjects, superAdminEmail] = await Promise.all([
      listMcpTokens(ownerEmail),
      listAllowedUsers(),
      listProjects(),
      getSuperAdminEmail(),
    ]);
    const allowedUsers = isAuthenticatedAdmin
      ? allUsers
      : allUsers.filter((u) => u.email === currentUser.email);
    const projects = allProjects.filter((p) => canUserAccessProject(currentUser, p.key));

    // Mask emails in token list and allowedUsers when viewer is not logged in
    const safeTokens = tokens.map((t) => ({
      ...t,
      ownerEmail:
        isAuthenticatedAdmin || currentUser?.email === t.ownerEmail
          ? t.ownerEmail
          : maskEmail(t.ownerEmail),
      createdBy:
        isAuthenticatedAdmin || !t.createdBy?.includes("@")
          ? t.createdBy
          : maskEmail(t.createdBy),
    }));

    const safeAllowedUsers = allowedUsers.map((u) => ({
      ...u,
      email:
        isAuthenticatedAdmin || currentUser?.email === u.email
          ? u.email
          : maskEmail(u.email),
      addedBy:
        isAuthenticatedAdmin || !u.addedBy?.includes("@")
          ? u.addedBy
          : maskEmail(u.addedBy),
    }));

    return NextResponse.json({
      tokens: safeTokens,
      currentUser,
      allowedUsers: safeAllowedUsers,
      projects,
      superAdminEmail: isAuthenticatedAdmin
        ? superAdminEmail
        : maskEmail(superAdminEmail),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ดึงรายการ MCP Token ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return authRequiredResponse();
    const body = await req.json();

    if (body.action === "update_settings") {
      return NextResponse.json(
        { error: "MCP Server บังคับใช้ Token เสมอ ไม่สามารถปิดได้" },
        { status: 400 }
      );
    }

    // Members can only mint tokens for themselves; Admin may issue for any allowed email
    const ownerEmail = String(
      (currentUser.isAdmin && body.ownerEmail) || currentUser.email
    )
      .trim()
      .toLowerCase();
    if (
      !currentUser.isAdmin &&
      body.ownerEmail &&
      String(body.ownerEmail).trim().toLowerCase() !== currentUser.email
    ) {
      return NextResponse.json(
        { error: "สร้าง MCP Token ได้เฉพาะอีเมลของตัวเองเท่านั้น" },
        { status: 403 }
      );
    }

    if (!ownerEmail || !ownerEmail.includes("@") || ownerEmail.includes("*")) {
      return NextResponse.json(
        {
          error:
            "กรุณากรอกอีเมล Gmail เต็มที่ได้รับอนุญาตเพื่อผูกกับ Token (เช่น yourname@gmail.com หรือเข้าสู่ระบบก่อน)",
        },
        { status: 400 }
      );
    }

    const projectKey = normalizeProjectKey(String(body.projectKey || ""));

    if (!projectKey) {
      return NextResponse.json(
        {
          error:
            "กรุณาเลือกโปรเจกต์ (Project Key) ที่ต้องการผูกกับ MCP Token เพื่อป้องกันการสั่งงานผิดโปรเจกต์",
        },
        { status: 400 }
      );
    }

    const ownerName = String(
      body.ownerName || currentUser.name || ownerEmail.split("@")[0]
    ).trim();

    const name = String(body.name || "").trim() || "Antigravity";

    const validRoles = ["claude_reviewer", "antigravity_fixer", "admin"] as const;
    const requestedRole = validRoles.includes(body.agentRole)
      ? body.agentRole
      : "antigravity_fixer";
    const agentRole =
      requestedRole === "admin" && !currentUser.isAdmin
        ? "antigravity_fixer"
        : requestedRole;

    const created = await generateMcpToken({
      name,
      ownerEmail,
      ownerName,
      projectKey,
      agentRole,
    });

    return NextResponse.json(
      {
        rawToken: created.rawToken,
        token: created.record,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "สร้าง MCP Token ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const csrfErr = assertCsrfSafe(req);
  if (csrfErr) return csrfErr;

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return authRequiredResponse();
    const { searchParams } = new URL(req.url);
    const id = (searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "กรุณาระบุรหัส Token (id)" }, { status: 400 });
    }
    const revoked = await revokeMcpToken(id, currentUser.isAdmin ? undefined : currentUser.email);
    if (!revoked) {
      return NextResponse.json({ error: "ไม่พบ Token นี้ หรือไม่ใช่ Token ของคุณ" }, { status: 404 });
    }
    return NextResponse.json({ revoked, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ยกเลิก MCP Token ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
