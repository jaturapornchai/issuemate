import crypto from "crypto";
import { getDb } from "./mongodb";
import {
  getSuperAdminEmail,
  getAllowedUser,
  isEmailAllowed,
  canUserAccessProject,
} from "./auth";

export interface McpTokenRecord {
  id: string;
  name: string;
  /** Gmail / Google Account email that owns this token (acts as User ID) */
  ownerEmail: string;
  /** Display name of the Gmail user */
  ownerName: string;
  /** Bound Project Key (e.g. "SMLAIACC", "DEVOPS") to prevent cross-project mistakes */
  projectKey: string;
  agentRole: "claude_reviewer" | "antigravity_fixer" | "admin";
  tokenPrefix: string;
  tokenHash: string;
  /** Masked preview e.g. ism_live_9f8a...c41b */
  maskedToken: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt?: string | null;
  usageCount: number;
}

export type McpTokenPublic = Omit<McpTokenRecord, "tokenHash">;

export interface McpAuthSettings {
  enforceTokenAuth: boolean;
  updatedAt: string;
}

const META_SETTINGS_ID = "mcp_auth_settings";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function getMcpAuthSettings(): Promise<McpAuthSettings> {
  const db = await getDb();
  const doc = await db
    .collection<{ _id: string } & Partial<McpAuthSettings>>("system_meta")
    .findOne({ _id: META_SETTINGS_ID });

  return {
    enforceTokenAuth: Boolean(doc?.enforceTokenAuth),
    updatedAt: doc?.updatedAt || new Date().toISOString(),
  };
}

export async function setMcpAuthSettings(enforceTokenAuth: boolean): Promise<McpAuthSettings> {
  const db = await getDb();
  const updatedAt = new Date().toISOString();
  await db
    .collection<{ _id: string } & McpAuthSettings>("system_meta")
    .updateOne(
      { _id: META_SETTINGS_ID },
      {
        $set: {
          enforceTokenAuth: Boolean(enforceTokenAuth),
          updatedAt,
        },
      },
      { upsert: true }
    );
  return { enforceTokenAuth: Boolean(enforceTokenAuth), updatedAt };
}

export async function listMcpTokens(ownerEmail?: string): Promise<McpTokenPublic[]> {
  const [db, superAdmin] = await Promise.all([getDb(), getSuperAdminEmail()]);
  const filter = ownerEmail ? { ownerEmail: ownerEmail.trim().toLowerCase() } : {};
  const items = await db
    .collection<McpTokenRecord>("mcp_tokens")
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  return items.map(({ tokenHash: _hash, ...rest }) => ({
    ...rest,
    ownerEmail: rest.ownerEmail || superAdmin,
    ownerName: rest.ownerName || rest.createdBy || "DevOps User",
    projectKey: rest.projectKey || "ALL",
  }));
}

export async function generateMcpToken(input: {
  name: string;
  ownerEmail: string;
  ownerName?: string;
  projectKey: string;
  agentRole?: "claude_reviewer" | "antigravity_fixer" | "admin";
}): Promise<{
  rawToken: string;
  record: McpTokenPublic;
}> {
  const db = await getDb();
  const cleanEmail = (input.ownerEmail || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("กรุณาระบุอีเมล Gmail ที่ต้องการผูกกับ Token (เช่น user@gmail.com)");
  }

  const cleanProjectKey = (input.projectKey || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!cleanProjectKey) {
    throw new Error("กรุณาเลือกโปรเจกต์ (Project Key) ที่ต้องการผูกกับ MCP Token เพื่อป้องกันการสั่งงานผิดโปรเจกต์");
  }

  const allowedUser = await getAllowedUser(cleanEmail);
  if (!allowedUser) {
    throw new Error(
      `อีเมล ${cleanEmail} ยังไม่ได้รับอนุญาตจากผู้ดูแลระบบ (Admin) กรุณาให้ Admin เพิ่มอีเมลนี้ในระบบก่อนสร้าง MCP Token`
    );
  }

  if (!canUserAccessProject(allowedUser, cleanProjectKey)) {
    throw new Error(
      `อีเมล ${cleanEmail} ไม่มีสิทธิ์เข้าถึงโปรเจกต์ [${cleanProjectKey}] (ได้รับสิทธิ์เฉพาะโปรเจกต์: ${(
        allowedUser.allowedProjects || []
      ).join(", ")})`
    );
  }

  const cleanName = (input.name || "").trim() || "Antigravity";
  const cleanOwnerName =
    (input.ownerName || "").trim() || allowedUser.name || cleanEmail.split("@")[0];
  const agentRole = input.agentRole || "antigravity_fixer";

  const randomHex = crypto.randomBytes(20).toString("hex");
  const rawToken = `ism_live_${randomHex}`;
  const tokenPrefix = rawToken.slice(0, 15);
  const maskedToken = `${rawToken.slice(0, 15)}...${rawToken.slice(-6)}`;
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();

  const record: McpTokenRecord = {
    id: `tok_${crypto.randomBytes(6).toString("hex")}`,
    name: cleanName,
    ownerEmail: cleanEmail,
    ownerName: cleanOwnerName,
    projectKey: cleanProjectKey,
    agentRole,
    tokenPrefix,
    tokenHash,
    maskedToken,
    createdBy: `${cleanOwnerName} <${cleanEmail}>`,
    createdAt: now,
    lastUsedAt: null,
    usageCount: 0,
  };

  await db.collection<McpTokenRecord>("mcp_tokens").insertOne({ ...record });

  const { tokenHash: _hash, ...publicRecord } = record;
  return {
    rawToken,
    record: publicRecord,
  };
}

