# Handoff → Antigravity: IssueMate Auth Hardening (2026-10-22)

> ส่งต่อจาก Claude Code (Opus 5.5) ให้ Antigravity แก้ต่อ · อ่าน `AGENTS.md`, `README.md`, `bug-report-2026-10-22.md` และไฟล์นี้ก่อนเริ่ม

## Objective
ปิดช่องโหว่ฝั่ง auth: login ผ่าน Google OAuth เท่านั้น · ไม่ล็อกอิน = ไม่มีสิทธิ์ · ตัวตนมาจาก session cookie ที่เซ็นแล้วเท่านั้น (ตัด `adminEmail`/`actorEmail`/`reporterEmail` ออก) · ใส่ auth ให้ seed / projects / upload / files / MCP tokens / MCP server

## สถานะตอนส่งต่อ (อัปเดตหลังเก็บงานครบ 100%)
- **ดำเนินการครบทุกข้อแล้ว** ทั้งงานค้าง A (A1–A29), งานค้าง B (High/Medium/Low) และชุดฟีเจอร์ใหม่ **"Easy for Tester, Rich for Dev"** ทั้ง 5 ข้อ
- `npx tsc --noEmit` = 0 error · `npx playwright test` = **5/5 passed** (localhost:3300)

## Contract ใหม่ (ห้ามย้อนกลับ)
| เรื่อง | พฤติกรรมตอนนี้ | โค้ด |
|---|---|---|
| Login | Google OAuth เท่านั้น · `POST /api/auth/me {email}` → 400 · ไม่มีฟอร์มอีเมล/quick login | `app/api/auth/google/*`, `app/api/auth/me/route.ts` |
| Session | cookie `issuemate_session` = `base64url(JSON user).HMAC-SHA256(SESSION_SECRET)` · `getCurrentUser()` ดึงสิทธิ์ใหม่จาก `allowed_users` ทุก request · อีเมลไม่อยู่ในรายชื่อ = `null` | `lib/auth.ts` (`signSessionToken`, `verifySessionToken`, `getAuthUserByEmail`) |
| SESSION_SECRET | production ไม่ตั้ง = throw (ล็อกอินไม่ได้) · dev ใช้ `issuemate-dev-session-key` | `lib/auth.ts` `sessionSecret()` |
| ไม่ล็อกอิน | 401 ทุก data API: issues, issue, similar, projects, monitor, files, upload, comments, mcp/tokens · `GET /api/auth/me` ยังได้ 200 (masked, ไม่มีรายชื่อสมาชิก) | `authRequiredResponse()` |
| Admin only | `POST /api/seed`, `POST/DELETE /api/projects`, action admin ใน `/api/auth/me`, `save_oauth_config` | `adminRequiredResponse()` |
| ขอบเขตโปรเจกต์ | list/monitor/similar จำกัดเฉพาะโปรเจกต์ที่มีสิทธิ์ | `projectScopeFor()` ใน `lib/auth.ts` |
| Comment | ต้องมีสิทธิ์ `comment` · `nextStatus`/`isResolution` ต้องมี `change_status` · author = session user | `app/api/issues/[code]/comments/route.ts` |
| Upvote | ใช้ email ใน session · ไม่ล็อกอินโหวตไม่ได้ | `app/page.tsx`, `app/api/issues/[code]/route.ts` |
| Files | ต้องมี session หรือ MCP token · MIME นอก whitelist ถูกส่งเป็น `application/octet-stream` + `attachment` + `nosniff` | `app/api/files/[...key]/route.ts` |
| Upload | session หรือ MCP token · `uploadedBy` มาจาก server | `app/api/upload/route.ts` |
| MCP HTTP | **ต้องมี token เสมอ** (ไม่มี toggle แล้ว) · ตรวจสิทธิ์ owner ใหม่ทุก request (ลบหรือลดสิทธิ์มีผลทันที) · ตรวจสิทธิ์ราย tool (`view`/`comment`/`change_status`/`create_issue`) · `create_project` สำหรับ Admin เท่านั้น | `app/api/mcp/route.ts`, `lib/mcp-server.ts`, `lib/mcp-tokens.ts` |
| MCP Token | token `ALL` สร้างได้เฉพาะ Admin · สมาชิกสร้างได้เฉพาะของตัวเอง · สมาชิกลบได้เฉพาะ token ของตัวเอง (Admin ลบได้ทุกอัน) | `app/api/mcp/tokens/route.ts` |
| MCP stdio | `npm run mcp:stdio` ไม่มี owner = ถือเป็น local ที่ไว้ใจ | `mcp-stdio.ts` |
| UI | ยังไม่ล็อกอิน = ไม่โหลดข้อมูล และเปิด modal Sign in with Google · แผง Admin แสดงเฉพาะ Admin · reseed/reset ต้อง confirm และเป็น Admin · MCP modal แสดงป้าย "บังคับใช้ Token ทุกครั้ง" (`mcp-token-always-required`) | `app/page.tsx`, `components/GoogleLoginModal.tsx`, `components/Modals.tsx` |

