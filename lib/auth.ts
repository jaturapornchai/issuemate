import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "./mongodb";

export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ||
  process.env.ADMIN_EMAIL ||
  "admin@example.com"
)
  .trim()
  .toLowerCase();

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return "***@gmail.com";
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || local.length <= 2) {
    return `${local?.[0] || "*"}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export async function getSuperAdminEmail(): Promise<string> {
  try {
    const db = await getDb();
    const doc = await db
      .collection<{ _id: string; email?: string }>("system_meta")
      .findOne({ _id: "super_admin_config" });
    if (doc?.email && doc.email.includes("@")) {
      return doc.email.trim().toLowerCase();
    }
  } catch {
    // ignore and fallback to env
  }
  return SUPER_ADMIN_EMAIL;
}

export async function setSuperAdminEmail(
  newEmail: string,
  newName?: string
): Promise<string> {
  const cleanEmail = (newEmail || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("กรุณาระบุอีเมลผู้ดูแลระบบสูงสุด (Super Admin) ให้ถูกต้อง");
  }
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .collection<{ _id: string; email: string; updatedAt: string }>("system_meta")
    .updateOne(
      { _id: "super_admin_config" },
      {
        $set: {
          email: cleanEmail,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

  await addAllowedUser({
    email: cleanEmail,
    name: newName?.trim() || "Super Admin",
    role: "admin",
    jobTitle: "Super Admin & System Architect",
    addedBy: cleanEmail,
  });

  return cleanEmail;
}

import {
  type ProjectPermissionLevel,
  PROJECT_PERMISSION_CONFIG,
  normalizePermissionLevel,
  normalizeProjectPermissionsMap,
  type AuthUser,
  type AllowedUserRecord,
  normalizeAllowedProjects,
  canUserAccessProject,
  getUserProjectPermission,
} from "./permissions";

export {
  type ProjectPermissionLevel,
  PROJECT_PERMISSION_CONFIG,
  normalizePermissionLevel,
  normalizeProjectPermissionsMap,
  type AuthUser,
  type AllowedUserRecord,
  normalizeAllowedProjects,
  canUserAccessProject,
  getUserProjectPermission,
};

export function validateUserProjectAction(
  user:
    | {
        email?: string;
        role?: string;
        isAdmin?: boolean;
        allowedProjects?: string[];
        defaultPermission?: ProjectPermissionLevel;
        projectPermissions?: Record<string, ProjectPermissionLevel>;
      }
    | null
    | undefined,
  projectKey: string,
  action:
    | "view"
    | "create_issue"
    | "comment"
    | "change_status"
    | "delete_issue"
    | "generate_mcp_token",
  issueType?: string
): { allowed: boolean; permission: ProjectPermissionLevel | "none"; reason?: string } {
  if (!user) {
    return {
      allowed: false,
      permission: "none",
      reason: "กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งาน",
    };
  }
  const perm = getUserProjectPermission(user, projectKey);
  if (perm === "none") {
    return {
      allowed: false,
      permission: "none",
      reason: `บัญชี ${user.email || ""} ไม่ได้รับสิทธิ์ให้เข้าถึงโปรเจกต์ [${projectKey}]`,
    };
  }
  if (action === "view") {
    return { allowed: true, permission: perm };
  }
  if (action === "create_issue") {
    if (perm === "viewer") {
      return {
        allowed: false,
        permission: perm,
        reason: `บัญชีของคุณมีสิทธิ์ "ดูอย่างเดียว" ในโปรเจกต์ [${projectKey}] ไม่สามารถตั้งเรื่องใหม่ได้`,
      };
    }
    if (perm === "question_only" && issueType && issueType !== "question") {
      return {
        allowed: false,
        permission: perm,
        reason: `บัญชีของคุณได้รับสิทธิ์ "สอบถามได้อย่างเดียว" ในโปรเจกต์ [${projectKey}] กรุณาเลือกประเภทเรื่องเป็น "สอบถาม / ตั้งคำถาม" เท่านั้น`,
      };
    }
    return { allowed: true, permission: perm };
  }
  if (action === "comment") {
    if (perm === "viewer") {
      return {
        allowed: false,
        permission: perm,
        reason: `บัญชีของคุณมีสิทธิ์ "ดูอย่างเดียว" ในโปรเจกต์ [${projectKey}] ไม่สามารถส่งข้อความหรือแนบไฟล์ตอบกลับได้`,
      };
    }
    return { allowed: true, permission: perm };
  }
  if (action === "change_status") {
    if (perm === "viewer" || perm === "question_only" || perm === "reporter") {
      return {
        allowed: false,
        permission: perm,
        reason: `สิทธิ์ของคุณในโปรเจกต์ [${projectKey}] คือ "${PROJECT_PERMISSION_CONFIG[perm].shortLabel}" เฉพาะทีมแก้ไข (Developer) หรือผู้ดูแลเท่านั้นที่สามารถเปลี่ยนสถานะหรือสั่งแก้ไขได้`,
      };
    }
    return { allowed: true, permission: perm };
  }
  if (action === "generate_mcp_token") {
    if (perm === "viewer" || perm === "question_only" || perm === "reporter") {
      return {
        allowed: false,
        permission: perm,
        reason: `บัญชีของคุณมีสิทธิ์ "${PROJECT_PERMISSION_CONFIG[perm].shortLabel}" ในโปรเจกต์ [${projectKey}] ไม่สามารถสร้าง MCP Token สำหรับแก้ไขโค้ดได้`,
      };
    }
    return { allowed: true, permission: perm };
  }
  if (action === "delete_issue") {
    if (perm !== "project_admin") {
      return {
        allowed: false,
        permission: perm,
        reason: `เฉพาะผู้ดูแลโปรเจกต์หรือ Admin เท่านั้นที่สามารถลบรายการในโปรเจกต์ [${projectKey}] ได้`,
      };
    }
    return { allowed: true, permission: perm };
  }
  return { allowed: true, permission: perm };
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  allowedDomain?: string;
}

const SESSION_COOKIE_NAME = "issuemate_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const WEAK_SECRETS = new Set([
  "issuemate-dev-session-key",
  "replace-with-a-random-32-byte-secret",
  "changeme",
  "secret",
]);

function sessionSecret(): string {
  const secret = (process.env.SESSION_SECRET || "").trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32 || WEAK_SECRETS.has(secret)) {
      throw new Error(
        "ต้องตั้งค่า SESSION_SECRET ความยาวอย่างน้อย 32 ตัวอักษรและไม่ใช้ค่าตัวอย่างบนเซิร์ฟเวอร์ Production"
      );
    }
    return secret;
  }
  return secret || "issuemate-dev-session-key";
}

let allowedIndexReady = false;

async function getAllowedUsersCollection() {
  const db = await getDb();
  const col = db.collection<AllowedUserRecord>("allowed_users");
  if (!allowedIndexReady) {
    await col.createIndex({ email: 1 }, { unique: true });
    allowedIndexReady = true;
  }
  const superAdmin = await getSuperAdminEmail();
  const now = new Date().toISOString();
  await col.updateOne(
    { email: superAdmin },
    {
      $setOnInsert: {
        email: superAdmin,
        name: "Super Admin",
        role: "admin",
        jobTitle: "Super Admin & System Architect",
        addedBy: "system",
        createdAt: now,
      },
    },
    { upsert: true }
  );
  return col;
}

export async function listAllowedUsers(): Promise<AllowedUserRecord[]> {
  const [col, superAdmin] = await Promise.all([
    getAllowedUsersCollection(),
    getSuperAdminEmail(),
  ]);
  const docs = await col.find({}, { projection: { _id: 0 } }).toArray();
  return docs
    .map((d) => {
      const isAdminRole = d.role === "admin" || d.email === superAdmin;
      const allowedProjects = normalizeAllowedProjects(d.allowedProjects, isAdminRole);
      const defaultPermission: ProjectPermissionLevel = isAdminRole
        ? "project_admin"
        : normalizePermissionLevel(d.defaultPermission, "reporter");
      const projectPermissions = normalizeProjectPermissionsMap(
        d.projectPermissions as Record<string, string> | undefined,
        allowedProjects,
        defaultPermission,
        isAdminRole
      );
      return {
        ...d,
        allowedProjects,
        defaultPermission,
        projectPermissions,
      };
    })
    .sort((a, b) => {
      if (a.email === superAdmin) return -1;
      if (b.email === superAdmin) return 1;
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export async function getAllowedUser(email?: string | null): Promise<AllowedUserRecord | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const [col, superAdmin] = await Promise.all([
    getAllowedUsersCollection(),
    getSuperAdminEmail(),
  ]);
  const doc = await col.findOne({ email: cleanEmail }, { projection: { _id: 0 } });
  if (!doc) return null;
  const isAdminRole = doc.role === "admin" || doc.email === superAdmin;
  const allowedProjects = normalizeAllowedProjects(doc.allowedProjects, isAdminRole);
  const defaultPermission: ProjectPermissionLevel = isAdminRole
    ? "project_admin"
    : normalizePermissionLevel(doc.defaultPermission, "reporter");
  const projectPermissions = normalizeProjectPermissionsMap(
    doc.projectPermissions as Record<string, string> | undefined,
    allowedProjects,
    defaultPermission,
    isAdminRole
  );
  return {
    ...doc,
    allowedProjects,
    defaultPermission,
    projectPermissions,
  };
}

export async function isAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  const superAdmin = await getSuperAdminEmail();
  if (cleanEmail === superAdmin) return true;
  const found = await getAllowedUser(cleanEmail);
  return found?.role === "admin";
}

export async function addAllowedUser(input: {
  email: string;
  name?: string;
  role?: "admin" | "member";
  allowedProjects?: string[];
  defaultPermission?: ProjectPermissionLevel | string;
  projectPermissions?: Record<string, string>;
  jobTitle?: string;
  addedBy?: string;
}): Promise<AllowedUserRecord> {
  const cleanEmail = (input.email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("กรุณาระบุอีเมล Gmail ให้ถูกต้อง (เช่น user@gmail.com)");
  }

  const [col, superAdmin] = await Promise.all([
    getAllowedUsersCollection(),
    getSuperAdminEmail(),
  ]);
  const isSuper = cleanEmail === superAdmin;
  const role: "admin" | "member" = isSuper
    ? "admin"
    : input.role === "admin"
    ? "admin"
    : "member";
  const isAdminRole = role === "admin";
  const allowedProjects = normalizeAllowedProjects(
    input.allowedProjects,
    isAdminRole
  );
  const defaultPermission: ProjectPermissionLevel = isAdminRole
    ? "project_admin"
    : normalizePermissionLevel(input.defaultPermission as string | undefined, "reporter");
  const projectPermissions = normalizeProjectPermissionsMap(
    input.projectPermissions,
    allowedProjects,
    defaultPermission,
    isAdminRole
  );
  const defaultName = isSuper
    ? "Super Admin"
    : cleanEmail.split("@")[0];
  const name = (input.name || "").trim() || defaultName;
  const jobTitle =
    (input.jobTitle || "").trim() ||
    (role === "admin" ? "ผู้ดูแลระบบ" : PROJECT_PERMISSION_CONFIG[defaultPermission].label);
  const addedBy = (input.addedBy || superAdmin).trim().toLowerCase();
  const now = new Date().toISOString();

  await col.updateOne(
    { email: cleanEmail },
    {
      $set: {
        email: cleanEmail,
        name,
        role,
        allowedProjects,
        defaultPermission,
        projectPermissions,
        jobTitle,
        addedBy,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const saved = await getAllowedUser(cleanEmail);
  return (
    saved || {
      email: cleanEmail,
      name,
      role,
      allowedProjects,
      defaultPermission,
      projectPermissions,
      jobTitle,
      addedBy,
      createdAt: now,
    }
  );
}

export async function removeAllowedUser(email: string): Promise<boolean> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return false;
  const superAdmin = await getSuperAdminEmail();
  if (cleanEmail === superAdmin) {
    throw new Error("ไม่สามารถลบสิทธิ์ผู้ดูแลระบบสูงสุด (Super Admin) ได้");
  }
  const col = await getAllowedUsersCollection();
  const res = await col.deleteOne({ email: cleanEmail });
  // Also revoke any MCP tokens bound to this removed Gmail
  const db = await getDb();
  await db.collection("mcp_tokens").deleteMany({ ownerEmail: cleanEmail });
  return res.deletedCount > 0;
}

export async function touchAllowedUserLogin(
  email: string,
  profileUpdate?: { name?: string }
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const col = await getAllowedUsersCollection();
  const existing = await col.findOne({ email: cleanEmail });
  const setFields: Record<string, string> = {
    lastLoginAt: new Date().toISOString(),
  };
  if (profileUpdate?.name) {
    setFields.googleName = profileUpdate.name;
    if (!existing?.name) {
      setFields.name = profileUpdate.name;
    }
  }
  await col.updateOne({ email: cleanEmail }, { $set: setFields });
}

export async function bumpUserSessionVersion(email: string): Promise<void> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return;
  const col = await getAllowedUsersCollection();
  await col.updateOne({ email: cleanEmail }, { $inc: { sessionVersion: 1 } });
}

export function isEmailAllowedByDomain(
  email: string,
  allowedDomain?: string | null,
  superAdminEmail?: string | null
): boolean {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return false;
  if (superAdminEmail && cleanEmail === superAdminEmail.trim().toLowerCase()) {
    return true;
  }
  const rawDomain = (allowedDomain || "").trim();
  if (!rawDomain) return true;
  const domains = rawDomain
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) return true;
  const emailDomain = cleanEmail.split("@")[1] || "";
  return domains.includes(emailDomain) || domains.includes(cleanEmail);
}

export async function getGoogleOAuthConfig(): Promise<GoogleOAuthConfig> {
  try {
    const db = await getDb();
    const doc = await db
      .collection<{
        _id: string;
        clientId?: string;
        clientSecret?: string;
        allowedDomain?: string;
      }>("system_meta")
      .findOne({ _id: "google_oauth_config" });

    return {
      clientId: (doc?.clientId || process.env.GOOGLE_CLIENT_ID || "").trim(),
      clientSecret: (doc?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || "").trim(),
      allowedDomain: (doc?.allowedDomain || process.env.GOOGLE_ALLOWED_DOMAIN || "").trim(),
    };
  } catch {
    return {
      clientId: (process.env.GOOGLE_CLIENT_ID || "").trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
      allowedDomain: (process.env.GOOGLE_ALLOWED_DOMAIN || "").trim(),
    };
  }
}

export async function saveGoogleOAuthConfig(input: {
  clientId: string;
  clientSecret?: string;
  allowedDomain?: string;
}): Promise<{ configured: boolean; clientIdMasked: string }> {
  const db = await getDb();
  const existing = await getGoogleOAuthConfig();
  const clientId = input.clientId.trim();
  const clientSecret =
    input.clientSecret && input.clientSecret.trim()
      ? input.clientSecret.trim()
      : existing.clientSecret;
  const allowedDomain = (input.allowedDomain ?? existing.allowedDomain ?? "").trim();

  await db
    .collection<{
      _id: string;
      clientId: string;
      clientSecret: string;
      allowedDomain?: string;
      updatedAt: string;
    }>("system_meta")
    .updateOne(
      { _id: "google_oauth_config" },
      {
        $set: {
          clientId,
          clientSecret,
          allowedDomain,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

  return {
    configured: Boolean(clientId && clientSecret),
    clientIdMasked: clientId ? `${clientId.slice(0, 12)}...` : "",
  };
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function signSessionToken(user: AuthUser): string {
  const now = Date.now();
  const tokenPayload: AuthUser = {
    ...user,
    iat: typeof user.iat === "number" ? user.iat : now,
    exp: typeof user.exp === "number" ? user.exp : now + SESSION_TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(tokenPayload), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token?: string): AuthUser | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(signPayload(payload));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthUser;
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const parsed = verifySessionToken(raw);
    if (!parsed || !parsed.email) return null;
    return await getAuthUserByEmail(parsed.email, parsed);
  } catch {
    return null;
  }
}

/** Builds the effective user from allowed_users (the DB is the source of truth, never the caller). */
export async function getAuthUserByEmail(
  email: string,
  session?: Partial<AuthUser>
): Promise<AuthUser | null> {
  const [allowed, superAdmin, oauthCfg] = await Promise.all([
    getAllowedUser(email),
    getSuperAdminEmail(),
    getGoogleOAuthConfig(),
  ]);
  if (!allowed) return null;
  const dbSessionVersion = allowed.sessionVersion ?? 0;
  if (
    session &&
    dbSessionVersion > 0 &&
    (session.sessionVersion ?? 0) !== dbSessionVersion
  ) {
    return null;
  }
  if (!isEmailAllowedByDomain(allowed.email, oauthCfg.allowedDomain, superAdmin)) {
    return null;
  }
  const isAdmin = allowed.role === "admin" || allowed.email === superAdmin;
  const allowedProjects = normalizeAllowedProjects(allowed.allowedProjects, isAdmin);
  const defaultPermission = isAdmin
    ? "project_admin"
    : normalizePermissionLevel(allowed.defaultPermission, "reporter");
  const projectPermissions = normalizeProjectPermissionsMap(
    allowed.projectPermissions as Record<string, string> | undefined,
    allowedProjects,
    defaultPermission,
    isAdmin
  );
  return {
    id: session?.id || `user-${allowed.email}`,
    picture: session?.picture,
    provider: session?.provider || "google",
    email: allowed.email,
    name: allowed.name || session?.name || allowed.email.split("@")[0],
    googleName: allowed.googleName,
    role: allowed.jobTitle || session?.role || (isAdmin ? "Super Admin" : "DevOps Engineer"),
    isAdmin,
    allowedProjects,
    defaultPermission,
    projectPermissions,
    sessionVersion: dbSessionVersion,
    iat: session?.iat,
    exp: session?.exp,
  };
}

/**
 * Project filter for list/summary queries.
 * undefined = every project, string[] = only these keys, null = the requested project is not allowed.
 */
export function projectScopeFor(user: AuthUser, projectKey?: string | null): string[] | undefined | null {
  const key = (projectKey || "").trim().toUpperCase();
  if (key && key !== "ALL") return getUserProjectPermission(user, key) === "none" ? null : [key];
  if (user.isAdmin || user.allowedProjects?.includes("ALL")) return undefined;
  return user.allowedProjects || [];
}

export function authRequiredResponse() {
  return NextResponse.json(
    { error: "กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งาน" },
    { status: 401 }
  );
}

export function adminRequiredResponse() {
  return NextResponse.json(
    { error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ทำรายการนี้ได้" },
    { status: 403 }
  );
}

export function getPublicOrigin(req: Request): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (forwardedHost) {
    const proto =
      forwardedProto || (forwardedHost.includes("localhost") || forwardedHost.startsWith("127.") ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }
  return new URL(req.url).origin;
}

export function assertCsrfSafe(
  req: Request,
  options?: { allowMultipart?: boolean }
): NextResponse | null {
  const secFetchSite = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (secFetchSite === "cross-site") {
    return NextResponse.json(
      { error: "ปฏิเสธคำขอข้ามโดเมน (Cross-Site Request Blocked)" },
      { status: 403 }
    );
  }

  const originHeader = req.headers.get("origin");
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      const expectedHost = (
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        new URL(req.url).host
      )
        .split(",")[0]
        .trim()
        .toLowerCase();
      if (expectedHost && originUrl.host.toLowerCase() !== expectedHost) {
        return NextResponse.json(
          { error: "Origin ไม่ตรงกับเซิร์ฟเวอร์ (CSRF Protection)" },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Origin header ไม่ถูกต้อง" },
        { status: 403 }
      );
    }
  }

  const method = req.method.toUpperCase();
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    const isJson = contentType.includes("application/json");
    const isMultipart = Boolean(
      options?.allowMultipart && contentType.includes("multipart/form-data")
    );
    if (!isJson && !isMultipart) {
      return NextResponse.json(
        {
          error: options?.allowMultipart
            ? "Content-Type ต้องเป็น multipart/form-data หรือ application/json เท่านั้น"
            : "Content-Type ต้องเป็น application/json เท่านั้น",
        },
        { status: 415 }
      );
    }
  }

  return null;
}

export { SESSION_COOKIE_NAME };
