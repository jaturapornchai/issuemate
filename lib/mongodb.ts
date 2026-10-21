import { MongoClient, Db, Collection, Filter } from "mongodb";
import type { AttachmentItem, IssueRecord, ProjectRecord } from "./types";
import { deleteObjectsFromMinio } from "./minio";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27018/issuemate?directConnection=true";
const MONGODB_DB = process.env.MONGODB_DB || "issuemate";
const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ||
  process.env.ADMIN_EMAIL ||
  "admin@example.com"
)
  .trim()
  .toLowerCase();

interface GlobalMongo {
  clientPromise?: Promise<MongoClient>;
  seededVersion?: number;
}

const globalForMongo = globalThis as unknown as GlobalMongo;

export function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo.clientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      directConnection: true,
      serverSelectionTimeoutMS: 5000,
    });
    globalForMongo.clientPromise = client.connect();
  }
  return globalForMongo.clientPromise;
}

const CURRENT_SEED_VERSION = 6;

const DEFAULT_DEVOPS_PROJECTS: Omit<ProjectRecord, "createdAt" | "updatedAt">[] = [
  {
    key: "DEVOPS",
    name: "Cloud Infra, Caddy, Docker & CI/CD",
    description:
      "ดูแลเซิร์ฟเวอร์ Production, Reverse Proxy Caddy, SSL, Docker Containers และระบบ Deploy อัตโนมัติ",
    repoOrServer: "issue.dedezoom.com (/etc/caddy/Caddyfile, systemd)",
    color: "#f43f5e",
    icon: "Siren",
    nextIssueNumber: 1,
    labels: [
      { name: "SEV-1-Incident", color: "#ef4444" },
      { name: "Caddy-ReverseProxy", color: "#3b82f6" },
      { name: "Docker-Systemd", color: "#10b981" },
      { name: "SSL-Cloudflare", color: "#f59e0b" },
    ],
    milestones: [],
  },
  {
    key: "API",
    name: "Backend API, Auth & Microservices",
    description:
      "บริการ Backend API (Go / Next.js Route Handlers), ระบบ Authentication, Rate Limit, Connection Pool และ Webhook",
    repoOrServer: "api.dedezoom.com / 127.0.0.1:8888",
    color: "#10b981",
    icon: "Server",
    nextIssueNumber: 1,
    labels: [
      { name: "Go-API", color: "#10b981" },
      { name: "Memory-Leak", color: "#ef4444" },
      { name: "Auth-JWT", color: "#8b5cf6" },
    ],
    milestones: [],
  },
  {
    key: "FRONTEND",
    name: "Next.js Web UI & Playwright E2E",
    description:
      "หน้าจอเว็บแอปพลิเคชัน Next.js 16 Standalone, ความเร็ว Core Web Vitals, ตาราง Resizable 100% และชุดทดสอบ Playwright",
    repoOrServer: "issue.dedezoom.com / smldemo.dedezoom.com",
    color: "#3b82f6",
    icon: "Layout",
    nextIssueNumber: 1,
    labels: [
      { name: "NextJS-16", color: "#3b82f6" },
      { name: "Playwright-E2E", color: "#10b981" },
      { name: "UI-Baseline", color: "#a855f7" },
    ],
    milestones: [],
  },
  {
    key: "DB",
    name: "PostgreSQL, MongoDB, Redis & MinIO S3",
    description:
      "ฐานข้อมูลหลัก, การทำ Indexing, Query Optimization, การสำรองข้อมูล Snapshot รายวัน และ Object Storage MinIO",
    repoOrServer: "127.0.0.1:5432 / 127.0.0.1:27018 / 127.0.0.1:9100",
    color: "#f59e0b",
    icon: "Database",
    nextIssueNumber: 1,
    labels: [
      { name: "Slow-Query", color: "#ef4444" },
      { name: "MinIO-S3", color: "#06b6d4" },
      { name: "Backup-DR", color: "#10b981" },
    ],
    milestones: [],
  },
  {
    key: "AI",
    name: "AI MCP Pipeline (Antigravity Review, Fix & Deploy)",
    description:
      "ระบบเชื่อมต่อ Antigravity ผ่าน MCP Server: ดึงปัญหาไปวิเคราะห์สาเหตุ แก้ไขโค้ด และ Deploy อัตโนมัติ",
    repoOrServer: "https://issue.dedezoom.com/mcp",
    color: "#06b6d4",
    icon: "Sparkles",
    nextIssueNumber: 1,
    labels: [
      { name: "Antigravity-Review", color: "#06b6d4" },
      { name: "Antigravity-Deploy", color: "#10b981" },
      { name: "MCP-v3", color: "#10b981" },
    ],
    milestones: [],
  },
];

