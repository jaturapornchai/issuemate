import type { IssuePriority, IssueType } from "./types";

export interface ClientEnvironmentInfo {
  osAndDevice: string;
  browser: string;
  screenResolution: string;
  viewportSize: string;
  networkInfo: string;
  currentUrl: string;
  timestamp: string;
  timezone: string;
  language: string;
  userAgent: string;
}

export interface QaStructuredIssue {
  title: string;
  severity: "critical" | "medium" | "low";
  labels: string[];
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  qaRetestChecklist: string[];
  gitBranchSlug: string;
  inferredType: IssueType;
  inferredPriority: IssuePriority;
  formattedMarkdown: string;
}

export interface QaAssistantResponse {
  needsClarification: boolean;
  clarifyingQuestion: string | null;
  quickReplyOptions: string[];
  issue: QaStructuredIssue;
}

const VAGUE_EXACT_PATTERNS = new Set([
  "พัง",
  "เว็บพัง",
  "กดไม่ได้",
  "เข้าไม่ได้",
  "เว็บพังเข้าไม่ได้",
  "ใช้งานไม่ได้",
  "ใช้ไม่ได้",
  "ค้าง",
  "หน้าจอค้าง",
  "ไม่ขึ้น",
  "ข้อมูลไม่ขึ้น",
  "มีปัญหา",
  "ช่วยด้วย",
  "error",
  "bug",
  "broken",
  "not working",
  "it crashed",
  "ไม่ทำงาน",
]);

function normalizeText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export function isReportTooVague(rawText: string, clarificationAnswer?: string): boolean {
  if (clarificationAnswer && clarificationAnswer.trim().length > 0) {
    return false;
  }
  const clean = normalizeText(rawText)
    .toLowerCase()
    .replace(/[!?.~🍓😊🙏😭🔥]+/g, "")
    .trim();
  if (!clean) return true;
  if (VAGUE_EXACT_PATTERNS.has(clean)) return true;
  // Very short input without concrete location/action keywords
  if (clean.length <= 10) {
    const hasSpecificNoun =
      /(หน้า|ปุ่ม|เมนู|ตาราง|รายงาน|ล็อกอิน|login|ใบเสร็จ|บิล|ราคา|ภาษี|pdf|รูป|อัปโหลด|ค้นหา|กรอง|สร้าง|ลบ|แก้ไข)/i.test(
        clean
      );
    if (!hasSpecificNoun) return true;
  }
  return false;
}

export function buildClarificationPrompt(rawText: string): {
  clarifyingQuestion: string;
  quickReplyOptions: string[];
} {
  const lower = rawText.toLowerCase();
  if (lower.includes("เข้าไม่ได้") || lower.includes("เว็บพัง") || lower.includes("login")) {
    return {
      clarifyingQuestion:
        "เกิดปัญหาที่หน้าไหนคะ? หรือมีข้อความแจ้งเตือนอะไรขึ้นบนหน้าจอไหมคะ 😊",
      quickReplyOptions: [
        "เกิดที่หน้าเข้าสู่ระบบ (กด Login แล้วไม่ผ่าน)",
        "เปิดหน้าเว็บแล้วขึ้นข้อความแจ้งเตือนสีแดง",
        "หน้าจอขาว / หมุนโหลดค้างไม่ยอมเข้าหน้าหลัก",
      ],
    };
  }
  if (lower.includes("กดไม่ได้") || lower.includes("ไม่ทำงาน") || lower.includes("ค้าง")) {
    return {
      clarifyingQuestion:
        "ตอนที่กดไม่ได้ อยู่หน้าจอไหนและกำลังกดปุ่มอะไรอยู่คะ? 🙏",
      quickReplyOptions: [
        "กดปุ่ม 'บันทึก / ส่งเรื่อง' แล้วไม่มีอะไรเกิดขึ้น",
        "กดปุ่มอัปโหลดรูปภาพ/ไฟล์ PDF ไม่ได้",
        "กดเลือกเมนูหรือตัวกรองข้อมูลแล้วหน้าจอค้าง",
      ],
    };
  }
  return {
    clarifyingQuestion:
      "รบกวนบอกเพิ่มอีกนิดนะคะ 😊 เจอปัญหานี้ที่หน้าไหน และมีข้อความแจ้งเตือนขึ้นไหมคะ?",
    quickReplyOptions: [
      "เกิดที่หน้าจอหลัก มีข้อความแจ้งเตือนสีแดง",
      "กดปุ่มบันทึกข้อมูลแล้วหมุนค้าง",
      "ข้อมูลแสดงผลไม่ครบหรือตัวเลขไม่ถูกต้อง",
    ],
  };
}

