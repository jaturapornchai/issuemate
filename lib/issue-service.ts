import crypto from "crypto";
import { Filter } from "mongodb";
import { getCollections, attachmentKeysOf, removeUnreferencedAttachments } from "./mongodb";
import type {
  ProjectRecord,
  IssueRecord,
  IssueStatus,
  IssueStatusFilter,
  IssueType,
  IssuePriority,
  AttachmentItem,
  SubtaskItem,
  DevopsMetadata,
  ReviewAndFixMeta,
  CommentRecord,
  TimelineEvent,
  MonitorStats,
  AiFixApproval,
} from "./types";

export function normalizeProjectKey(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

export const VALID_ISSUE_STATUSES: IssueStatus[] = [
  "open",
  "reviewing",
  "ready_to_fix",
  "fixing",
  "deployed",
  "wont_fix",
];

export const VALID_ISSUE_TYPES: IssueType[] = [
  "question",
  "incident",
  "bug",
  "deployment",
  "performance",
  "security",
  "feature",
];

export const VALID_ISSUE_PRIORITIES: IssuePriority[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export function assertValidStatus(status: unknown): IssueStatus {
  const s = String(status || "") as IssueStatus;
  if (!VALID_ISSUE_STATUSES.includes(s)) {
    throw new Error(`สถานะไม่ถูกต้อง: ${String(status)}`);
  }
  return s;
}

export function assertValidType(type: unknown): IssueType {
  const t = String(type || "") as IssueType;
  if (!VALID_ISSUE_TYPES.includes(t)) {
    throw new Error(`ประเภทเรื่องไม่ถูกต้อง: ${String(type)}`);
  }
  return t;
}

export function assertValidPriority(priority: unknown): IssuePriority {
  const p = String(priority || "") as IssuePriority;
  if (!VALID_ISSUE_PRIORITIES.includes(p)) {
    throw new Error(`ระดับความสำคัญไม่ถูกต้อง: ${String(priority)}`);
  }
  return p;
}

function getBangkokDatePrefix(date = new Date()): string {
  return new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

const TERMINAL_STATUSES: IssueStatus[] = ["deployed", "wont_fix"];

export async function listProjects(): Promise<
  Array<ProjectRecord & { openCount: number; readyToFixCount: number; totalCount: number }>
> {
  const { projects, issues } = await getCollections();
  const [projectDocs, counts] = await Promise.all([
    projects.find({}).sort({ createdAt: 1 }).toArray(),
    issues
      .aggregate<{
        _id: string;
        totalCount: number;
        openCount: number;
        readyToFixCount: number;
      }>([
        {
          $group: {
            _id: "$projectKey",
            totalCount: { $sum: 1 },
            openCount: {
              $sum: {
                $cond: [{ $not: [{ $in: ["$status", TERMINAL_STATUSES] }] }, 1, 0],
              },
            },
            readyToFixCount: {
              $sum: {
                $cond: [{ $eq: ["$status", "ready_to_fix"] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray(),
  ]);

  const countMap = new Map(counts.map((c) => [c._id, c]));

  return projectDocs.map((p) => {
    const stat = countMap.get(p.key);
    return {
      ...p,
      _id: String(p._id),
      openCount: stat?.openCount ?? 0,
      readyToFixCount: stat?.readyToFixCount ?? 0,
      totalCount: stat?.totalCount ?? 0,
    };
  });
}

export async function createProject(input: {
  key: string;
  name: string;
  description?: string;
  repoOrServer?: string;
  color?: string;
  icon?: string;
}): Promise<ProjectRecord> {
  const { projects } = await getCollections();
  const key = normalizeProjectKey(input.key);
  if (!key || key.length < 2) {
    throw new Error("รหัสโปรเจกต์ (Project Key) ต้องเป็นภาษาอังกฤษหรือตัวเลข 2-10 ตัวอักษร เช่น DEVOPS, API, K8S");
  }
  if (key === "ALL") {
    throw new Error('ห้ามใช้รหัสโปรเจกต์ "ALL" เนื่องจากเป็นค่าสงวนของระบบ');
  }
  const name = input.name.trim();
  if (!name) {
    throw new Error("กรุณาระบุชื่อโปรเจกต์ DevOps / Engineering");
  }

  const existing = await projects.findOne({ key });
  if (existing) {
    throw new Error(`รหัสโปรเจกต์ "${key}" มีอยู่ในระบบแล้ว`);
  }

  const now = new Date().toISOString();
  const defaultLabels = [
    { name: "SEV-1-Incident", color: "#ef4444" },
    { name: "Antigravity-Reviewed", color: "#06b6d4" },
    { name: "Antigravity-Deploy", color: "#10b981" },
    { name: "Caddy-Docker", color: "#10b981" },
  ];

  const doc: ProjectRecord = {
    key,
    name,
    description: (input.description || "").trim(),
    repoOrServer: (input.repoOrServer || "").trim() || undefined,
    color: input.color || "#10b981",
    icon: input.icon || "Server",
    nextIssueNumber: 101,
    labels: defaultLabels,
    milestones: [],
    createdAt: now,
    updatedAt: now,
  };

  const res = await projects.insertOne(doc);
  return { ...doc, _id: String(res.insertedId) };
}

export async function getProjectByKey(key: string): Promise<ProjectRecord | null> {
  const { projects } = await getCollections();
  const doc = await projects.findOne({ key: normalizeProjectKey(key) });
  return doc ? { ...doc, _id: String(doc._id) } : null;
}

/** Turn a project's AI auto mode on/off (AI may fix reviewed issues without per-issue approval) */
export async function setProjectAiAutoApproval(
  key: string,
  enabled: boolean,
  actor: { name: string; email?: string }
): Promise<ProjectRecord> {
  const { projects } = await getCollections();
  const normalized = normalizeProjectKey(key);
  const now = new Date().toISOString();
  const res = await projects.findOneAndUpdate(
    { key: normalized },
    {
      $set: {
        aiAutoApproval: {
          enabled,
          changedBy: actor.name,
          changedByEmail: actor.email,
          changedAt: now,
        },
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );
  if (!res) throw new Error(`ไม่พบโปรเจกต์รหัส ${normalized}`);
  return { ...res, _id: String(res._id) };
}

/** Project keys whose AI auto mode is on (optionally limited to a scope) */
async function listAutoApproveProjectKeys(): Promise<string[]> {
  const { projects } = await getCollections();
  const docs = await projects
    .find({ "aiAutoApproval.enabled": true }, { projection: { key: 1 } })
    .toArray();
  return docs.map((d) => d.key);
}

export async function deleteProjectByKey(key: string): Promise<void> {
  const { db, projects, issues } = await getCollections();
  const normalized = normalizeProjectKey(key);
  if (!normalized || normalized === "ALL") return;
  const candidateKeys = await attachmentKeysOf(issues, { projectKey: normalized });
  await Promise.all([
    projects.deleteOne({ key: normalized }),
    issues.deleteMany({ projectKey: normalized }),
    db.collection("mcp_tokens").deleteMany({ projectKey: normalized }),
    db.collection<{ allowedProjects?: string[] }>("allowed_users").updateMany(
      {},
      {
        $pull: { allowedProjects: normalized },
        $unset: { [`projectPermissions.${normalized}`]: "" },
      }
    ),
  ]);
  if (candidateKeys.length > 0) {
    await removeUnreferencedAttachments(issues, candidateKeys);
  }
}

export interface ListIssuesFilter {
  /** string[] = only these projects (permission scope) */
  projectKey?: string | string[];
  status?: IssueStatusFilter;
  type?: IssueType | "all";
  priority?: IssuePriority | "all";
  assignee?: string;
  label?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  /** "awaiting" = รอแก้ไข/กำลังแก้ไขและยังไม่มีการตัดสินจากผู้ดูแล, "approved" = อนุมัติให้ AI แก้แล้ว */
  aiApproval?: "all" | "awaiting" | "approved";
}

const ENUM_SORT_ORDER: Record<string, string[]> = {
  priority: ["low", "medium", "high", "critical"],
  status: ["wont_fix", "deployed", "fixing", "ready_to_fix", "reviewing", "open"],
};

export async function listIssues(filter: ListIssuesFilter = {}): Promise<IssueRecord[]> {
  const { issues } = await getCollections();
  const query: Filter<IssueRecord> = {};

  if (Array.isArray(filter.projectKey)) {
    query.projectKey = { $in: filter.projectKey };
  } else if (filter.projectKey && filter.projectKey !== "ALL") {
    query.projectKey = filter.projectKey.toUpperCase();
  }

  if (filter.status && filter.status !== "all") {
    if (filter.status === "pending_review") {
      query.status = { $in: ["open", "reviewing"] };
    } else if (filter.status === "active") {
      query.status = { $nin: TERMINAL_STATUSES };
    } else if (filter.status === "overdue") {
      query.status = { $nin: TERMINAL_STATUSES };
      query.dueDate = { $gt: "", $lt: getBangkokDatePrefix() };
    } else {
      query.status = filter.status;
    }
  }

  if (filter.type && filter.type !== "all") {
    query.type = filter.type;
  }

  if (filter.priority && filter.priority !== "all") {
    query.priority = filter.priority;
  }

  if (filter.assignee && filter.assignee !== "all") {
    query.assignee = filter.assignee;
  }

  if (filter.label && filter.label !== "all") {
    query.labels = filter.label;
  }

  if (filter.search && filter.search.trim()) {
    const escaped = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    query.$or = [
      { code: regex },
      { title: regex },
      { description: regex },
      { reporter: regex },
      { department: regex },
      { assignee: regex },
      { "devopsMeta.serviceName": regex },
      { "devopsMeta.targetServerOrDomain": regex },
      { "reviewMeta.reviewReason": regex },
      { "reviewMeta.fixInstructions": regex },
    ];
  }

  if (filter.aiApproval === "approved") {
    query["aiFixApproval.status"] = "approved";
  } else if (filter.aiApproval === "awaiting") {
    const autoKeys = await listAutoApproveProjectKeys();
    const awaiting: Filter<IssueRecord>[] = [
      { status: { $in: ["ready_to_fix", "fixing"] } },
      { type: { $ne: "question" } },
      { "aiFixApproval.status": { $nin: ["approved", "rejected"] } },
    ];
    if (autoKeys.length > 0) awaiting.push({ projectKey: { $nin: autoKeys } });
    query.$and = [...(query.$and || []), ...awaiting];
  }

  const sortField = filter.sortBy || "createdAt";
  const sortOrder = filter.sortDir === "asc" ? 1 : -1;
  const sortObj: Record<string, 1 | -1> =
    sortField === "code"
      ? { projectKey: sortOrder, number: sortOrder, createdAt: -1 }
      : sortField === "createdAt"
      ? { createdAt: sortOrder, number: sortOrder }
      : { [sortField]: sortOrder, createdAt: -1, number: -1 };

  const limit = Math.min(filter.limit || 200, 500);
  const rankOrder = ENUM_SORT_ORDER[sortField];
  const docs = rankOrder
    ? await issues
        .aggregate<IssueRecord>([
          { $match: query },
          { $addFields: { _sortRank: { $indexOfArray: [rankOrder, "$" + sortField] } } },
          { $sort: { _sortRank: sortOrder, createdAt: -1, number: -1 } },
          { $limit: limit },
          { $project: { _sortRank: 0 } },
        ])
        .toArray()
    : await issues.find(query).sort(sortObj).limit(limit).toArray();

  return docs.map((d) => ({ ...d, _id: String(d._id) }));
}

export async function findSimilarIssues(
  queryText: string,
  projectKey?: string | string[]
): Promise<Array<Pick<IssueRecord, "code" | "title" | "status" | "type" | "priority" | "upvotes">>> {
  const cleaned = (queryText || "").trim();
  if (cleaned.length < 2) return [];

  const { issues } = await getCollections();
  const tokens = cleaned
    .split(/[\s,./\-_]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 5);

  if (tokens.length === 0) return [];

  const regexPattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(regexPattern, "i");

  const filter: Filter<IssueRecord> = {
    $or: [{ title: regex }, { description: regex }, { code: regex }],
  };
  if (Array.isArray(projectKey)) {
    filter.projectKey = { $in: projectKey };
  } else if (projectKey && projectKey !== "ALL") {
    filter.projectKey = projectKey.toUpperCase();
  }

  const matches = await issues
    .find(filter)
    .project<Pick<IssueRecord, "code" | "title" | "status" | "type" | "priority" | "upvotes">>({
      code: 1,
      title: 1,
      status: 1,
      type: 1,
      priority: 1,
      upvotes: 1,
    })
    .limit(5)
    .toArray();

  return matches.map((m) => ({
    code: m.code,
    title: m.title,
    status: m.status,
    type: m.type,
    priority: m.priority,
    upvotes: m.upvotes || 0,
  }));
}

export async function getIssueByCode(code: string): Promise<IssueRecord | null> {
  const { issues } = await getCollections();
  const normalized = code.trim().replace(/^#/, "").toUpperCase();
  const doc = await issues.findOne({ code: normalized });
  if (!doc) return null;
  return { ...doc, _id: String(doc._id) };
}

export async function createIssue(input: {
  projectKey: string;
  title: string;
  description?: string;
  status?: IssueStatus;
  type?: IssueType;
  priority?: IssuePriority;
  reporter?: string;
  reporterEmail?: string;
  department?: string;
  assignee?: string;
  labels?: string[];
  milestone?: string;
  dueDate?: string;
  attachments?: AttachmentItem[];
  subtasks?: SubtaskItem[] | string[];
  relatedCodes?: string[];
  devopsMeta?: DevopsMetadata;
  reviewMeta?: ReviewAndFixMeta;
  aiSummary?: string;
}): Promise<IssueRecord> {
  const { projects, issues } = await getCollections();
  const projectKey = normalizeProjectKey(input.projectKey);
  const title = (input.title || "").trim();
  if (!projectKey) throw new Error("กรุณาเลือกโปรเจกต์ DevOps");
  if (!title) throw new Error("กรุณาระบุหัวข้อปัญหาหรือเหตุการณ์");

  const initialStatus: IssueStatus = input.status ? assertValidStatus(input.status) : "open";
  const issueType: IssueType = input.type ? assertValidType(input.type) : "bug";
  const issuePriority: IssuePriority = input.priority ? assertValidPriority(input.priority) : "high";

  const projectUpdate = await projects.findOneAndUpdate(
    { key: projectKey },
    {
      $inc: { nextIssueNumber: 1 },
      $set: { updatedAt: new Date().toISOString() },
    },
    { returnDocument: "before" }
  );

  if (!projectUpdate) {
    throw new Error(`ไม่พบโปรเจกต์รหัส "${projectKey}"`);
  }

  const issueNumber = projectUpdate.nextIssueNumber || 101;
  const code = `${projectKey}-${issueNumber}`;
  const now = new Date().toISOString();
  const reporter = (input.reporter || "DevOps Engineer").trim();
  const voterIdentity = (input.reporterEmail || reporter).trim();

  const normalizedSubtasks: SubtaskItem[] = Array.isArray(input.subtasks)
    ? input.subtasks.map((st, idx) =>
        typeof st === "string"
          ? { id: `st-${Date.now()}-${idx}`, title: st.trim(), completed: false }
          : st
      )
    : [];

  const timelineEvent: TimelineEvent = {
    id: crypto.randomUUID(),
    actor: reporter,
    action: "created",
    detail: `แจ้งปัญหา DevOps #${code} (สถานะ: ${initialStatus})`,
    createdAt: now,
  };

  const doc: IssueRecord = {
    projectKey,
    number: issueNumber,
    code,
    title,
    description: (input.description || "").trim(),
    status: initialStatus,
    type: issueType,
    priority: issuePriority,
    reporter,
    department: (input.department || "DevOps & SRE Team").trim(),
    assignee: (input.assignee || "Antigravity").trim() || undefined,
    labels: Array.isArray(input.labels) ? input.labels : [],
    milestone: input.milestone || undefined,
    dueDate: input.dueDate || undefined,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    subtasks: normalizedSubtasks,
    reactions: { "👍": [reporter] },
    relatedCodes: Array.isArray(input.relatedCodes) ? input.relatedCodes : [],
    devopsMeta: input.devopsMeta || {
      environment: "Production",
      incidentSeverity: issuePriority === "critical" ? "SEV-1" : "SEV-2",
    },
    reviewMeta: input.reviewMeta || {
      decision: initialStatus === "ready_to_fix" ? "fix" : initialStatus === "wont_fix" ? "wont_fix" : "pending",
    },
    comments: [],
    timeline: [timelineEvent],
    upvotes: 1,
    upvotedBy: [voterIdentity],
    aiSummary:
      input.aiSummary ||
      `รอ Antigravity ดึง #${code} ไปวิเคราะห์สาเหตุ แก้ไขโค้ด และ Deploy`,
    createdAt: now,
    updatedAt: now,
  };

  const res = await issues.insertOne(doc);
  return { ...doc, _id: String(res.insertedId) };
}

function toggleEmojiMap(
  current: Record<string, string[]> | undefined,
  emoji: string,
  user: string
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...(current || {}) };
  const list = new Set(next[emoji] || []);
  if (list.has(user)) {
    list.delete(user);
  } else {
    list.add(user);
  }
  if (list.size === 0) {
    delete next[emoji];
  } else {
    next[emoji] = Array.from(list);
  }
  return next;
}

const STATUS_NAME_MAP: Record<IssueStatus, string> = {
  open: "1. รอรีวิว (Pending Antigravity)",
  reviewing: "2. กำลังรีวิว (Antigravity Reviewing)",
  ready_to_fix: "3. รอแก้ (Ready for Antigravity)",
  fixing: "4. กำลังแก้/Deploy (Antigravity Fixing)",
  deployed: "5. Deploy แล้ว (Deployed & Verified)",
  wont_fix: "6. ไม่แก้ (Won't Fix / Rejected)",
};

export async function updateIssue(
  code: string,
  patch: {
    title?: string;
    description?: string;
    status?: IssueStatus;
    expectedStatus?: IssueStatus;
    type?: IssueType;
    priority?: IssuePriority;
    assignee?: string;
    department?: string;
    labels?: string[];
    milestone?: string;
    dueDate?: string;
    attachments?: AttachmentItem[];
    addAttachments?: AttachmentItem[];
    subtasks?: SubtaskItem[];
    relatedCodes?: string[];
    devopsMeta?: DevopsMetadata;
    reviewMeta?: ReviewAndFixMeta;
    toggleReaction?: { emoji: string; user: string };
    toggleCommentReaction?: { commentId: string; emoji: string; user: string };
    aiSummary?: string;
    actor?: string;
    toggleUpvoteBy?: string;
    /** null = reset to pending. Callers must check approve permission; never set from MCP input. */
    aiFixApproval?: AiFixApproval | null;
  }
): Promise<IssueRecord> {
  const { issues } = await getCollections();
  const normalized = code.trim().replace(/^#/, "").toUpperCase();
  const existing = await issues.findOne({ code: normalized });
  if (!existing) {
    throw new Error(`ไม่พบ Issue รหัส ${normalized}`);
  }
  if (patch.expectedStatus && existing.status !== patch.expectedStatus) {
    throw new Error(
      `สถานะปัจจุบันของ #${normalized} คือ "${existing.status}" (ต้องการ "${patch.expectedStatus}") กรุณาดึงข้อมูลล่าสุดก่อนดำเนินการ`
    );
  }

  const now = new Date().toISOString();
  const actor = (patch.actor || "DevOps Team").trim();
  const pushedTimeline: TimelineEvent[] = [];
  const unsetFields: Record<string, ""> = {};
  let removedAttachmentKeys: string[] = [];

  const updateFields: Partial<IssueRecord> = {
    updatedAt: now,
  };

  if (patch.title !== undefined) {
    const cleanTitle = patch.title.trim();
    if (!cleanTitle) {
      throw new Error("กรุณาระบุหัวข้อปัญหาหรือเหตุการณ์ (ห้ามเว้นว่าง)");
    }
    if (cleanTitle !== existing.title) {
      updateFields.title = cleanTitle;
      pushedTimeline.push({
        id: crypto.randomUUID(),
        actor,
        action: "edited",
        detail: `แก้ไขหัวข้อเป็น "${updateFields.title}"`,
        createdAt: now,
      });
    }
  }

  if (patch.description !== undefined) {
    updateFields.description = patch.description;
  }

  if (patch.type !== undefined) {
    const validType = assertValidType(patch.type);
    if (validType !== existing.type) {
      updateFields.type = validType;
    }
  }

  if (patch.priority !== undefined) {
    const validPriority = assertValidPriority(patch.priority);
    if (validPriority !== existing.priority) {
      updateFields.priority = validPriority;
      pushedTimeline.push({
        id: crypto.randomUUID(),
        actor,
        action: "priority_changed",
        detail: `ปรับระดับความสำคัญเป็น ${validPriority.toUpperCase()}`,
        createdAt: now,
      });
    }
  }

  if (patch.assignee !== undefined && patch.assignee !== existing.assignee) {
    updateFields.assignee = patch.assignee.trim() || undefined;
    pushedTimeline.push({
      id: crypto.randomUUID(),
      actor,
      action: "assigned",
      detail: updateFields.assignee
        ? `มอบหมายงานให้ ${updateFields.assignee}`
        : "ยกเลิกผู้รับผิดชอบ",
      createdAt: now,
    });
  }

  if (patch.department !== undefined) {
    updateFields.department = patch.department.trim();
  }

  if (patch.labels !== undefined) {
    updateFields.labels = patch.labels;
  }

  if (patch.milestone !== undefined) {
    updateFields.milestone = patch.milestone || undefined;
  }

  if (patch.dueDate !== undefined) {
    updateFields.dueDate = patch.dueDate || undefined;
  }

  if (patch.devopsMeta !== undefined) {
    const cleanDevopsMeta = Object.fromEntries(
      Object.entries(patch.devopsMeta).filter(([, v]) => v !== undefined)
    ) as DevopsMetadata;
    updateFields.devopsMeta = { ...(existing.devopsMeta || {}), ...cleanDevopsMeta };
  }

  if (patch.reviewMeta !== undefined) {
    const cleanReviewPatch = Object.fromEntries(
      Object.entries(patch.reviewMeta).filter(([, v]) => v !== undefined)
    ) as ReviewAndFixMeta;
    const mergedReview: ReviewAndFixMeta = {
      ...(existing.reviewMeta || {}),
      ...cleanReviewPatch,
    };
    updateFields.reviewMeta = mergedReview;

    if (patch.reviewMeta.decision === "fix") {
      pushedTimeline.push({
        id: crypto.randomUUID(),
        actor: patch.reviewMeta.reviewedBy || actor,
        action: "reviewed_fix",
        detail: `รีวิวแล้ว: สั่งแก้ (รอแก้) — ${patch.reviewMeta.reviewReason || "พร้อมคำสั่งแก้สำหรับ Antigravity"}`,
        createdAt: now,
      });
    } else if (patch.reviewMeta.decision === "wont_fix") {
      pushedTimeline.push({
        id: crypto.randomUUID(),
        actor: patch.reviewMeta.reviewedBy || actor,
        action: "reviewed_wont_fix",
        detail: `รีวิวแล้ว: ไม่แก้ (Won't Fix) — เหตุผล: ${patch.reviewMeta.reviewReason || "-"}`,
        createdAt: now,
      });
    }
  }

  if (patch.subtasks !== undefined) {
    updateFields.subtasks = patch.subtasks;
    const done = patch.subtasks.filter((s) => s.completed).length;
    pushedTimeline.push({
      id: crypto.randomUUID(),
      actor,
      action: "subtasks_updated",
      detail: `อัปเดตรายการงานย่อย (Checklist สำเร็จ ${done}/${patch.subtasks.length})`,
      createdAt: now,
    });
  }

  if (patch.relatedCodes !== undefined) {
    updateFields.relatedCodes = Array.from(
      new Set(patch.relatedCodes.map((c) => c.trim().replace(/^#/, "").toUpperCase()).filter(Boolean))
    );
  }

  if (patch.toggleReaction) {
    updateFields.reactions = toggleEmojiMap(
      existing.reactions,
      patch.toggleReaction.emoji,
      patch.toggleReaction.user || actor
    );
  }

  if (patch.toggleCommentReaction) {
    const { commentId, emoji, user } = patch.toggleCommentReaction;
    updateFields.comments = (existing.comments || []).map((c) =>
      c.id === commentId
        ? { ...c, reactions: toggleEmojiMap(c.reactions, emoji, user || actor) }
        : c
    );
  }

  if (patch.aiSummary !== undefined) {
    updateFields.aiSummary = patch.aiSummary;
  }

  if (patch.attachments !== undefined) {
    const nextKeys = new Set(patch.attachments.map((a) => a.key).filter(Boolean));
    removedAttachmentKeys = (existing.attachments || [])
      .map((a) => a.key)
      .filter((k): k is string => Boolean(k && !nextKeys.has(k)));
    updateFields.attachments = patch.attachments;
  } else if (patch.addAttachments && patch.addAttachments.length > 0) {
    pushedTimeline.push({
      id: crypto.randomUUID(),
      actor,
      action: "attached",
      detail: `แนบไฟล์เพิ่มเติม ${patch.addAttachments.length} ไฟล์`,
      createdAt: now,
    });
  }

  if (patch.toggleUpvoteBy) {
    const voter = patch.toggleUpvoteBy.trim();
    const currentVoters = new Set(existing.upvotedBy || []);
    const removing = currentVoters.has(voter);
    if (removing) currentVoters.delete(voter);
    else currentVoters.add(voter);
    updateFields.upvotedBy = Array.from(currentVoters);
    updateFields.upvotes = Math.max(0, currentVoters.size);
  }

  if (patch.aiFixApproval !== undefined) {
    const nextApproval = patch.aiFixApproval;
    if (!nextApproval || nextApproval.status === "pending") {
      if (existing.aiFixApproval) {
        unsetFields.aiFixApproval = "";
        pushedTimeline.push({
          id: crypto.randomUUID(),
          actor,
          action: "ai_fix_approval_reset",
          detail: "ยกเลิกการอนุมัติ — กลับไปรอผู้ดูแลอนุมัติให้ AI แก้ไข",
          createdAt: now,
        });
      }
    } else {
      updateFields.aiFixApproval = nextApproval;
      const note = nextApproval.note ? ` (หมายเหตุ: ${nextApproval.note})` : "";
      pushedTimeline.push({
        id: crypto.randomUUID(),
        actor: nextApproval.decidedBy || actor,
        action: nextApproval.status === "approved" ? "ai_fix_approved" : "ai_fix_rejected",
        detail:
          nextApproval.status === "approved"
            ? nextApproval.auto
              ? "อนุมัติให้ AI แก้ไขโดยโหมดอัตโนมัติของโปรเจกต์"
              : `อนุมัติให้ AI แก้ไขอัตโนมัติ${note}`
            : `ไม่อนุมัติให้ AI แก้ไข${note}`,
        createdAt: now,
      });
    }
  }

  if (patch.status !== undefined) {
    const validStatus = assertValidStatus(patch.status);
    if (validStatus !== existing.status) {
      updateFields.status = validStatus;
      if (validStatus === "deployed" || validStatus === "wont_fix") {
        updateFields.closedAt = now;
        updateFields.closedBy = actor;
      } else if (existing.status === "deployed" || existing.status === "wont_fix") {
        unsetFields.closedAt = "";
        unsetFields.closedBy = "";
        // A reopened issue is a new round: the earlier AI approval no longer applies
        if (existing.aiFixApproval && patch.aiFixApproval === undefined) {
          unsetFields.aiFixApproval = "";
          pushedTimeline.push({
            id: crypto.randomUUID(),
            actor,
            action: "ai_fix_approval_reset",
            detail: "เปิดเรื่องใหม่ — ต้องขออนุมัติให้ AI แก้ไขอีกครั้ง",
            createdAt: now,
          });
        }
      }

      pushedTimeline.push({
        id: crypto.randomUUID(),
        actor,
        action: validStatus === "deployed" ? "deployed" : "status_changed",
        detail: `เปลี่ยนสถานะเป็น ${STATUS_NAME_MAP[validStatus] || validStatus}`,
        createdAt: now,
      });
    }
  }

  const filterQuery: Filter<IssueRecord> = { code: normalized };
  if (patch.expectedStatus) {
    filterQuery.status = patch.expectedStatus;
  }

  const updateDoc: Record<string, unknown> = { $set: updateFields };
  if (Object.keys(unsetFields).length > 0) {
    updateDoc.$unset = unsetFields;
  }
  const pushOps: Record<string, unknown> = {};
  if (pushedTimeline.length > 0) {
    pushOps.timeline = { $each: pushedTimeline };
  }
  if (patch.attachments === undefined && patch.addAttachments && patch.addAttachments.length > 0) {
    pushOps.attachments = { $each: patch.addAttachments };
  }
  if (Object.keys(pushOps).length > 0) {
    updateDoc.$push = pushOps;
  }

  const updateRes = await issues.updateOne(filterQuery, updateDoc);
  if (patch.expectedStatus && updateRes.matchedCount === 0) {
    throw new Error(
      `สถานะของ #${normalized} ถูกเปลี่ยนไปก่อนหน้านี้แล้ว (ต้องการ "${patch.expectedStatus}")`
    );
  }
  if (removedAttachmentKeys.length > 0) {
    await removeUnreferencedAttachments(issues, removedAttachmentKeys);
  }
  const updated = await issues.findOne({ code: normalized });
  if (!updated) throw new Error("Update failed");
  return { ...updated, _id: String(updated._id) };
}

export async function addIssueComment(
  code: string,
  input: {
    author: string;
    role?: string;
    body: string;
    attachments?: AttachmentItem[];
    isResolution?: boolean;
    nextStatus?: IssueStatus;
  }
): Promise<IssueRecord> {
  const { issues } = await getCollections();
  const normalized = code.trim().replace(/^#/, "").toUpperCase();
  const existing = await issues.findOne({ code: normalized });
  if (!existing) {
    throw new Error(`ไม่พบ Issue รหัส ${normalized}`);
  }

  const author = (input.author || "DevOps Team").trim();
  const body = (input.body || "").trim();
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const validNextStatus = input.nextStatus ? assertValidStatus(input.nextStatus) : undefined;

  if (!body && attachments.length === 0 && !validNextStatus) {
    throw new Error("กรุณาพิมพ์ข้อความความคิดเห็นหรือแนบไฟล์");
  }

  const now = new Date().toISOString();
  const pushedComments: CommentRecord[] = [];
  const pushedTimeline: TimelineEvent[] = [];
  const unsetFields: Record<string, ""> = {};

  if (body || attachments.length > 0) {
    const comment: CommentRecord = {
      id: crypto.randomUUID(),
      author,
      role: input.role || "DevOps Engineer",
      body: body || "(แนบไฟล์ประกอบ)",
      attachments,
      reactions: {},
      isResolution: Boolean(input.isResolution || validNextStatus === "deployed"),
      createdAt: now,
    };
    pushedComments.push(comment);
    pushedTimeline.push({
      id: crypto.randomUUID(),
      actor: author,
      action: "commented",
      detail: body.slice(0, 90) + (body.length > 90 ? "..." : ""),
      createdAt: now,
    });
  }

  const updateFields: Partial<IssueRecord> = {
    updatedAt: now,
  };

  if (validNextStatus && validNextStatus !== existing.status) {
    updateFields.status = validNextStatus;
    if (validNextStatus === "deployed" || validNextStatus === "wont_fix") {
      updateFields.closedAt = now;
      updateFields.closedBy = author;
    } else if (existing.status === "deployed" || existing.status === "wont_fix") {
      unsetFields.closedAt = "";
      unsetFields.closedBy = "";
    }
    pushedTimeline.push({
      id: crypto.randomUUID(),
      actor: author,
      action: "status_changed",
      detail: `เปลี่ยนสถานะเป็น ${STATUS_NAME_MAP[validNextStatus]}`,
      createdAt: now,
    });
  }

  const updateDoc: Record<string, unknown> = { $set: updateFields };
  if (Object.keys(unsetFields).length > 0) {
    updateDoc.$unset = unsetFields;
  }
  const pushOps: Record<string, unknown> = {};
  if (pushedComments.length > 0) {
    pushOps.comments = { $each: pushedComments };
  }
  if (pushedTimeline.length > 0) {
    pushOps.timeline = { $each: pushedTimeline };
  }
  if (Object.keys(pushOps).length > 0) {
    updateDoc.$push = pushOps;
  }

  await issues.updateOne({ code: normalized }, updateDoc);
  const updated = await issues.findOne({ code: normalized });
  if (!updated) throw new Error("Failed to add comment");
  return { ...updated, _id: String(updated._id) };
}

export async function getMonitorStats(projectKey?: string | string[]): Promise<MonitorStats> {
  const { projects, issues } = await getCollections();
  const query: Filter<IssueRecord> = {};
  if (Array.isArray(projectKey)) {
    query.projectKey = { $in: projectKey };
  } else if (projectKey && projectKey !== "ALL") {
    query.projectKey = projectKey.toUpperCase();
  }

  const [allProjects, allIssues] = await Promise.all([
    projects.find(Array.isArray(projectKey) ? { key: { $in: projectKey } } : {}).sort({ createdAt: 1 }).toArray(),
    issues.find(query).sort({ updatedAt: -1 }).toArray(),
  ]);

  const now = new Date();
  const todayPrefix = getBangkokDatePrefix(now);

  let openIssues = 0;
  let reviewingIssues = 0;
  let readyToFixIssues = 0;
  let fixingIssues = 0;
  let deployedIssues = 0;
  let wontFixIssues = 0;
  let criticalOpenCount = 0;
  let overdueCount = 0;
  let resolvedTodayCount = 0;
  let totalResolutionMs = 0;
  let resolvedWithDurationCount = 0;
  let subtasksTotal = 0;
  let subtasksCompleted = 0;
  let activeIncidentsCount = 0;
  let awaitingAiApprovalCount = 0;
  let awaitingAiApprovalFixingCount = 0;
  let aiApprovedActiveCount = 0;
  const autoApproveKeys = new Set(
    allProjects.filter((p) => p.aiAutoApproval?.enabled).map((p) => p.key)
  );

  const byType: Record<IssueType, number> = {
    question: 0,
    incident: 0,
    bug: 0,
    deployment: 0,
    performance: 0,
    security: 0,
    feature: 0,
  };

  const byPriority: Record<IssuePriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const assigneeMap = new Map<
    string,
    { assignee: string; pendingReview: number; readyOrFixing: number; completed: number; total: number }
  >();

  const projectStatMap = new Map<
    string,
    {
      key: string;
      name: string;
      color: string;
      open: number;
      reviewing: number;
      readyToFix: number;
      fixing: number;
      deployed: number;
      wontFix: number;
      critical: number;
      total: number;
    }
  >();

  for (const p of allProjects) {
    // Array scopes are already filtered by the projects query above
    if (typeof projectKey === "string" && projectKey !== "ALL" && p.key !== projectKey.toUpperCase()) continue;
    projectStatMap.set(p.key, {
      key: p.key,
      name: p.name,
      color: p.color,
      open: 0,
      reviewing: 0,
      readyToFix: 0,
      fixing: 0,
      deployed: 0,
      wontFix: 0,
      critical: 0,
      total: 0,
    });
  }

  const recentActivities: MonitorStats["recentActivities"] = [];

  for (const issue of allIssues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
    byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;

    const isTerminal = TERMINAL_STATUSES.includes(issue.status);

    if (issue.type === "incident" && !isTerminal) {
      activeIncidentsCount++;
    }

    const approvalStatus = issue.aiFixApproval?.status;
    if (!isTerminal && approvalStatus === "approved") {
      aiApprovedActiveCount++;
    } else if (
      (issue.status === "ready_to_fix" || issue.status === "fixing") &&
      issue.type !== "question" &&
      approvalStatus !== "rejected" &&
      !autoApproveKeys.has(issue.projectKey)
    ) {
      awaitingAiApprovalCount++;
      if (issue.status === "fixing") awaitingAiApprovalFixingCount++;
    }

    if (Array.isArray(issue.subtasks)) {
      subtasksTotal += issue.subtasks.length;
      subtasksCompleted += issue.subtasks.filter((s) => s.completed).length;
    }

    if (issue.status === "open") openIssues++;
    else if (issue.status === "reviewing") reviewingIssues++;
    else if (issue.status === "ready_to_fix") readyToFixIssues++;
    else if (issue.status === "fixing") fixingIssues++;
    else if (issue.status === "deployed") deployedIssues++;
    else if (issue.status === "wont_fix") wontFixIssues++;

    if (!isTerminal && issue.priority === "critical") {
      criticalOpenCount++;
    }

    if (!isTerminal && issue.dueDate) {
      const duePrefix = issue.dueDate.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(duePrefix) && duePrefix < todayPrefix) {
        overdueCount++;
      }
    }

    if (isTerminal && issue.closedAt) {
      const closedDate = new Date(issue.closedAt);
      if (!isNaN(closedDate.getTime()) && getBangkokDatePrefix(closedDate) === todayPrefix) {
        resolvedTodayCount++;
      }
      const startMs = new Date(issue.createdAt).getTime();
      const endMs = closedDate.getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
        totalResolutionMs += endMs - startMs;
        resolvedWithDurationCount++;
      }
    }

    const pStat = projectStatMap.get(issue.projectKey);
    if (pStat) {
      pStat.total++;
      if (issue.status === "open") pStat.open++;
      else if (issue.status === "reviewing") pStat.reviewing++;
      else if (issue.status === "ready_to_fix") pStat.readyToFix++;
      else if (issue.status === "fixing") pStat.fixing++;
      else if (issue.status === "deployed") pStat.deployed++;
      else if (issue.status === "wont_fix") pStat.wontFix++;
      if (!isTerminal && issue.priority === "critical") {
        pStat.critical++;
      }
    }

    const assigneeName = issue.assignee || "ยังไม่ระบุผู้รับผิดชอบ";
    const aStat = assigneeMap.get(assigneeName) || {
      assignee: assigneeName,
      pendingReview: 0,
      readyOrFixing: 0,
      completed: 0,
      total: 0,
    };
    aStat.total++;
    if (isTerminal) aStat.completed++;
    else if (issue.status === "ready_to_fix" || issue.status === "fixing") aStat.readyOrFixing++;
    else aStat.pendingReview++;
    assigneeMap.set(assigneeName, aStat);

    for (const ev of issue.timeline || []) {
      recentActivities.push({
        id: `${issue.code}-${ev.id}`,
        issueCode: issue.code,
        issueTitle: issue.title,
        projectKey: issue.projectKey,
        actor: ev.actor,
        action: ev.action,
        detail: ev.detail,
        createdAt: ev.createdAt,
      });
    }
  }

  recentActivities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalIssues = allIssues.length;
  const completedCount = deployedIssues + wontFixIssues;
  const resolutionRatePct =
    totalIssues > 0 ? Math.round((completedCount / totalIssues) * 1000) / 10 : 0;
  const avgResolutionHours =
    resolvedWithDurationCount > 0
      ? Math.round((totalResolutionMs / resolvedWithDurationCount / 3600000) * 10) / 10
      : 0;

  return {
    totalIssues,
    openIssues,
    reviewingIssues,
    readyToFixIssues,
    fixingIssues,
    deployedIssues,
    wontFixIssues,
    criticalOpenCount,
    overdueCount,
    resolvedTodayCount,
    resolutionRatePct,
    avgResolutionHours,
    subtasksTotal,
    subtasksCompleted,
    activeIncidentsCount,
    awaitingAiApprovalCount,
    awaitingAiApprovalFixingCount,
    aiApprovedActiveCount,
    byProject: Array.from(projectStatMap.values()),
    byType,
    byPriority,
    byAssignee: Array.from(assigneeMap.values()).sort((a, b) => b.total - a.total),
    recentActivities: recentActivities.slice(0, 25),
  };
}

export async function deleteIssue(code: string): Promise<boolean> {
  const { issues } = await getCollections();
  const normalized = code.trim().replace(/^#/, "").toUpperCase();
  const candidateKeys = await attachmentKeysOf(issues, { code: normalized });
  const res = await issues.deleteOne({ code: normalized });
  if (candidateKeys.length > 0) {
    await removeUnreferencedAttachments(issues, candidateKeys);
  }
  return (res.deletedCount || 0) > 0;
}