export async function ensureIndexesAndSeed(db: Db, forceReseed = false) {
  if (globalForMongo.seededVersion === CURRENT_SEED_VERSION && !forceReseed) return;

  const projectsCol = db.collection<ProjectRecord>("projects");
  const issuesCol = db.collection<IssueRecord>("issues");
  const metaCol = db.collection<{ _id: string; version: number; updatedAt: string }>("system_meta");
  const allowedUsersCol = db.collection("allowed_users");

  await projectsCol.createIndex({ key: 1 }, { unique: true });
  await issuesCol.createIndex({ code: 1 }, { unique: true });
  await issuesCol.createIndex({ projectKey: 1, status: 1, priority: 1 });
  await issuesCol.createIndex({ updatedAt: -1 });
  await allowedUsersCol.createIndex({ email: 1 }, { unique: true });

  // Keep AI and DEVOPS project descriptions sanitized without touching user projects
  await projectsCol.updateOne(
    { key: "AI" },
    {
      $set: {
        name: "AI MCP Pipeline (Antigravity Review, Fix & Deploy)",
        description:
          "ระบบเชื่อมต่อ Antigravity ผ่าน MCP Server: ดึงปัญหาไปวิเคราะห์สาเหตุ แก้ไขโค้ด และ Deploy อัตโนมัติ",
      },
    }
  );
  await projectsCol.updateOne(
    { key: "DEVOPS" },
    {
      $set: {
        description:
          "ดูแลเซิร์ฟเวอร์ Production, Reverse Proxy Caddy, SSL, Docker Containers และระบบ Deploy อัตโนมัติ",
        repoOrServer: "issue.dedezoom.com (/etc/caddy/Caddyfile, systemd)",
      },
    }
  );
  await projectsCol.updateOne(
    { key: "API" },
    {
      $set: {
        repoOrServer: "api.dedezoom.com / 127.0.0.1:8888",
      },
    }
  );

  const seedMeta = await metaCol.findOne({ _id: "seed_version" });
  if (seedMeta && seedMeta.version >= CURRENT_SEED_VERSION && !forceReseed) {
    globalForMongo.seededVersion = CURRENT_SEED_VERSION;
    return;
  }

  const now = new Date().toISOString();

  // 1. Clean out all old demo issues and demo attachments from MinIO
  const oldAttachmentKeys = await attachmentKeysOf(issuesCol, {});
  await issuesCol.deleteMany({});
  if (oldAttachmentKeys.length > 0) {
    await deleteObjectsFromMinio(oldAttachmentKeys).catch(() => {});
  }

  // 2. Clean out old demo tokens & demo users (keep only allowed users and Super Admin)
  await db.collection("mcp_tokens").deleteMany({
    ownerEmail: { $in: ["jead@dedezoom.com", "pakpoom@dedezoom.com", "claude@dedezoom.com"] },
  });
  await db.collection("users").deleteMany({
    email: { $in: ["jead@dedezoom.com", "pakpoom@dedezoom.com", "claude@dedezoom.com"] },
  });
  await allowedUsersCol.deleteMany({
    email: { $in: ["jead@dedezoom.com", "pakpoom@dedezoom.com", "claude@dedezoom.com"] },
  });

  // 3. Ensure Super Admin is registered in allowed_users
  await allowedUsersCol.updateOne(
    { email: SUPER_ADMIN_EMAIL },
    {
      $set: {
        email: SUPER_ADMIN_EMAIL,
        name: "Super Admin",
        role: "admin",
        jobTitle: "Super Admin & System Architect",
        addedBy: "system",
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // 4. Seed default projects only if no projects exist yet (never delete user-created projects like SMLAIACC)
  const existingProjectsCount = await projectsCol.countDocuments();
  if (existingProjectsCount === 0) {
    for (const proj of DEFAULT_DEVOPS_PROJECTS) {
      await projectsCol.updateOne(
        { key: proj.key },
        {
          $set: {
            ...proj,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
    }
  } else {
    // Only reset nextIssueNumber to 1 when clearing all issues
    await projectsCol.updateMany({}, { $set: { nextIssueNumber: 1, updatedAt: now } });
  }

  await metaCol.updateOne(
    { _id: "seed_version" },
    { $set: { version: CURRENT_SEED_VERSION, updatedAt: now } },
    { upsert: true }
  );

  globalForMongo.seededVersion = CURRENT_SEED_VERSION;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  const db = client.db(MONGODB_DB);
  await ensureIndexesAndSeed(db);
  return db;
}

export async function getCollections() {
  const db = await getDb();
  return {
    db,
    projects: db.collection<ProjectRecord>("projects"),
    issues: db.collection<IssueRecord>("issues"),
  };
}

export async function attachmentKeysOf(
  issuesCol: Collection<IssueRecord>,
  filter: Filter<IssueRecord>
): Promise<string[]> {
  const docs = await issuesCol
    .find(filter)
    .project<{ attachments?: AttachmentItem[]; comments?: IssueRecord["comments"] }>({
      attachments: 1,
      comments: 1,
    })
    .toArray();
  const keys = new Set<string>();
  for (const d of docs) {
    for (const a of d.attachments || []) {
      if (a.key) keys.add(a.key);
    }
    for (const c of d.comments || []) {
      for (const a of c.attachments || []) {
        if (a.key) keys.add(a.key);
      }
    }
  }
  return Array.from(keys);
}

export async function removeUnreferencedAttachments(
  issuesCol: Collection<IssueRecord>,
  candidateKeys: string[]
): Promise<void> {
  if (candidateKeys.length === 0) return;
  const stillUsed = await attachmentKeysOf(issuesCol, {});
  const stillUsedSet = new Set(stillUsed);
  const toDelete = candidateKeys.filter((k) => !stillUsedSet.has(k));
  if (toDelete.length > 0) {
    await deleteObjectsFromMinio(toDelete).catch(() => {});
  }
}