function inferEnglishSlug(text: string, type: IssueType): string {
  const prefix = type === "feature" ? "feat" : type === "question" ? "docs" : "fix";
  const keywordMap: Array<[RegExp, string]> = [
    [/login|เข้าสู่ระบบ|ล็อกอิน|google|auth/i, "login-auth"],
    [/upload|อัปโหลด|แนบไฟล์|รูป|ภาพ|image|pdf/i, "file-upload"],
    [/save|บันทึก|ส่งเรื่อง|submit|สร้าง/i, "form-submit"],
    [/search|ค้นหา|กรอง|filter/i, "search-filter"],
    [/slow|ช้า|ค้าง|หมุน|timeout|hang/i, "performance-hang"],
    [/mobile|มือถือ|ipad|จอเล็ก|responsive/i, "mobile-layout"],
    [/price|ราคา|ยอดเงิน|ภาษี|vat|คำนวณ/i, "calculation-logic"],
    [/delete|ลบ/i, "delete-action"],
    [/button|ปุ่ม|กดไม่ได้|คลิก/i, "button-action"],
    [/error|500|404|403|พัง|ล่ม/i, "error-handling"],
  ];

  const matched: string[] = [];
  for (const [regex, slugPart] of keywordMap) {
    if (regex.test(text) && !matched.includes(slugPart)) {
      matched.push(slugPart);
    }
    if (matched.length >= 2) break;
  }

  const englishWords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !["the", "and", "for", "with", "not"].includes(w))
    .slice(0, 3);

  const combined = [...matched, ...englishWords].join("-").replace(/-+/g, "-").slice(0, 36);
  return `${prefix}/${combined || "issue-report"}`;
}

export function formatSeverityBadge(severity: "critical" | "medium" | "low"): string {
  if (severity === "critical") return "🔴 Urgent (ด่วนมาก / กระทบการใช้งานหลัก)";
  if (severity === "low") return "🟢 Minor (ทั่วไป / ปรับปรุงหน้าจอ)";
  return "🟡 Medium (สำคัญปานกลาง)";
}

