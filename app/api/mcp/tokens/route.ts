import { NextResponse } from "next/server";
import {
  listMcpTokens,
  generateMcpToken,
  revokeMcpToken,
  getMcpAuthSettings,
  setMcpAuthSettings,
} from "@/lib/mcp-tokens";
import {
  getCurrentUser,
  listAllowedUsers,
  getSuperAdminEmail,
  maskEmail,
} from "@/lib/auth";
import { listProjects } from "@/lib/issue-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerEmail = searchParams.get("ownerEmail") || undefined;
    const [tokens, settings, currentUser, allowedUsers, projects, superAdminEmail] =
      await Promise.all([
        listMcpTokens(ownerEmail),
        getMcpAuthSettings(),
        getCurrentUser(),
        listAllowedUsers(),
        listProjects(),
        getSuperAdminEmail(),
      ]);

    const isAuthenticatedAdmin =
      Boolean(currentUser?.isAdmin) || currentUser?.email === superAdminEmail;

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
      settings,
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
  try {
    const body = await req.json();

    if (body.action === "update_settings") {
      const settings = await setMcpAuthSettings(Boolean(body.enforceTokenAuth));
      return NextResponse.json({ settings });
    }

    const currentUser = await getCurrentUser();
    const ownerEmail = String(body.ownerEmail || currentUser?.email || "")
      .trim()
      .toLowerCase();

    if (!ownerEmail || !ownerEmail.includes("@") || ownerEmail.includes("*")) {
      return NextResponse.json(
        {
          error:
            "กรุณากรอกอีเมล Gmail เต็มที่ได้รับอนุญาตเพื่อผูกกับ Token (เช่น yourname@gmail.com หรือเข้าสู่ระบบก่อน)",
        },
        { status: 400 }
      );
    }

    const projectKey = String(body.projectKey || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

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
      body.ownerName || currentUser?.name || ownerEmail.split("@")[0]
    ).trim();

    const name = String(body.name || "").trim() || "Antigravity";

    const validRoles = ["claude_reviewer", "antigravity_fixer", "admin"] as const;
    const agentRole = validRoles.includes(body.agentRole)
      ? body.agentRole
      : "antigravity_fixer";

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
  try {
    const { searchParams } = new URL(req.url);
    const id = (searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "กรุณาระบุรหัส Token (id)" }, { status: 400 });
    }
    const revoked = await revokeMcpToken(id);
    return NextResponse.json({ revoked, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ยกเลิก MCP Token ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
