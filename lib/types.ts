export type IssueStatus =
  | "open"         // 1. รอรีวิว (รอ Claude ดึงไปวิเคราะห์)
  | "reviewing"    // 2. กำลังรีวิว (Claude กำลังวิเคราะห์สาเหตุ)
  | "ready_to_fix" // 3. รอแก้ (รีวิวแล้ว มีคำสั่งแก้ รอ Antigravity ดึงไปทำ)
  | "fixing"       // 4. กำลังแก้/Deploy (Antigravity กำลังแก้โค้ดและ Deploy)
  | "deployed"     // 5. Deploy แล้ว (แก้ไข ทดสอบ และ Deploy สำเร็จ)
  | "wont_fix";    // 6. ไม่แก้ (รีวิวแล้วตัดสินใจไม่แก้ พร้อมเหตุผลชัดเจน)

export type IssueStatusFilter =
  | IssueStatus
  | "all"
  | "pending_review" // open + reviewing (คิวงาน Claude)
  | "active"         // open + reviewing + ready_to_fix + fixing
  | "overdue";       // ยังไม่จบและเลยกำหนด SLA

export type IssueType =
  | "question"    // สอบถาม / ตั้งคำถาม / ขอคำแนะนำการใช้งาน
  | "incident"    // ด่วนมาก / ระบบล่ม / เข้าใช้งานไม่ได้
  | "bug"         // แจ้งปัญหาการใช้งาน / ข้อมูลผิดพลาด
  | "deployment"  // อัปเดตระบบ / ติดตั้งโปรแกรม
  | "performance" // ระบบช้า / ค้าง / ประมวลผลนาน
  | "security"    // สิทธิ์การใช้งาน / รหัสผ่าน / ความปลอดภัย
  | "feature";    // ขอเพิ่มฟีเจอร์ / ปรับปรุงหน้าจอ

export type IssuePriority = "critical" | "high" | "medium" | "low";

export type ProjectCategory = "devops" | "software";

export interface AttachmentItem {
  id: string;
  key: string;          // MinIO object key
  name: string;         // Original filename
  mimeType: string;     // e.g., image/png, application/pdf, text/plain
  size: number;         // bytes
  kind: "image" | "document";
  uploadedAt: string;   // ISO UTC
  uploadedBy: string;
  url?: string;         // Proxy URL: /api/files/[key]
}

export type AttachmentRecord = AttachmentItem;

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
  assignee?: string;
}

export interface DevopsMetadata {
  environment?: "Production" | "Staging" | "Development" | "DR-Site" | string;
  serviceName?: string;          // เช่น caddy-proxy, mainapi, next-web, mongodb, minio
  incidentSeverity?: "SEV-1" | "SEV-2" | "SEV-3" | "Maintenance" | string;
  runbookOrCommit?: string;      // แผนกู้คืน / Commit SHA / Runbook
  targetServerOrDomain?: string; // เช่น issue.dedezoom.com
  commitSha?: string;
  stackTrace?: string;
}

export interface ReviewAndFixMeta {
  decision?: "pending" | "fix" | "wont_fix"; // รอรีวิว | สั่งแก้ (รอแก้) | ไม่แก้
  reviewedBy?: string;       // เช่น "Antigravity"
  reviewedAt?: string;       // ISO UTC
  reviewReason?: string;     // เหตุผลการตัดสินใจ / วิเคราะห์ Root Cause (ทำไมต้องแก้ หรือ ทำไมไม่แก้)
  fixInstructions?: string;  // คำสั่งในการแก้สำหรับ Antigravity (ต้องแก้ไฟล์ไหน อย่างไร)
  targetFiles?: string[];    // รายชื่อไฟล์หรือ Service ที่ต้องแก้ไข
  deployCommand?: string;    // คำสั่ง Verify & Deploy ที่ให้ Antigravity รัน
  fixedBy?: string;          // เช่น "Antigravity"
  fixedAt?: string;          // ISO UTC
  deployResult?: string;     // บันทึกผลการแก้และ Deploy (Commit / ผลเทสต์ Playwright / URL)
}