export function analyzeAndFormatQaIssue(input: {
  rawText: string;
  clarificationAnswer?: string;
  projectKey?: string;
  forceCreate?: boolean;
  /** Type the reporter picked (Ask/Idea buttons, a type pill, question_only); skips guessing */
  type?: IssueType;
}): QaAssistantResponse {
  const raw = normalizeText(input.rawText || "");
  const extra = normalizeText(input.clarificationAnswer || "");
  const combinedText = extra ? `${raw} (${extra})` : raw;

  const needsClarification = !input.forceCreate && isReportTooVague(raw, extra);
  const clarification = needsClarification
    ? buildClarificationPrompt(raw)
    : { clarifyingQuestion: null, quickReplyOptions: [] };

  const lower = combinedText.toLowerCase();

  // Infer type
  const looksBroken = /(พัง|ไม่ได้|ผิด|ค้าง|error)/i.test(combinedText);
  let inferredType: IssueType = "bug";
  if (input.type) {
    inferredType = input.type;
  } else if (
    /(อยากให้มี|ขอเพิ่ม|เสนอแนะ|ปรับปรุง|น่าจะมี|เพิ่มปุ่ม|เพิ่มฟีเจอร์|feature|request|อยากได้)/i.test(
      combinedText
    ) ||
    (!looksBroken && /(ให้มี|ออกแบบให้|รวมเป็น|ให้เป็น|เปลี่ยนเป็น)/.test(combinedText))
  ) {
    inferredType = "feature";
  } else if (
    /(สอบถาม|ถามหน่อย|ยังไง|อย่างไร|ขอสูตร|ขอ\s*query|วิธีใช้|อยู่ตรงไหน|คืออะไร|\?$)/i.test(combinedText) &&
    !looksBroken
  ) {
    inferredType = "question";
  } else if (/(ล่ม|เข้าเว็บไม่ได้เลย|500|502|ข้อมูลหาย|ทั้งระบบ)/i.test(combinedText)) {
    inferredType = "incident";
  } else if (/(ช้ามาก|โหลดนาน|อืด|กระตุก|ค้างนาน)/i.test(combinedText)) {
    inferredType = "performance";
  }

  // Infer severity
  let severity: "critical" | "medium" | "low" = "medium";
  if (
    inferredType === "incident" ||
    /(ด่วนมาก|ด่วนที่สุด|ระบบล่ม|เข้าไม่ได้เลย|จ่ายเงินไม่ได้|บันทึกไม่ได้เลย|ลูกค้าใช้งานไม่ได้|critical|urgent|blocker)/i.test(
      combinedText
    )
  ) {
    severity = "critical";
  } else if (
    inferredType === "question" ||
    inferredType === "feature" ||
    /(สีเพี้ยน|ตัวหนังสือตก|คำผิด|เล็กน้อย|อยากให้|สวยงาม|minor|typo)/i.test(combinedText)
  ) {
    severity = "low";
  }

  const inferredPriority: IssuePriority =
    severity === "critical" ? "critical" : severity === "medium" ? "high" : "low";

  // Infer labels
  const labels = new Set<string>();
  labels.add(inferredType === "feature" ? "enhancement" : inferredType === "question" ? "question" : "bug");
  if (/(หน้าจอ|ปุ่ม|ตาราง|แสดงผล|สี|มือถือ|ui|ux|หน้าเว็บ|อินพุต|เมนู)/i.test(combinedText)) {
    labels.add("ui");
  }
  if (/(ช้า|ค้าง|โหลด|หมุน|timeout)/i.test(combinedText)) {
    labels.add("performance");
  }
  if (/(login|เข้าสู่ระบบ|สิทธิ์|รหัสผ่าน|google)/i.test(combinedText)) {
    labels.add("auth");
  }
  labels.add("needs-triage");

  // Clean summary for title
  const prefixTag =
    inferredType === "feature"
      ? "[Feat]"
      : inferredType === "question"
      ? "[Question]"
      : "[Bug]";
  const cleanSummary = combinedText
    .replace(/^(เจอปัญหา|แจ้งปัญหา|รบกวน|ช่วยดูหน่อย|คือว่า|เวลาที่)\s*/i, "")
    .slice(0, 90);
  const title = `${prefixTag} ${cleanSummary || "แจ้งปัญหาการใช้งานระบบ"}`;

  // Split or infer Steps to Reproduce
  const rawClauses = combinedText
    .split(/(?:แล้วพอกด|พอกด|จากนั้น|ต่อมา|แล้วก็|->|=>|\n|;)/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  const stepsToReproduce: string[] = [];
  if (rawClauses.length >= 2) {
    rawClauses.forEach((clause, idx) => {
      stepsToReproduce.push(`${idx + 1}. ${clause}`);
    });
  } else {
    stepsToReproduce.push(
      `1. เปิดใช้งานหน้าจอในโปรเจกต์ ${input.projectKey || "ที่เกี่ยวข้อง"}`
    );
    stepsToReproduce.push(`2. ทำรายการตามที่ผู้แจ้งระบุ: "${combinedText}"`);
    stepsToReproduce.push(
      `3. สังเกตผลลัพธ์หรือข้อความแจ้งเตือนที่แสดงบนหน้าจอ`
    );
  }

  const expectedBehavior =
    inferredType === "feature"
      ? `ระบบรองรับการทำงานตามที่เสนอ: ${cleanSummary}`
      : inferredType === "question"
      ? `ได้รับคำอธิบายหรือขั้นตอนการใช้งานที่ชัดเจนสำหรับ: ${cleanSummary}`
      : `ระบบควรทำงานและแสดงผลได้อย่างถูกต้องโดยไม่ค้างหรือเกิดข้อผิดพลาดเมื่อทำรายการ`;

  const actualBehavior = combinedText || "เกิดข้อผิดพลาดตามที่ผู้ใช้งานแจ้ง";

  const qaRetestChecklist = [
    `- [ ] ทดสอบซ้ำตามขั้นตอน: ${cleanSummary}`,
    `- [ ] ตรวจสอบว่าไม่มีข้อความ Error หรืออาการค้างเมื่อกดทำรายการซ้ำ`,
    `- [ ] ตรวจสอบการแสดงผลทั้งบน Desktop และมือถือ (Responsive)`,
  ];

  const gitBranchSlug = inferEnglishSlug(combinedText, inferredType);
  const severityBadge = formatSeverityBadge(severity);

  const formattedMarkdown = [
    `### 🏷️ ระดับความสำคัญ: **${severityBadge}**`,
    "",
    `#### 💬 ข้อความต้นฉบับจากผู้แจ้ง`,
    `> ${combinedText}`,
    "",
    `#### 🔢 ขั้นตอนการจำลองปัญหา (Steps to Reproduce)`,
    ...stepsToReproduce,
    "",
    `#### ✅ สิ่งที่ควรเกิดขึ้น (Expected Behavior)`,
    expectedBehavior,
    "",
    `#### ❌ สิ่งที่เกิดขึ้นจริง (Actual Behavior)`,
    actualBehavior,
    "",
    `#### 🧪 รายการตรวจรับงานสำหรับ QA (QA Retest Checklist)`,
    ...qaRetestChecklist,
  ].join("\n");

  return {
    needsClarification,
    clarifyingQuestion: clarification.clarifyingQuestion,
    quickReplyOptions: clarification.quickReplyOptions,
    issue: {
      title,
      severity,
      labels: Array.from(labels),
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      qaRetestChecklist,
      gitBranchSlug,
      inferredType,
      inferredPriority,
      formattedMarkdown,
    },
  };
}

export function captureBrowserEnvironment(): ClientEnvironmentInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      osAndDevice: "Server / Headless",
      browser: "Node.js",
      screenResolution: "N/A",
      viewportSize: "N/A",
      networkInfo: "N/A",
      currentUrl: "",
      timestamp: new Date().toISOString(),
      timezone: "Asia/Bangkok",
      language: "th-TH",
      userAgent: "SSR",
    };
  }

  const ua = navigator.userAgent || "";
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const deviceType = isMobile ? "Mobile / Tablet" : "Desktop";

  let os = "Unknown OS";
  if (/Windows NT 10\.0/i.test(ua)) os = "Windows 10/11";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) {
    const m = ua.match(/Android\s+([\d.]+)/i);
    os = `Android ${m?.[1] || ""}`.trim();
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const m = ua.match(/OS\s+([\d_]+)/i);
    os = `iOS ${m?.[1]?.replace(/_/g, ".") || ""}`.trim();
  } else if (/Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  let browser = "Browser";
  const edg = ua.match(/Edg\/([\d.]+)/);
  const chrome = ua.match(/Chrome\/([\d.]+)/);
  const firefox = ua.match(/Firefox\/([\d.]+)/);
  const safari = ua.match(/Version\/([\d.]+).*Safari/);
  if (edg) browser = `Edge ${edg[1]}`;
  else if (chrome) browser = `Chrome ${chrome[1]}`;
  else if (firefox) browser = `Firefox ${firefox[1]}`;
  else if (safari) browser = `Safari ${safari[1]}`;

  const screenW = window.screen?.width || window.innerWidth;
  const screenH = window.screen?.height || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const screenResolution = `${screenW}×${screenH} (DPR ${dpr}x)`;
  const viewportSize = `${window.innerWidth}×${window.innerHeight}`;

  const navConn = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number };
    }
  ).connection;
  const networkInfo = navConn
    ? [
        navConn.effectiveType ? navConn.effectiveType.toUpperCase() : null,
        typeof navConn.downlink === "number" ? `${navConn.downlink} Mbps` : null,
        typeof navConn.rtt === "number" ? `RTT ${navConn.rtt}ms` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Online"
    : navigator.onLine
    ? "Online"
    : "Offline";

  let timezone = "Asia/Bangkok";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok";
  } catch {
    // ignore
  }

  return {
    osAndDevice: `${os} (${deviceType})`,
    browser,
    screenResolution,
    viewportSize,
    networkInfo,
    currentUrl: window.location.href,
    timestamp: new Date().toISOString(),
    timezone,
    language: navigator.language || "th-TH",
    userAgent: ua,
  };
}

