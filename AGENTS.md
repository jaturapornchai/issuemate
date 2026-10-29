# IssueMate DevOps — AI Agent Rules (`D:\issuemate`)

> ระบบบริหารจัดการปัญหาและ DevOps Pipeline สำหรับ **Antigravity (Review -> Fix -> Deploy)** บนโดเมนจริง **`https://issue.dedezoom.com`**

## ขอบเขตงาน (ลุงจืดตั้งกฎ 2026-10-29)
- แก้ไฟล์ / commit / deploy ได้เฉพาะใน `D:\issuemate` — project อื่น (เช่น UAT Tester `D:\test02\openhands-swarm`, SML AI Account) อ่านเพื่อวิเคราะห์ได้ แต่ห้ามแก้ ถ้าต้องแก้ที่นั่นให้เขียน prompt ให้ลุงจืดไปสั่งเอง

## โครงสร้าง 6 สถานะใน DevOps Pipeline (`IssueStatus`)
1. `open` — **1. รอรีวิว (Pending Antigravity)**
2. `reviewing` — **2. กำลังรีวิว (Antigravity Reviewing)**
3. `ready_to_fix` — **3. รอแก้ (Ready for Antigravity — รีวิวผ่านแล้ว มี `reviewReason`, `fixInstructions`, `targetFiles`, `deployCommand`)** — AI เริ่มแก้ได้เมื่อผู้ดูแลอนุมัติ (`aiFixApproval.status = "approved"`) หรือโปรเจกต์เปิดโหมดอัตโนมัติ (`project.aiAutoApproval.enabled`)
4. `fixing` — **4. กำลังแก้/Deploy (Antigravity Fixing & Deploying)**
5. `deployed` — **5. Deploy แล้ว (Deployed & Verified — พร้อม `deployResult`)**
6. `wont_fix` — **6. ไม่แก้ (Won't Fix / Rejected — รีวิวแล้วตัดสินใจไม่แก้ พร้อม `reviewReason`)**

## การอนุมัติก่อนให้ AI แก้ไข (Admin Approval Gate)
- กฎทั้งหมดอยู่ใน `lib/ai-approval.ts` (ใช้ร่วมกันทั้ง MCP และ UI): สถานะ `fixing`/`deployed` ผ่าน MCP ต้องได้รับอนุมัติ, การ "ไม่อนุมัติ" ชนะโหมดอัตโนมัติเสมอ, เรื่องประเภท `question` ไม่ต้องอนุมัติ
- อนุมัติได้เฉพาะ Admin / `project_admin` ผ่านหน้าเว็บ (`PATCH /api/issues/[code]` ด้วย `aiFixApproval`, `PATCH /api/projects` ด้วย `aiAutoApproval`) — ห้ามเพิ่มช่องทางอนุมัติผ่าน MCP
- ทุก MCP tool ที่พาเรื่องเข้า `fixing`/`deployed` ต้องเรียก `requireAiFixApproval` ใน `lib/mcp-server.ts`

## โครงสร้างไฟล์หลัก (Key Files)
- `lib/types.ts` — โครงสร้างข้อมูลทั้งหมด (`ProjectRecord`, `IssueRecord`, `IssueType` รวม `"question"`, `DevopsMetadata`, `ReviewAndFixMeta`, `MonitorStats`)
- `lib/permissions.ts` — ระบบสิทธิ์ผู้ใช้งานละเอียดระดับโปรเจกต์ (`ProjectPermissionLevel`: `"viewer" | "question_only" | "reporter" | "developer" | "project_admin"`, `PROJECT_PERMISSION_CONFIG`, `getUserProjectPermission`) ที่ใช้ร่วมกันได้ทั้งฝั่ง Client และ Server
- `lib/mongodb.ts` — การเชื่อมต่อ MongoDB (`directConnection: true`), การสร้าง Index และระบบรีเซ็ตข้อมูลสะอาดไร้ Demo Issues (`nextIssueNumber: 1`)
- `lib/minio.ts` — การเชื่อมต่อ MinIO S3 (`issuemate-files`), อัปโหลดและดึงไฟล์สตรีม (รองรับ `Content-Disposition: inline` สำหรับเปิดดู PDF และรูปภาพบนหน้าเว็บทันที)
- `lib/auth.ts` & `app/api/auth/*` — ระบบ Login by Google + ระบบจัดการรายชื่อ Gmail ผู้มีสิทธิ์เข้าใช้งาน (`allowed_users`) พร้อมกำหนดสิทธิ์แยกตามโปรเจกต์ (`projectPermissions`) และซ่อนอีเมล (`maskEmail`) เมื่อไม่ได้ล็อกอินเป็น Admin
- `lib/issue-service.ts` — Business Logic ทั้งหมดของ DevOps Projects, Issues, `reviewMeta`, Subtasks, Reactions และ Monitor Stats
- `lib/mcp-tokens.ts` & `app/api/mcp/tokens/route.ts` — ตัวสร้างและจัดการ MCP API Token (`ism_live_<40-hex>`) ผูกกับ **รหัสโปรเจกต์ (`projectKey`)** และ **Gmail ที่ได้รับอนุญาตจาก Admin**
- `lib/mcp-server.ts` — MCP Server v3.0 (14 Tools รวมถึง `create_project` พร้อม Confirmation Gate, `submit_claude_review`, `claim_for_fix`, `mark_deployed`, `converse_on_issue`)
- `lib/qa-assistant.ts` & `app/api/ai/format-issue/route.ts` — ระบบ AI QA Assistant สำหรับฟีเจอร์ **"Easy for Tester, Rich for Dev"** (วิเคราะห์ความชัดเจนของข้อความ, ถามกลับอย่างสุภาพเมื่อข้อมูลสั้นเกินไปพร้อม `quickReplyOptions`, จัดโครงสร้าง Issue + Severity Badge `🔴 Urgent` / `🟡 Medium` / `🟢 Minor`, และเก็บ `Device & Environment Info` อัตโนมัติ)
- `app/page.tsx` — หน้าจอหลักภาษาไทยสำหรับผู้ใช้ทั่วไป พร้อมระบบจำโปรเจกต์ล่าสุดที่ใช้ (`localStorage` + `?project=`), ปุ่มด่วน **สอบถาม / ตั้งคำถาม** และตัวกรอง 6 สถานะ
- `components/ui/FileAttachmentZone.tsx` — คอมโพเนนต์อัปโหลดหลายรูป/หลายไฟล์ (รองรับ `Ctrl+V`), `ImageAnnotatorModal` (HTML5 `<canvas>` 3 เครื่องมือ: วงกลมสีแดง, ลูกศรชี้, เบลอข้อมูลลับลูกค้า) และ `AttachmentGallery` (`Inline PDF Viewer` & `Image Lightbox`)
- `components/IssueDetailDrawer.tsx` — หน้าต่าง Slide-over รายละเอียดปัญหา/คำถาม, **One-Click Dev Action Bar** (`Copy Git Branch Command` + `Copy Checklist for PR`), บล็อกพับได้ `📱 Device & Environment Info`, แผงตอบคำถามพร้อมแนบไฟล์ PDF/รูปภาพส่งกลับ และปุ่มปิดเรื่องในคลิกเดียว
- `components/GoogleLoginModal.tsx` — หน้าต่าง Login by Google + จัดการสิทธิ์ Gmail รายโปรเจกต์ (`question_only`, `reporter`, `viewer`, `developer`, `project_admin`) + เพิ่มโปรเจกต์สำหรับ Admin
- `tests/issuemate.spec.ts` — ชุดทดสอบ Playwright E2E + API ครบวงจร

## ระบบดีไซน์ UI (Design System)
- `app/globals.css` — Design tokens (`bg-canvas`, `bg-surface`, `bg-overlay`, `border-line`, `text-fg`, `text-fg-muted`, `text-fg-subtle`) และคลาสคอมโพเนนต์ (`btn btn-primary|secondary|ghost|danger`, `input`, `select`, `textarea`, `card`, `pill`, `count`, `kbd`) — ใช้คลาสเหล่านี้แทนการกำหนดสี `slate-*` เอง
- `components/ui/Badges.tsx` — `TONE` (สีเดียวของทั้งระบบสำหรับ pill/dot) + `STATUS_CONFIG` / `TYPE_CONFIG` / `PRIORITY_CONFIG` / `PERMISSION_UI` และ `Avatar`, `formatRelativeTime`
- `components/ui/Dialog.tsx` — `Dialog`, `DialogHeader`, `DialogFooter`, `SectionHeading`, `Notice` สำหรับทุก Modal (Bottom sheet บนมือถือ)
- ฟอนต์ `IBM Plex Sans Thai` + `IBM Plex Mono` ผ่าน `next/font` (`app/layout.tsx`)

## คำสั่งตรวจสอบระบบ (Verification Commands)
```bash
npx tsc --noEmit
npx playwright test
```
