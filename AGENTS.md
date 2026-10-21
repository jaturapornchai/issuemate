# IssueMate DevOps — AI Agent Rules (`D:\issuemate`)

> ระบบบริหารจัดการปัญหาและ DevOps Pipeline สำหรับ **Antigravity (Review -> Fix -> Deploy)** บนโดเมนจริง **`https://issue.dedezoom.com`**

## โครงสร้าง 6 สถานะใน DevOps Pipeline (`IssueStatus`)
1. `open` — **1. รอรีวิว (Pending Antigravity)**
2. `reviewing` — **2. กำลังรีวิว (Antigravity Reviewing)**
3. `ready_to_fix` — **3. รอแก้ (Ready for Antigravity — รีวิวผ่านแล้ว มี `reviewReason`, `fixInstructions`, `targetFiles`, `deployCommand`)**
4. `fixing` — **4. กำลังแก้/Deploy (Antigravity Fixing & Deploying)**
5. `deployed` — **5. Deploy แล้ว (Deployed & Verified — พร้อม `deployResult`)**
6. `wont_fix` — **6. ไม่แก้ (Won't Fix / Rejected — รีวิวแล้วตัดสินใจไม่แก้ พร้อม `reviewReason`)**

## โครงสร้างไฟล์หลัก (Key Files)
- `lib/types.ts` — โครงสร้างข้อมูลทั้งหมด (`ProjectRecord`, `IssueRecord`, `DevopsMetadata`, `ReviewAndFixMeta`, `MonitorStats`)
- `lib/mongodb.ts` — การเชื่อมต่อ MongoDB (`directConnection: true`), การสร้าง Index และระบบรีเซ็ตข้อมูลสะอาดไร้ Demo Issues (`nextIssueNumber: 1`)
- `lib/minio.ts` — การเชื่อมต่อ MinIO S3 (`issuemate-files`), อัปโหลดและดึงไฟล์สตรีม
- `lib/auth.ts` & `app/api/auth/*` — ระบบ Login by Google + ระบบจัดการรายชื่อ Gmail ผู้มีสิทธิ์เข้าใช้งาน (`allowed_users`) พร้อมซ่อนอีเมล (`maskEmail`) เพื่อความเป็นส่วนตัวเมื่อไม่ได้ล็อกอินเป็น Admin และรองรับการเปลี่ยน Super Admin Email ผ่าน `SUPER_ADMIN_EMAIL` ใน `.env.local` หรือผ่านหน้าเว็บ
- `lib/issue-service.ts` — Business Logic ทั้งหมดของ DevOps Projects, Issues, `reviewMeta`, Subtasks, Reactions และ Monitor Stats
- `lib/mcp-tokens.ts` & `app/api/mcp/tokens/route.ts` — ตัวสร้างและจัดการ MCP API Token (`ism_live_<40-hex>`) ผูกกับ **รหัสโปรเจกต์ (`projectKey`)** และ **Gmail ที่ได้รับอนุญาตจาก Admin** เพื่อป้องกันการดึงหรือแก้ไข Issue ข้ามโปรเจกต์
- `lib/mcp-server.ts` — MCP Server v3.0 (14 Tools รวมถึง `submit_claude_review`, `claim_for_fix`, `mark_deployed` รองรับการยืนยันตัวตนด้วย Project-bound & Gmail-bound Token)
- `app/page.tsx` — หน้าจอหลัก (Sidebar โปรเจกต์ DevOps, 2-Row Baseline Header, 6-Stage Filter Tabs, ปุ่ม Login by Google)
- `components/MonitorDashboardView.tsx` — หน้าจอศูนย์ควบคุมและติดตามงาน DevOps Pipeline แบบเรียลไทม์
- `components/IssuesTableView.tsx` — ตาราง DevOps Issues 100% Resizable Columns
- `components/KanbanBoardView.tsx` — กระดาน Kanban 6 สถานะ (`open`, `reviewing`, `ready_to_fix`, `fixing`, `deployed`, `wont_fix`)
- `components/IssueDetailDrawer.tsx` — หน้าต่าง Slide-over รายละเอียด Issue, แผงควบคุม Antigravity Review/Fix/Deploy, Lightbox พรีวิวรูปภาพ และคอมเมนต์
- `components/GoogleLoginModal.tsx` — หน้าต่าง Login by Google + จัดการสิทธิ์ Gmail + เปลี่ยนอีเมล Super Admin + คู่มือตั้งค่า Google Cloud Console OAuth 2.0
- `tests/issuemate.spec.ts` — ชุดทดสอบ Playwright E2E + Project-bound MCP JSON-RPC v3.0 + MinIO + Google Login

## คำสั่งตรวจสอบระบบ (Verification Commands)
```bash
npx tsc --noEmit
npx playwright test
```
