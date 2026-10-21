import crypto from "crypto";
import { cookies } from "next/headers";
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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  isAdmin: boolean;
  allowedProjects: string[];
  provider: "google" | "devops";
}

export interface AllowedUserRecord {
  email: string;
  name: string;
  role: "admin" | "member";
  allowedProjects: string[];
  jobTitle: string;
  addedBy: string;
  createdAt: string;
  lastLoginAt?: string;
}

export function normalizeAllowedProjects(
  rawProjects?: string[] | null,
  isAdminRole?: boolean
): string[] {
  if (isAdminRole) return ["ALL"];
  if (!Array.isArray(rawProjects) || rawProjects.length === 0) return ["ALL"];
  const cleaned = Array.from(
    new Set(
      rawProjects
        .map((p) => String(p || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .filter(Boolean)
    )
  );
  if (cleaned.length === 0 || cleaned.includes("ALL")) return ["ALL"];
  return cleaned;
}

export function canUserAccessProject(
  user:
    | { role?: string; isAdmin?: boolean; allowedProjects?: string[] }
    | null
    | undefined,
  projectKey: string
): boolean {
  if (!user) return false;
  if (user.isAdmin || user.role === "admin") return true;
  const normalizedProj = (projectKey || "").trim().toUpperCase();
  if (!normalizedProj || normalizedProj === "ALL") return true;
  const projects = normalizeAllowedProjects(user.allowedProjects, false);
  return projects.includes("ALL") || projects.includes(normalizedProj);
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  allowedDomain?: string;
}

const SESSION_COOKIE_NAME = "issuemate_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "issuemate-default-session-key";

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
    .map((d) => ({
      ...d,
      allowedProjects: normalizeAllowedProjects(
        d.allowedProjects,
        d.role === "admin" || d.email === superAdmin
      ),
    }))
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
  return {
    ...doc,
    allowedProjects: normalizeAllowedProjects(
      doc.allowedProjects,
      doc.role === "admin" || doc.email === superAdmin
    ),
  };
}

export async function isEmailAllowed(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  const superAdmin = await getSuperAdminEmail();
  if (cleanEmail === superAdmin) return true;
  const found = await getAllowedUser(cleanEmail);
  return Boolean(found);
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
  const allowedProjects = normalizeAllowedProjects(
    input.allowedProjects,
    role === "admin"
  );
  const defaultName = isSuper
    ? "Super Admin"
    : cleanEmail.split("@")[0];
  const name = (input.name || "").trim() || defaultName;
  const jobTitle =
    (input.jobTitle || "").trim() ||
    (role === "admin" ? "Admin & DevOps Lead" : "DevOps Engineer");
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
        jobTitle,
        addedBy,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const saved = await col.findOne({ email: cleanEmail }, { projection: { _id: 0 } });
  return (
    saved || {
      email: cleanEmail,
      name,
      role,
      allowedProjects,
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
  const setFields: Record<string, string> = {
    lastLoginAt: new Date().toISOString(),
  };
  if (profileUpdate?.name) {
    setFields.name = profileUpdate.name;
  }
  await col.updateOne({ email: cleanEmail }, { $set: setFields });
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

export function signSessionToken(user: AuthUser): string {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string): AuthUser | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthUser;
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
    const [allowed, superAdmin] = await Promise.all([
      getAllowedUser(parsed.email),
      getSuperAdminEmail(),
    ]);
    if (!allowed) return null;
    const isAdmin = allowed.role === "admin" || allowed.email === superAdmin;
    return {
      ...parsed,
      email: allowed.email,
      name: parsed.name || allowed.name,
      role: allowed.jobTitle || parsed.role,
      isAdmin,
      allowedProjects: normalizeAllowedProjects(allowed.allowedProjects, isAdmin),
    };
  } catch {
    return null;
  }
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

export { SESSION_COOKIE_NAME };