export interface ProjectRecord {
  _id?: string;
  key: string;               // Unique project key e.g., "DEVOPS", "API", "FRONTEND", "DB", "AI"
  name: string;              // ชื่อโปรเจกต์ DevOps / Engineering
  category?: ProjectCategory;
  description: string;
  repoOrServer?: string;     // เช่น "issue.dedezoom.com"
  color: string;             // Hex color e.g., "#10b981"
  icon: string;              // Icon identifier
  nextIssueNumber: number;   // Atomic sequence counter
  labels: Array<{ name: string; color: string }>;
  milestones: Array<{ id: string; title: string; dueDate?: string; status: "open" | "closed" }>;
  createdAt: string;
  updatedAt: string;
}

export interface CommentRecord {
  id: string;
  author: string;
  role?: string;        // เช่น "Claude Reviewer", "Antigravity Deployer", "DevOps SRE"
  body: string;
  attachments: AttachmentItem[];
  reactions?: Record<string, string[]>;
  isResolution?: boolean;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  actor: string;
  action: string;       // e.g., "created", "reviewed_fix", "reviewed_wont_fix", "fixing", "deployed", "status_changed", "commented"
  detail: string;
  createdAt: string;
}

export interface IssueRecord {
  _id?: string;
  projectKey: string;       // e.g., "DEVOPS", "API", "FRONTEND", "DB", "AI"
  number: number;           // e.g., 101 -> #DEVOPS-101
  code: string;             // e.g., "DEVOPS-101"
  title: string;
  description: string;
  status: IssueStatus;
  type: IssueType;
  priority: IssuePriority;
  reporter: string;         // ผู้แจ้ง หรือ ระบบ Alert
  department?: string;      // ทีม เช่น "DevOps SRE", "Backend Team", "Prometheus Alert"
  assignee?: string;        // ผู้รับผิดชอบปัจจุบัน เช่น "Claude (Reviewer)" หรือ "Antigravity (Fix & Deploy)"
  labels: string[];
  milestone?: string;
  dueDate?: string;         // ISO Date สำหรับคำนวณ SLA
  attachments: AttachmentItem[];
  subtasks?: SubtaskItem[]; // รายการงานย่อย (Checklist สำหรับแก้และ Deploy)
  reactions?: Record<string, string[]>;
  relatedCodes?: string[];  // เชื่อมโยง Issue ที่เกี่ยวข้องกัน
  devopsMeta?: DevopsMetadata;   // ข้อมูลเซิร์ฟเวอร์ / Service / Severity / Environment
  reviewMeta?: ReviewAndFixMeta; // ข้อมูลผลรีวิวจาก Claude + เหตุผล + คำสั่งแก้และ Deploy สำหรับ Antigravity
  aiTriage?: {
    summary: string;
    confidence: number;
    rootCauseGuess?: string;
  };
  comments: CommentRecord[];
  timeline: TimelineEvent[];
  upvotes: number;
  upvotedBy: string[];
  aiSummary?: string;
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorStats {
  totalIssues: number;
  openIssues: number;         // 1. รอรีวิว (open)
  reviewingIssues: number;    // 2. กำลังรีวิว (reviewing)
  readyToFixIssues: number;   // 3. รอแก้ (ready_to_fix — คิว Antigravity)
  fixingIssues: number;       // 4. กำลังแก้/Deploy (fixing)
  deployedIssues: number;     // 5. Deploy แล้ว (deployed)
  wontFixIssues: number;      // 6. ไม่แก้ (wont_fix)
  criticalOpenCount: number;
  overdueCount: number;
  resolvedTodayCount: number;
  resolutionRatePct: number;
  avgResolutionHours: number;
  subtasksTotal: number;
  subtasksCompleted: number;
  activeIncidentsCount: number;
  byProject: Array<{
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
  }>;
  byType: Record<IssueType, number>;
  byPriority: Record<IssuePriority, number>;
  byAssignee: Array<{
    assignee: string;
    pendingReview: number;
    readyOrFixing: number;
    completed: number;
    total: number;
  }>;
  recentActivities: Array<{
    id: string;
    issueCode: string;
    issueTitle: string;
    projectKey: string;
    actor: string;
    action: string;
    detail: string;
    createdAt: string;
  }>;
}
