import type { IssueRecord, ProjectRecord } from "./types";

export type IssueNotificationEvent =
  | "issue.created_urgent"
  | "issue.awaiting_ai_approval"
  | "question.answered"
  | "issue.deployed";

export interface IssueNotificationPayload {
  event: IssueNotificationEvent;
  issue: IssueRecord;
  project?: ProjectRecord | null;
  summary: string;
  actor: string;
}

const PRIVATE_HOST_PATTERNS = [
  /^169\.254\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^metadata\.google\.internal$/i,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc00:/i,
  /^\[?fd00:/i,
];

/**
 * ตรวจสอบความถูกต้องและความปลอดภัยของ Webhook URL (ป้องกัน SSRF ตามกฎ Security Rule 10)
 * อนุญาต 127.0.0.1 / localhost เฉพาะตอนรันทดสอบในเครื่อง (NODE_ENV !== "production" หรือ ALLOW_LOCAL_WEBHOOKS="1")
 */
export function validateWebhookUrl(rawUrl: string): string {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";
  if (trimmed.length > 512) {
    throw new Error("Webhook URL ยาวเกินกำหนด (สูงสุด 512 ตัวอักษร)");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("รูปแบบ Webhook URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https:// หรือ http://)");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Webhook URL ต้องใช้โปรโตคอล https:// หรือ http:// เท่านั้น");
  }

  const host = parsed.hostname.toLowerCase();
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(host)) {
      throw new Error("ไม่อนุญาตให้ใช้ IP หรือ Host ภายในเครือข่ายเป็น Webhook URL");
    }
  }

  const isLoopback = host === "localhost" || host === "127.0.0.1";
  const allowLocal =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_WEBHOOKS === "1";
  if (isLoopback && !allowLocal) {
    throw new Error("ไม่อนุญาตให้ใช้ localhost หรือ 127.0.0.1 บน Production");
  }

  return parsed.toString();
}

const EVENT_TITLE_TH: Record<IssueNotificationEvent, string> = {
  "issue.created_urgent": "🚨 แจ้งเรื่องด่วน / ระบบล่ม",
  "issue.awaiting_ai_approval": "🤖 รอผู้ดูแลอนุมัติให้ AI แก้ไข",
  "question.answered": "💬 ตอบคำถามพร้อมแนบคู่มือ PDF แล้ว",
  "issue.deployed": "✅ แก้ไขและอัปเดตระบบสำเร็จ (Deployed)",
};

/**
 * ส่งแจ้งเตือนอัตโนมัติไปยัง Webhook ของโปรเจกต์, Global Webhook (Slack / Discord / Custom HTTP)
 * หรือ Telegram Bot (ทำงานแบบ Non-blocking ไม่ทำให้การบันทึก Issue ล้มเหลว)
 */
export function notifyIssueEvent(payload: IssueNotificationPayload): void {
  void dispatchIssueNotification(payload).catch((err) => {
    console.warn("[IssueMate Notification] Failed to dispatch notification:", err);
  });
}

export async function dispatchIssueNotification(
  payload: IssueNotificationPayload
): Promise<{ delivered: number }> {
  const { event, issue, project, summary, actor } = payload;
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://issue.dedezoom.com").replace(
    /\/+$/,
    ""
  );
  const issueUrl = `${appBaseUrl}/?project=${encodeURIComponent(issue.projectKey)}`;
  const headline = `${EVENT_TITLE_TH[event]} — [${issue.code}] ${issue.title}`;
  const textBody = [
    headline,
    `โปรเจกต์: ${issue.projectKey}${project?.name ? ` (${project.name})` : ""}`,
    `ผู้แจ้ง: ${issue.reporter} · ดำเนินการโดย: ${actor}`,
    `สรุป: ${summary}`,
    `ลิงก์: ${issueUrl}`,
  ].join("\n");

  const targets = new Set<string>();
  if (project?.webhookUrl) {
    try {
      const valid = validateWebhookUrl(project.webhookUrl);
      if (valid) targets.add(valid);
    } catch {
      // ignore invalid stored webhook
    }
  }
  if (process.env.ISSUEMATE_WEBHOOK_URL) {
    try {
      const valid = validateWebhookUrl(process.env.ISSUEMATE_WEBHOOK_URL);
      if (valid) targets.add(valid);
    } catch {
      // ignore invalid env webhook
    }
  }

  let delivered = 0;
  const bodyJson = JSON.stringify({
    text: textBody,
    content: textBody,
    event,
    projectKey: issue.projectKey,
    code: issue.code,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    type: issue.type,
    reporter: issue.reporter,
    actor,
    summary,
    url: issueUrl,
    timestamp: new Date().toISOString(),
  });

  for (const url of targets) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyJson,
        signal: controller.signal,
      });
      if (res.ok) delivered++;
    } catch {
      // ignore network error on individual webhook
    } finally {
      clearTimeout(timer);
    }
  }

  const tgToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const tgChatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (tgToken && tgChatId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: textBody,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
      if (res.ok) delivered++;
    } catch {
      // ignore telegram error
    } finally {
      clearTimeout(timer);
    }
  }

  return { delivered };
}