export function buildEnvironmentDetailsBlock(env: ClientEnvironmentInfo): string {
  return [
    `<details><summary>📱 Device & Environment Info</summary>`,
    "",
    `- **OS & Device Type:** ${env.osAndDevice}`,
    `- **Browser & Version:** ${env.browser}`,
    `- **Screen Resolution:** ${env.screenResolution}`,
    `- **Viewport Size:** ${env.viewportSize}`,
    `- **Network Connection:** ${env.networkInfo}`,
    `- **Timestamp & Timezone:** ${env.timestamp} (${env.timezone})`,
    `- **Language:** ${env.language}`,
    `- **Page URL:** ${env.currentUrl || "-"}`,
    `- **User Agent:** \`${env.userAgent}\``,
    `</details>`,
  ].join("\n");
}

export function parseEnvironmentDetailsFromDescription(description?: string): {
  cleanDescription: string;
  envMarkdown: string | null;
  envPairs: Array<{ label: string; value: string }>;
} {
  const raw = description || "";
  const regex =
    /<details>\s*<summary>\s*📱\s*Device\s*(?:&|&amp;)\s*Environment\s*Info\s*<\/summary>([\s\S]*?)<\/details>/i;
  const match = raw.match(regex);
  if (!match) {
    return { cleanDescription: raw, envMarkdown: null, envPairs: [] };
  }
  const inner = match[1].trim();
  const envPairs: Array<{ label: string; value: string }> = [];
  for (const line of inner.split("\n")) {
    const m = line.trim().match(/^-\s*\*\*(.+?):?\*\*:?\s*(.+)$/);
    if (m) {
      envPairs.push({
        label: m[1].replace(/:$/, "").trim(),
        value: m[2].replace(/^`|`$/g, "").trim(),
      });
    }
  }
  const cleanDescription = raw.replace(regex, "").trim();
  return {
    cleanDescription,
    envMarkdown: match[0],
    envPairs,
  };
}

