import type { IssueRecord } from "./types";

const THAI_DATE_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "long",
  timeStyle: "short",
});

// Thai fonts present on the dev PC (Leelawadee UI / Tahoma) and on Linux after
// `playwright-core install --with-deps chromium-headless-shell` (Loma from fonts-tlwg-loma-otf)
const THAI_FONT_STACK = `"Noto Sans Thai", "Leelawadee UI", "Loma", Tahoma, sans-serif`;

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function formatThaiDateTime(iso: string): string {
  return `${THAI_DATE_TIME.format(new Date(iso))} น.`;
}

function answerHtml(
  issue: Pick<IssueRecord, "code" | "title" | "description" | "projectKey" | "reporter" | "createdAt">,
  answer: { body: string; answeredBy: string; answeredAt: string }
): string {
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><style>
  body { font-family: ${THAI_FONT_STACK}; font-size: 15px; line-height: 1.75; color: #1f2937; margin: 0; }
  h1 { font-size: 22px; line-height: 1.5; margin: 0 0 4px; }
  .code { color: #6d28d9; font-weight: 600; }
  .meta { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
  h2 { font-size: 16px; margin: 24px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #ddd6fe; color: #4c1d95; }
  .text { white-space: pre-wrap; word-break: break-word; margin: 0; }
  .question { background: #f5f3ff; border-radius: 8px; padding: 12px 16px; }
  .signed { color: #6b7280; font-size: 13px; margin-top: 20px; }
</style></head><body>
  <h1><span class="code">${esc(issue.code)}</span> ${esc(issue.title)}</h1>
  <p class="meta">โปรเจกต์ ${esc(issue.projectKey)} · ถามโดย ${esc(issue.reporter)} · ถามเมื่อ ${esc(formatThaiDateTime(issue.createdAt))}</p>
  <h2>คำถาม</h2>
  <p class="text question">${esc(issue.description || issue.title)}</p>
  <h2>คำตอบ</h2>
  <p class="text">${esc(answer.body)}</p>
  <p class="signed">ตอบโดย ${esc(answer.answeredBy)} · ${esc(formatThaiDateTime(answer.answeredAt))}</p>
</body></html>`;
}

/** Renders a question + its answer to an A4 PDF with Chromium, so Thai vowels and tone marks are shaped correctly. */
export async function renderAnswerPdf(
  issue: Pick<IssueRecord, "code" | "title" | "description" | "projectKey" | "reporter" | "createdAt">,
  answer: { body: string; answeredBy: string; answeredAt: string }
): Promise<Buffer> {
  const { chromium } = await import("playwright-core");
  // ponytail: one browser per answer; keep a shared browser if the question queue gets busy
  const browser = await chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.setContent(answerHtml(issue, answer), { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;text-align:center;font-size:10px;color:#9ca3af;font-family:${esc(
        THAI_FONT_STACK
      )}">IssueMate · ${esc(issue.code)} · หน้า <span class="pageNumber"></span>/<span class="totalPages"></span></div>`,
    });
  } finally {
    await browser.close();
  }
}