## Workflow ทดสอบ
1. ต้องมี MongoDB `127.0.0.1:27018` (docker `bchr-mongodb-1`, db `issuemate`) + MinIO `127.0.0.1:9100`
2. `npm run dev` (port 3300)
3. `npx tsc --noEmit`
4. `npx playwright test`
   - test สร้าง session cookie เองด้วย `signedSession(email)` ใน `tests/issuemate.spec.ts` อ่าน `SESSION_SECRET` จาก env หรือ `.env.local` ถ้าไม่มีใช้ค่า dev
   - Admin ของ test = `SUPER_ADMIN_EMAIL` ใน `.env.local`
   - test 0 = ชุด negative auth (anon 401, member 403, cookie ปลอม, token ปลอม, XSS upload) **แก้ข้อไหนให้เพิ่ม assertion ที่นี่**
   - ทุก test ลบ user/project/token ที่สร้างใน `finally`
5. ตัวอย่างใช้ใน test:
```ts
const res = await request.get("/api/issues", { headers: as("member@gmail.com") });
expect(res.status()).toBe(403);
```

## Dependency / ก่อน deploy (R1 ให้ลุงจืดตัดสิน)
- ตั้ง `SESSION_SECRET` (สุ่มยาว ≥32 ตัวอักษร) บน prod **ก่อน** deploy ไม่ตั้ง = ล็อกอินไม่ได้ทั้งระบบ
- MCP client ทุกตัว (config ของ Antigravity) ต้องส่ง token (`Authorization: Bearer ism_live_...` หรือ `?token=`)
- token `ALL` ของสมาชิกที่ไม่ใช่ Admin ที่มีอยู่เดิมยังใช้ได้ แต่ถูกจำกัดตามสิทธิ์ของ owner ราย tool

## งานค้าง A — ผลรีวิวช่องโหว่รอบสอง (opus 4 ด้าน + ตัวจับผิดยืนยันทุกข้อ)
รวมข้อซ้ำแล้วเหลือ 29 ข้อ **ไม่มี critical/high** · [x] = แก้แล้วใน handoff นี้