export function buildGitBranchCommand(
  code: string,
  title: string,
  issueType: IssueType = "bug"
): string {
  const cleanCode = (code || "issue").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const fullSlug = inferEnglishSlug(title, issueType);
  const slugTail = fullSlug.split("/").pop() || "fix";
  return `git checkout -b fix/issue-${cleanCode}-${slugTail}`;
}

export function buildPrChecklistMarkdown(issue: {
  code: string;
  title: string;
  description?: string;
  subtasks?: Array<{ title: string; completed?: boolean }>;
}): string {
  const lines: string[] = [
    `## 🧪 QA & PR Verification Checklist — #${issue.code}`,
    `**เรื่อง:** ${issue.title}`,
    "",
  ];
  if (issue.subtasks && issue.subtasks.length > 0) {
    for (const st of issue.subtasks) {
      lines.push(`- [${st.completed ? "x" : " "}] ${st.title}`);
    }
  } else {
    lines.push(`- [ ] ตรวจสอบการแก้ไขปัญหาตามที่แจ้งใน #${issue.code}`);
    lines.push(`- [ ] ทดสอบการทำงานบนหน้าจอจริง (Desktop & Mobile Viewport)`);
    lines.push(`- [ ] ตรวจสอบว่าไม่มี Console Error หรือ HTTP 4xx/5xx`);
  }
  lines.push(`- [ ] รัน \`npx tsc --noEmit && npx playwright test\` ผ่านครบทุกข้อ`);
  return lines.join("\n");
}