export async function revokeMcpToken(id: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.collection<McpTokenRecord>("mcp_tokens").deleteOne({ id });
  return (res.deletedCount || 0) > 0;
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }
  const customHeader = req.headers.get("x-mcp-token") || req.headers.get("x-api-key") || "";
  if (customHeader.trim()) {
    return customHeader.trim();
  }
  try {
    const url = new URL(req.url);
    const qToken = url.searchParams.get("token") || url.searchParams.get("apiKey");
    if (qToken && qToken.trim()) {
      return qToken.trim();
    }
  } catch {
    // ignore URL parse error
  }
  return null;
}

export function extractProjectFromRequest(req: Request): string | null {
  const headerProj =
    req.headers.get("x-mcp-project") || req.headers.get("x-project-key") || "";
  if (headerProj.trim()) {
    return headerProj.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  try {
    const url = new URL(req.url);
    const qProj =
      url.searchParams.get("project") || url.searchParams.get("projectKey") || "";
    if (qProj.trim()) {
      return qProj.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
  } catch {
    // ignore URL parse error
  }
  return null;
}

export async function verifyMcpRequestToken(req: Request): Promise<{
  allowed: boolean;
  error?: string;
  tokenRecord?: McpTokenPublic;
  boundProjectKey?: string;
}> {
  const settings = await getMcpAuthSettings();
  const rawToken = extractTokenFromRequest(req);
  const requestProject = extractProjectFromRequest(req);

  if (!rawToken) {
    if (settings.enforceTokenAuth) {
      return {
        allowed: false,
        error:
          "MCP Server เปิดโหมดบังคับใช้ Token ที่ผูกกับ Gmail และโปรเจกต์ (Strict Token Auth) กรุณาแนบ Header 'Authorization: Bearer ism_live_...' หรือ '?token=ism_live_...'",
      };
    }
    return {
      allowed: true,
      boundProjectKey: requestProject || undefined,
    };
  }

  const db = await getDb();
  const tokenHash = hashToken(rawToken);
  const found = await db.collection<McpTokenRecord>("mcp_tokens").findOneAndUpdate(
    { tokenHash },
    {
      $set: { lastUsedAt: new Date().toISOString() },
      $inc: { usageCount: 1 },
    },
    { returnDocument: "after" }
  );

  if (!found) {
    return {
      allowed: false,
      error: "MCP Token ไม่ถูกต้องหรือถูกยกเลิกแล้ว (Invalid or revoked MCP Token)",
    };
  }

  const emailStillAllowed = await isEmailAllowed(found.ownerEmail);
  if (!emailStillAllowed) {
    return {
      allowed: false,
      error: `อีเมล ${found.ownerEmail} ถูกยกเลิกสิทธิ์การใช้งานโดยผู้ดูแลระบบ (Admin)`,
    };
  }

  const tokenProject = (found.projectKey || "ALL").toUpperCase();
  if (
    requestProject &&
    requestProject !== "ALL" &&
    tokenProject !== "ALL" &&
    requestProject !== tokenProject
  ) {
    return {
      allowed: false,
      error: `ป้องกันการสั่งงานผิดโปรเจกต์: MCP Token นี้ผูกไว้กับโปรเจกต์ [${tokenProject}] เท่านั้น ไม่สามารถเรียกใช้งานข้ามไปโปรเจกต์ [${requestProject}] ได้`,
    };
  }

  const resolvedProject =
    tokenProject !== "ALL" ? tokenProject : requestProject || undefined;

  const { tokenHash: _hash, ...publicRecord } = found;
  return {
    allowed: true,
    tokenRecord: {
      ...publicRecord,
      projectKey: tokenProject,
    },
    boundProjectKey: resolvedProject,
  };
}

/**
 * Formats the identity string from a Gmail-bound token so all issues/reviews/comments
 * clearly show the Gmail user ID + AI Agent name.
 */
export function formatTokenActorIdentity(
  tokenRecord?: McpTokenPublic,
  fallbackAgentName?: string
): string {
  if (!tokenRecord) {
    return fallbackAgentName || "DevOps AI Agent";
  }
  const agentPart = fallbackAgentName || tokenRecord.name;
  return `${agentPart} [${tokenRecord.ownerEmail}]`;
}
