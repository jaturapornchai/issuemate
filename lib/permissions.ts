export type ProjectPermissionLevel =
  | "viewer"        // ดูอย่างเดียว (อ่านข้อมูล ดูรูป/PDF เท่านั้น)
  | "question_only" // สอบถามได้อย่างเดียว (ตั้งคำถาม type="question" + คอมเมนต์/แนบไฟล์)
  | "reporter"      // แจ้งปัญหา & สอบถามได้ทุกหัวข้อ (ผู้ใช้ทั่วไป)
  | "developer"     // ทีมแก้ไข & ตอบคำถาม (เปลี่ยนสถานะ, รีวิว, สร้าง MCP Token)
  | "project_admin";// ผู้ดูแลโปรเจกต์ (ทำได้ทุกอย่างในโปรเจกต์นี้ รวมถึงลบ Issue)

export const PROJECT_PERMISSION_CONFIG: Record<
  ProjectPermissionLevel,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
  }
> = {
  question_only: {
    label: "สอบถามได้อย่างเดียว (ตั้งคำถามเท่านั้น)",
    shortLabel: "❓ ถามได้อย่างเดียว",
    description: "ตั้งคำถาม (หัวข้อสอบถาม) แนบรูป/ไฟล์ และพูดคุยตอบกลับได้เท่านั้น",
    badgeClass: "border-cyan-500/45 bg-cyan-500/15 text-cyan-200",
  },
  reporter: {
    label: "แจ้งปัญหา & สอบถามได้ (ผู้ใช้ทั่วไป)",
    shortLabel: "📝 แจ้งปัญหา & ถามได้",
    description: "ตั้งคำถาม แจ้งปัญหาการใช้งาน ขอเพิ่มฟีเจอร์ และแนบรูป/PDF ได้",
    badgeClass: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  },
  viewer: {
    label: "ดูอย่างเดียว (อ่านข้อมูลเท่านั้น)",
    shortLabel: "👀 ดูอย่างเดียว",
    description: "เปิดดูรายการ อ่านคำตอบ ดูรูปภาพ และเปิดดูไฟล์ PDF ได้อย่างเดียว",
    badgeClass: "border-slate-600 bg-slate-800 text-slate-300",
  },
  developer: {
    label: "ทีมแก้ไข & ตอบคำถาม (เปลี่ยนสถานะได้)",
    shortLabel: "🔧 ทีมแก้ไข/ตอบคำถาม",
    description: "ตอบคำถาม แนบไฟล์ PDF/รูปภาพ เปลี่ยนสถานะงาน และใช้ MCP ได้",
    badgeClass: "border-amber-500/45 bg-amber-500/15 text-amber-200",
  },
  project_admin: {
    label: "ผู้ดูแลโปรเจกต์ (จัดการได้ทั้งหมด)",
    shortLabel: "👑 ผู้ดูแลโปรเจกต์",
    description: "จัดการได้ทุกอย่างในโปรเจกต์นี้ รวมถึงลบรายการ",
    badgeClass: "border-purple-500/45 bg-purple-500/15 text-purple-200",
  },
};

const VALID_PERM_LEVELS: ProjectPermissionLevel[] = [
  "viewer",
  "question_only",
  "reporter",
  "developer",
  "project_admin",
];

export function normalizePermissionLevel(
  raw?: string | null,
  fallback: ProjectPermissionLevel = "reporter"
): ProjectPermissionLevel {
  if (raw && VALID_PERM_LEVELS.includes(raw as ProjectPermissionLevel)) {
    return raw as ProjectPermissionLevel;
  }
  return fallback;
}

export function normalizeProjectPermissionsMap(
  rawMap?: Record<string, string> | null,
  allowedProjects?: string[],
  defaultPerm: ProjectPermissionLevel = "reporter",
  isAdminRole?: boolean
): Record<string, ProjectPermissionLevel> {
  if (isAdminRole) {
    return { ALL: "project_admin" };
  }
  const result: Record<string, ProjectPermissionLevel> = {};
  if (rawMap && typeof rawMap === "object") {
    for (const [k, v] of Object.entries(rawMap)) {
      const cleanKey = String(k || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 10);
      if (cleanKey) {
        result[cleanKey] = normalizePermissionLevel(v, defaultPerm);
      }
    }
  }
  const projs =
    allowedProjects !== undefined && allowedProjects !== null
      ? allowedProjects
      : ["ALL"];
  for (const pk of projs) {
    const cleanKey = String(pk || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10);
    if (cleanKey && !result[cleanKey]) {
      result[cleanKey] = defaultPerm;
    }
  }
  return result;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  googleName?: string;
  picture?: string;
  role: string;
  isAdmin: boolean;
  allowedProjects: string[];
  defaultPermission?: ProjectPermissionLevel;
  projectPermissions?: Record<string, ProjectPermissionLevel>;
  sessionVersion?: number;
  iat?: number;
  exp?: number;
  provider: "google" | "devops";
}

export interface AllowedUserRecord {
  email: string;
  name: string;
  googleName?: string;
  role: "admin" | "member";
  allowedProjects: string[];
  defaultPermission?: ProjectPermissionLevel;
  projectPermissions?: Record<string, ProjectPermissionLevel>;
  sessionVersion?: number;
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
  if (rawProjects === undefined || rawProjects === null) return ["ALL"];
  if (!Array.isArray(rawProjects)) return ["ALL"];
  if (rawProjects.length === 0) return [];
  const cleaned = Array.from(
    new Set(
      rawProjects
        .map((p) => String(p || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))
        .filter(Boolean)
    )
  );
  if (cleaned.length === 0) return [];
  if (cleaned.includes("ALL")) return ["ALL"];
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
  // isAdmin only: session role is the free-text jobTitle, so "admin" there must not grant access
  if (user.isAdmin) return true;
  const projects = normalizeAllowedProjects(user.allowedProjects, false);
  if (projects.length === 0) return false;
  const normalizedProj = (projectKey || "").trim().toUpperCase();
  if (!normalizedProj || normalizedProj === "ALL") return true;
  return projects.includes("ALL") || projects.includes(normalizedProj);
}

export function getUserProjectPermission(
  user:
    | {
        role?: string;
        isAdmin?: boolean;
        allowedProjects?: string[];
        defaultPermission?: ProjectPermissionLevel;
        projectPermissions?: Record<string, ProjectPermissionLevel>;
      }
    | null
    | undefined,
  projectKey?: string | null
): ProjectPermissionLevel | "none" {
  if (!user) return "none";
  if (user.isAdmin) return "project_admin";
  const normalizedProj = (projectKey || "ALL").trim().toUpperCase();
  if (!canUserAccessProject(user, normalizedProj)) {
    return "none";
  }
  const map = user.projectPermissions || {};
  if (normalizedProj !== "ALL" && map[normalizedProj]) {
    return normalizePermissionLevel(map[normalizedProj], user.defaultPermission || "reporter");
  }
  if (map.ALL) {
    return normalizePermissionLevel(map.ALL, user.defaultPermission || "reporter");
  }
  return normalizePermissionLevel(user.defaultPermission, "reporter");
}