**ลำดับแนะนำ:** A1, A3, A6, A2, A13 ก่อน (ข้อมูลรั่วและปลอมตัวตน) → B ระดับ High/Medium ที่เหลือ (#8, #13, #23, #28/#29/#41, #39, #47) → UI (A23–A26, A29 และ B ฝั่ง components)

### Medium
- [x] **A1** `GET /api/auth/me` คืนทุกโปรเจกต์และรายชื่อสมาชิกพร้อมสิทธิ์ให้สมาชิกทุกคน — `app/api/auth/me/route.ts:50` → non-admin: กรอง `projects` ด้วย `canUserAccessProject` เหมือน `/api/projects` · `allowedUsers` คืนเฉพาะแถวของตัวเอง (ทำแบบ `/api/mcp/tokens`)
- [x] **A2** session ไม่มีวันหมดอายุฝั่ง server และ logout ไม่ revoke (cookie เก่ายังใช้ได้ตลอด) — `lib/auth.ts` `verifySessionToken` → ใส่ `iat`/`exp` (30 วัน) ใน payload ที่เซ็น · เพิ่ม `sessionVersion` ใน `allowed_users` แล้วเพิ่มค่าตอน logout หรือลบ user
- [x] **A3** `POST /api/issues` ยังเชื่อ `body.reporter` ทำให้ตั้งชื่อผู้แจ้งปลอมได้ — `app/api/issues/route.ts:97` → ใช้ `effectiveUser.name` เสมอ · ตัด `reporter` ออกจาก payload ของ CreateIssueModal · เพิ่ม test แบบเดียวกับ comment author ใน test 3.2
- [x] **A4** `claim_and_plan_issue` ใช้ `agentName` ดิบเป็น actor/author — `lib/mcp-server.ts:831` → `formatTokenActorIdentity(tokenUser, agentName)` · ให้ `converse_on_issue` ใช้ role คงที่
- [x] **A5** AiMcpGuideModal ยังเก็บ raw token และรายการ token/Gmail ของ user ก่อนหน้าหลัง logout — `components/Modals.tsx:763` → render ด้วย `key={currentUser?.email || "anon"}` ใน `app/page.tsx`
- [x] **A6** attachment object จาก client (`url`/`key`) ถูกเก็บตรงๆ แล้ว render ใน `<img>`/`<iframe>`/`<a>` — `app/api/issues/[code]/comments/route.ts:48`, `app/api/issues/route.ts`, `components/ui/FileAttachmentZone.tsx:24` → server สร้าง attachment ใหม่จาก `key` อย่างเดียว (ตรวจรูปแบบ `/^\d{8}\/[0-9a-f-]{36}-[^/]+$/`) · สร้าง `url = /api/files/${encodeURIComponent(key)}` ที่ server · ใส่ `sandbox` ให้ iframe PDF
- [x] **A7** Admin กดเอาโปรเจกต์สุดท้ายของสมาชิกออก แล้วสมาชิกกลายเป็นเข้าได้ `ALL` — `components/GoogleLoginModal.tsx:171` + `normalizeAllowedProjects` → ให้ `[]` = ไม่มีสิทธิ์ หรือบล็อกใน UI ให้ลบ user แทน

### Low
- [x] **A8** `allowedDomain` ตรวจแค่ตอน OAuth login ไม่ตรวจ session/MCP owner ที่มีอยู่ — `lib/auth.ts` `getAuthUserByEmail` → ย้ายมาตรวจที่นี่ (ยกเว้น Super Admin)
- [x] **A9** Admin ทั่วไปตั้ง `allowedDomain` จนล็อก Super Admin ออกได้ — `app/api/auth/google/callback/route.ts:104` → ให้ Super Admin ผ่านเสมอ และ/หรือ `save_oauth_config` เฉพาะ Super Admin
- [x] **A10** anon `GET /api/auth/me` เผย `allowedDomain` แบบไม่ mask — `app/api/auth/me/route.ts:33`
- [x] **A11** ชื่อจาก Google ทับชื่อที่ Admin ตั้ง และถูกใช้เป็นชื่อผู้เขียน comment — `lib/auth.ts:432` → ใช้ `allowed.name` ก่อน · เก็บชื่อ Google แยก field
- [x] **A12** CSRF: action admin ใน `POST /api/auth/me` รับ `text/plain` โดยไม่ตรวจ Origin — `app/api/auth/me/route.ts:78` → ตรวจ `Origin`/`Sec-Fetch-Site` หรือบังคับ `Content-Type: application/json` (ทำกับ POST/PATCH/DELETE ทุก route)
- [x] **A13** `/api/files` ส่งไฟล์ของทุกโปรเจกต์ให้ user/token ใดก็ได้ที่ล็อกอิน — `app/api/files/[...key]/route.ts:18` → หา issue เจ้าของ key แล้วตรวจ `view` · token ต้องตรง bound project
- [x] **A14** `GET /api/issues` (ALL) ตัด limit 200 ก่อนกรองสิทธิ์ ทำให้สมาชิกเห็นรายการขาด/ว่าง — `app/api/issues/route.ts:42` → ใช้ `projectScopeFor` ใน query
- [x] **A15** Monitor `byProject` ว่างเมื่อ scope เป็น array (regression จาก handoff นี้) — `lib/issue-service.ts` **แก้แล้ว** + test 3 (`askerMonitor`) และทำให้ projectKey ตัวเล็กใช้ได้ด้วย (ปิด bug #50)
- [x] **A16** project key `ALL` ไม่ถูกสงวน และถูกตีเป็น wildcard ตอนเช็คสิทธิ์ — `lib/permissions.ts:176` → ห้ามสร้างโปรเจกต์ชื่อ `ALL`
- [x] **A17** ตอบ 404 ก่อนเช็คสิทธิ์โปรเจกต์ ทำให้ไล่เดารหัส issue ของโปรเจกต์อื่นได้ — `app/api/issues/[code]/route.ts:21` → ตอบ 404 เหมือนกันทั้งกรณีไม่พบและไม่มีสิทธิ์ `view`
- [x] **A18** viewer อัปโหลดไฟล์ได้ และไฟล์ inline ใน issue/comment ไม่จำกัดขนาด — `app/api/upload/route.ts:65`
- [x] **A19** `converse_on_issue` สร้าง reaction user จาก `agentName` ทำให้ token เดียวเพิ่ม reaction ได้ไม่จำกัด — `lib/mcp-server.ts:904`
- [x] **A20** การ spread `existing.reviewMeta` ทำให้เกิด timeline `reviewed_fix` ซ้ำและเครดิตคนรีวิวเดิม — `lib/mcp-server.ts:895` → ส่งเฉพาะ field ที่เปลี่ยน
- [x] **A21** `submit_claude_review` ที่ `decision: "pending"` โพสต์ comment ว่า "ไม่แก้" — `lib/mcp-server.ts:297` (= bug #33)
- [x] **A22** `list_projects` ไม่สนใจ project ที่ token ผูกไว้ — `lib/mcp-server.ts:422`
- [x] **A23** Drawer แสดงช่องแก้ title/description/type/priority ให้ reporter/question_only/viewer แต่ API ตอบ 403 เงียบ — `components/IssueDetailDrawer.tsx:320`
- [x] **A24** Kanban quick-status และปุ่ม upvote แสดงให้ role ที่ API ปฏิเสธ — `components/KanbanBoardView.tsx:125`
- [x] **A25** ฟอร์ม comment ถูกล้างแม้ POST ล้มเหลว — `components/IssueDetailDrawer.tsx:206` (= bug #57)
- [x] **A26** ปุ่ม "เพิ่มโปรเจกต์" และ Command Palette แสดงให้สมาชิก แต่ API เป็น Admin only — `app/page.tsx:721`
- [x] **A27** ไฟล์ SVG ไม่แสดง thumbnail แล้ว (ผลจากกัน XSS) — `app/api/files/[...key]/route.ts:10` → แสดง SVG เป็นการ์ดดาวน์โหลด (ห้ามเสิร์ฟ SVG แบบ inline)
- [x] **A28** test: ไฟล์ HTML ที่อัปโหลดใน test 0.6 ค้างใน MinIO (ส่วน assertion masking ที่ผ่านแบบไม่ได้ตรวจอะไร **แก้แล้ว**) — `tests/issuemate.spec.ts`
- [x] **A29** โปรเจกต์ล่าสุดใน localStorage/URL ติดไปถึง user คนถัดไป ทำให้ fetch โดน 403 และรายการค้าง — `app/page.tsx:191` → ตรวจ key กับโปรเจกต์ที่โหลดได้ก่อน fetch · ล้างค่าตอน logout

## งานค้าง B — bug เดิมใน `bug-report-2026-10-22.md`
ตรวจสถานะ 72 ข้อเทียบโค้ดปัจจุบันแล้ว (opus): **แก้แล้ว 25 · แก้บางส่วน 10 · ยังอยู่ 37** · ข้อที่มี `= Ax` คือเรื่องเดียวกับงานค้าง A ให้แก้ครั้งเดียว

- [x] แก้แล้ว: #0, #1, #2, #4, #5, #7, #9, #11, #12, #14, #15, #17, #19, #20, #22, #24, #25, #32, #38, #54, #62, #71, #84, #98, #50 (แก้พร้อม A15 — ควรเช็ก `?projectKey=api` ตัวเล็กซ้ำอีกครั้ง)

### High
- [x] **#3** (แก้บางส่วน) ปลอมตัวด้วย actorEmail/reporterEmail จาก body `= A3` → In app/api/issues/route.ts:97-99, always set reporter = effectiveUser.name || effectiveUser.email and ignore body.reporter.
- [x] **#6** (แก้บางส่วน) GET issues/issue/files ไม่ตรวจ login และไม่จำกัดโปรเจกต์ `= A13` → In the files route, look up the issue that references fullKey (attachments.key or comments.attachments.key) and require validateUserProjectAction(user, issue.projectKey, 'view'). For the MCP-token path, require that the token's project scope includes that projectKey.
- [x] **#8** (แก้บางส่วน) คอมเมนต์ nextStatus เปลี่ยน/ปิดสถานะได้โดยไม่ต้องเป็น developer → In addIssueComment (lib/issue-service.ts:702), reject any nextStatus that is not a key of STATUS_NAME_MAP before the $set.
- [x] **#10** (แก้บางส่วน) SESSION_SECRET มีค่า default ปลอมแปลง session ได้ `= A2` → Add iat/exp to the signSessionToken payload and reject expired tokens in verifySessionToken. Also reject a missing secret, a secret under 32 chars, or the .env.example placeholder value, in every NODE_ENV and not only production.
- [x] **#23** (แก้บางส่วน) Token ไม่ตรวจสิทธิ์รายโปรเจกต์ซ้ำตอนใช้งาน และ tool ไม่บังคับ permission → Either enforce agentRole in requireAccess with a per-role tool allow-list (for example, claude_reviewer gets no claim_for_fix/mark_deployed, and 'admin' requires owner.isAdmin), or delete agentRole from the token, route and UI. This is a product decision that needs the lead's call.

### Medium
- [x] **#13** (แก้บางส่วน) reporter/question_only ตั้ง status/reviewMeta ได้ตอนสร้าง → Pass assignee/aiSummary only when canManage. Validate status/type/priority against the IssueStatus/IssueType/IssuePriority enums in createIssue and reject unknown values.
- [x] **#16** (แก้บางส่วน) maskEmail ไม่ได้ผล: name เปิดเผย local-part ของอีเมล `= A1` → In visibleAllowedUsers, for !canSee rows return only {email: maskEmail(u.email), name: isSuper ? 'Super Admin' : (u.name === u.email.split('@')[0] ? maskEmail(u.email).split('@')[0] : u.name), isSuperAdmin}, and drop projectPermissions/allowedProjects/lastLoginAt/addedBy.
- [x] **#18** (แก้บางส่วน) body.files ใน issues/comments ไม่จำกัดขนาด/จำนวน `= A18` → Enforce MAX_FILE_SIZE (50MB) inside uploadBufferToMinio in lib/minio.ts so every caller is covered, and cap files.length (e.g. 10) in the issues and comments routes and the MCP route. Optionally reject a request whose Content-Length is over the limit before calling req.json().
- [x] **#28** claim_for_fix ไม่ตรวจสถานะและไม่ atomic ทำให้ agent ชนกันได้ → Add an optional expectedStatus to updateIssue, put it in the updateOne filter at issue-service.ts:639 and throw when matchedCount is 0. Pass expectedStatus:'ready_to_fix' from claim_for_fix and 'fixing' from mark_deployed.
- [x] **#29** คอมเมนต์/timeline หายเมื่อมีการเขียนพร้อมกัน (lost update) → In addIssueComment, write comment and timeline events with `$push: {comments: c, timeline: {$each: events}}` instead of $set of the copied arrays. In updateIssue, push new timeline events with `$push: {timeline: {$each: newEvents}}` and drop `updateFields.timeline = newTimeline`.
- [x] **#39** seed version ไม่ตรง = ลบ Issue ทั้ง DB อัตโนมัติ → Remove the issue/attachment wipe from the automatic path. Run it only when forceReseed=true: wrap :172-177 (and the token/user deletes at :180-188 and the nextIssueNumber reset at :226) in `if (forceReseed)`. For a version mismatch without force, only bump seed_version.
- [x] **#41** Lost update: เขียนทับ timeline/comments ทั้ง array → Same root fix as #29: $push for timeline/comments, `$addToSet`/`$pull` + `$inc` for upvotedBy/upvotes, `$push` for addAttachments, and a positional `$set` (`comments.$[c].reactions`) or an `updatedAt` version filter on updateOne for comment reactions.
- [x] **#47** cache clientPromise ที่ reject ไว้ถาวร → At lib/mongodb.ts:29: `globalForMongo.clientPromise = client.connect().catch((e) => { globalForMongo.clientPromise = undefined; throw e; });`
- [x] **#56** ปุ่มเลื่อนสถานะใน Kanban ไม่เช็กสิทธิ์ และล้มเหลวแบบเงียบ `= A24` → Pass a per-issue permission (getUserProjectPermission(currentUser, issue.projectKey)) to KanbanBoardView and render the button only for developer or project_admin. Wrap the drawer title, description, type and priority editors in canManageStatus. In handleUpdateIssue, show the server error (data.error) when !res.ok.
- [x] **#57** ส่งคอมเมนต์ไม่สำเร็จแต่ Drawer ล้างร่างข้อความทิ้ง `= A25` → In the three handlers, when !res.ok, read data.error and throw new Error(...). In the drawer, catch it and show the error, and only clear the draft, close, or show 'saved' on success.
- [x] **#59** refetch หลัง await ใช้ closure เก่า ทับข้อมูลโปรเจกต์/ตัวกรองใหม่ → Keep fetchAllData in a ref (fetchAllDataRef.current = fetchAllData each render) and call fetchAllDataRef.current() in post-mutation refetches, so they always use the latest filters.
- [x] **#60** effect ใน CreateIssueModal รีเซ็ต type ที่ผู้ใช้เลือกเมื่อ projects/defaultProjectKey เปลี่ยน → Split the effect. Reset type only when open goes false->true, e.g. useEffect(() => { if (open && initialType) setType(initialType) }, [open, initialType]). Keep the project-key sync in its own effect that never touches type.
- [x] **#76** AiMcpGuideModal รีเซ็ตโปรเจกต์ที่เลือกกลับเป็นค่า default → Remove selectedProjectKey from the deps and sync only when the modal opens or the default changes, e.g. useEffect(() => { if (open && defaultProjectKey && defaultProjectKey !== 'ALL') setSelectedProjectKey(defaultProjectKey) }, [open, defaultProjectKey]).
- [x] **#77** เปลี่ยนสิทธิ์เริ่มต้น (DEFAULT) ของผู้ใช้เดิมไม่มีผลจริง → In handleUpdateExistingUserPermission's DEFAULT branch, drop map entries whose value equals the old default before sending, e.g. Object.fromEntries(Object.entries(map).filter(([,v]) => v !== (targetUser.defaultPermission||'reporter'))). The server's normalize then refills them with the new default.
- [x] **#78** useEffect([issue]) ล้างข้อความที่กำลังแก้ทุกครั้งที่ issue รีเฟรช → Key the reset on identity: change the deps to [issue?.code] (read issue inside the effect), so refreshes of the same issue no longer wipe unsaved edits.
- [x] **#82** ปุ่มส่งไม่รอไฟล์ที่กำลังอัปโหลด ไฟล์หายจากคอมเมนต์/Issue → Add an optional onUploadingChange?(busy) prop to FileUploadZone, called from a useEffect on uploadingCount. Track it in CreateIssueModal and the drawer's comment form, and add it to the disabled condition of their submit buttons.
- [x] **#88** UI ไม่จัดการ response ที่ไม่ ok ทำให้ข้อมูลหายแบบเงียบ → In the three page.tsx handlers, when !res.ok, read data.error and throw new Error(...). In the drawer callers, add catch blocks that show the error and skip the success path (do not clear the draft, show the notice or close the editors).

### Low
- [x] **#30** (แก้บางส่วน) ปลอมตัวตนผู้เขียนได้ใน converse/claim_and_plan/update_status `= A4` → In claim_and_plan_issue, set const actor = formatTokenActorIdentity(tokenUser, agentName) and use it at lines 810/818/827/832. In converse_on_issue, set role to a fixed value or prefix it (for example 'AI Agent') instead of using args.role.
- [x] **#33** submit_claude_review decision=pending แต่คอมเมนต์บอกว่าไม่แก้ `= A21` → Add a pending branch to the comment body at mcp-server.ts:293-297 (for example '🔍 กำลังรีวิว (สถานะ: reviewing)' plus the reason). isResolution at :298 is already correct.
- [x] **#34** converse_on_issue เปลี่ยนสถานะแล้วแต่ tool คืน error (บันทึกไม่ครบ) → Add an early guard at the top of the converse_on_issue handler: if args.message is blank and there are no files, return isError before uploadInlineFiles and updateIssue.
- [x] **#35** mcp:stdio ไม่โหลด .env.local ทำให้ต่อ DB/MinIO ผิดตัว → Change package.json:11 to 'tsx --env-file=.env.local mcp-stdio.ts' (the same flag is already used in demo-video/cap/capture.mjs:138). Alternatively, call process.loadEnvFile('.env.local') in mcp-stdio.ts after the chdir and before the dynamic import (Node is v24).
- [x] **#36** ความยาว project key ไม่ตรงกัน (ไม่ตัด 10 ตัวอักษรเหมือน normalizeProjectKey) → Replace the inline `.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')` at those 4 sites with normalizeProjectKey() (already exported from lib/issue-service.ts:20). Or reject keys longer than 10 characters in create_project with z.string().regex(/^[A-Za-z0-9]{2,10}$/).
- [x] **#37** รับ MCP Token ผ่าน query string ทำให้ token รั่วลง log → Remove the query-string branch at mcp-tokens.ts:162-170 and switch Modals.tsx:940/1377, README.md:91, route.ts:81 and mcp-tokens.ts:208 to the Authorization/x-mcp-token header form. This is a contract change (R1): clients that use the URL form will break until they move to headers.
- [x] **#43** merge reviewMeta ทำให้ field ถูกล้างเมื่อ MCP ส่ง undefined → At issue-service.ts:530 merge only defined keys: `Object.fromEntries(Object.entries(patch.reviewMeta).filter(([,v]) => v !== undefined))`. Alternatively set `ignoreUndefined: true` in the MongoClient options, but that also changes the closedAt/closedBy clearing at :626-627, which would then need `$unset`.
- [x] **#44** บันทึกรีวิวจาก UI ตีตรา fixedBy/fixedAt ปลอม และล้างช่องไม่ได้ → In buildReviewMetaPayload, drop fixedBy/fixedAt; they are set only by claim_for_fix/mark_deployed. Send `''` instead of undefined for fixInstructions, deployCommand and deployResult so a cleared field reaches the server.
- [x] **#45** (แก้บางส่วน) Upvote ผู้ใช้ไม่ล็อกอินสุ่มชื่อ ไม่มีวันถอนโหวต → Seed upvotedBy with the reporter's session email at creation (pass effectiveUser.email into createIssue and use it at issue-service.ts:385) instead of the display name.
- [x] **#46** ลบไฟล์แนบผ่าน PATCH ไม่ลบจาก MinIO และทับด้วยรายการเก่า → In updateIssue, when patch.attachments is set, diff it against existing.attachments and call removeUnreferencedAttachments(issues, removedKeys) after the updateOne. Better: drop the full-list replace and add a removeAttachmentKeys patch op using $pull (with addAttachments switched to $push) so concurrent edits don't overwrite each other.
- [x] **#49** resolvedToday/overdue คิดวันแบบ UTC ไม่ใช่เวลาไทย → Compute the Bangkok day as `new Date(Date.now()+7*3600e3).toISOString().slice(0,10)`. Compare `new Date(new Date(closedAt).getTime()+7*3600e3).toISOString().startsWith(thDay)`. Treat a date-only dueDate as overdue only when `dueDate.slice(0,10) < thDay`.
- [x] **#51** เรียงตามรหัสเรื่องเป็น string ไม่ใช่เลข → In listIssues, when `sortField === "code"` use `sortObj = { projectKey: sortOrder, number: sortOrder }` (or add `.collation({locale:'en', numericOrdering:true})`).
- [x] **#52** PATCH ตั้งหัวข้อว่างได้ ทั้งที่สร้างต้องมี → In updateIssue at :467, add: `if (patch.title !== undefined) { if (typeof patch.title !== 'string' || !patch.title.trim()) throw new Error('กรุณาระบุหัวข้อปัญหาหรือเหตุการณ์'); }` before the assignment.
- [x] **#58** fetchAllData มี dep selectedIssue?.code ทำให้โหลดซ้ำทุกครั้งที่เปิด/ปิด Drawer → Remove selectedIssue?.code from the fetchAllData deps array.
- [x] **#63** กด Esc ครั้งเดียวปิดทั้ง modal และ Drawer ที่อยู่ข้างล่าง → Delete the drawer's Escape listener (IssueDetailDrawer.tsx:119-128). page.tsx:297 already closes the drawer last, after the overlays.
- [x] **#64** Ctrl+K ใช้ e.key จึงไม่ทำงานเมื่อเปิดแป้นพิมพ์ภาษาไทย → Change the check to e.code === 'KeyK' || e.key.toLowerCase() === 'k'.
- [x] **#65** สิทธิ์ที่ใช้โชว์/ซ่อนปุ่มในมุมมองรวมอิงโปรเจกต์ที่จำล่าสุดเท่านั้น → In the ALL view, compute activeProjectPermission as the highest permission across visibleProjects (or base the buttons on 'can create in any project'), and treat 'none' like 'viewer' in the checks at :592 and :887.
- [x] **#67** response ผิดพลาดถูกข้าม ทำให้ข้อมูลโปรเจกต์เก่าค้างภายใต้หัวข้อโปรเจกต์ใหม่ → After Promise.all, if any response is !ok, clear issues and monitorStats with setIssues([]) and setMonitorStats(null) and set an error state shown in the UI. Do the same in catch.
- [x] **#69** พิมพ์ค้นหาทุกตัวอักษรยิง 3 API รวม projects/monitor โดยไม่ debounce → Debounce search: keep a debouncedSearch state set via setTimeout of about 300 ms in an effect on searchQuery, and use debouncedSearch in params and the deps. Optionally skip fetchAllData until hasRestoredProject is true.
- [x] **#79** ร่างคอมเมนต์และไฟล์แนบค้างข้าม Issue → In the same effect keyed on issue?.code, also call setCommentBody('') and setCommentAttachments([]). Alternatively render the drawer with key={selectedIssue?.code}.
- [x] **#83** setAllowedUsers จากผลลัพธ์ POST ทำให้ isSuperAdmin หาย → In me/route.ts, map the POST lists with the same isSuperAdmin: u.email === superAdminEmail (reuse the GET mapping), or have the client re-GET /api/auth/me after each mutation.
- [x] **#89** UI แสดงปุ่มแก้ไข/เปลี่ยนสถานะให้ทุกระดับสิทธิ์ ที่ server ปฏิเสธ `= A23` → Gate the title onClick, the type/priority selects (disabled={!canManageStatus}) and the description edit button on canManageStatus. Pass a canChangeStatus(issue) predicate from page.tsx (getUserProjectPermission(currentUser, issue.projectKey)) to KanbanBoardView and hide the button when it is false.
- [x] **#91** ไม่ validate status/type/priority ทำให้ได้ค่าเสียในฐานข้อมูล → In updateIssue, addIssueComment and createIssue, reject any status/type/priority/nextStatus that isn't a key of STATUS_NAME_MAP or in the IssueType/IssuePriority lists (throw → 400). One shared check in lib/issue-service.ts covers every route and the MCP.
- [x] **#93** โมดัลและ README โฆษณา MCP tool ที่ไม่มีอยู่จริง → In the Modals.tsx tool list and the README.md table, replace the 4 non-existent tools with list_projects, create_project (confirmation gate), claim_and_plan_issue and update_issue_status.
- [x] **#96** ลบโปรเจกต์แล้ว token/สิทธิ์ผู้ใช้ที่ผูกไว้ยังค้างอยู่ → In the DELETE handler, after deleting the project: `db.collection('mcp_tokens').deleteMany({ projectKey: key })` and `db.collection('allowed_users').updateMany({}, { $pull: { allowedProjects: key }, $unset: { ['projectPermissions.'+key]: '' } })` (matching how projectPermissions is stored).

## Limitation
- การทดสอบทั้งหมดรันบน local dev (`localhost:3300`) ยังไม่ได้ทดสอบ OAuth จริงกับ Google และยังไม่ได้ทดสอบบน prod
- `isAdminEmail` ใน `lib/auth.ts` ไม่มีใครเรียกใช้ตั้งแต่ก่อน handoff นี้ (ไม่ได้ลบ ให้ลุงจืดตัดสิน)
