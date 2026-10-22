# IssueMate — รายงานหา Bug (2026-10-22)

ตรวจ working tree (uncommitted v3.1 + โค้ดเดิม) ด้วย 6 finders → 3 opus skeptics หักล้าง → Lead อ่านโค้ดยืนยันซ้ำ (ข้อที่มี ✔Lead)

สรุป: พบ 126 → dedup 100 → หักล้างตก 11 · ซ้ำ 17 · **เหลือ 72 ข้อ**

## CRITICAL (7)

### #0 ล็อกอินด้วยอีเมลอย่างเดียว ไม่ต้องยืนยันตัวตน ✔Lead
- ที่: `app/api/auth/me/route.ts:178` · authentication
- ปัญหา: POST /api/auth/me (กรณีไม่ใช่ action อื่น) ออก session cookie ให้ทันทีถ้าอีเมลอยู่ใน allowed_users โดยไม่ตรวจรหัสผ่านหรือ OAuth ใดๆ แถมให้กำหนด provider:"google" เองได้ คือข้ามการยืนยันตัวตนไปทั้งหมด
- เกิดเมื่อ: ผู้โจมตีที่ยังไม่ล็อกอินส่ง POST /api/auth/me {"email":"<อีเมล super admin>"} (อีเมลนี้หลุดจากข้อความ error ของ OAuth callback หรือเดาจาก maskEmail+name ได้) แล้วได้ cookie issuemate_session ที่ isAdmin=true ทันที จากนั้นเพิ่ม/ลบผู้ใช้ เปลี่ยน Super Admin หรือลบข้อมูลทุกโปรเจกต์ได้
- หลักฐาน: app/api/auth/me/route.ts:178-226 ถ้า body ไม่มี action ที่รู้จัก จะรับ body.email -> getAllowedUser(email) (lib/auth.ts:263) แล้ว signSessionToken + set cookie อายุ 30 วันทันที ไม่มีรหัสผ่าน/OAuth/OTP; super admin ถูก upsert เข้า allowed_users เสมอ (lib/auth.ts:212-225) จึงล็อกอินเป็น super admin ได้ถ้ารู้อีเมล; ไม่มี middleware.ts ในโปรเจกต์ และ UI เองก็เรียกแบบนี้ (components/GoogleLoginModal.tsx:377-384 ส่งแค่ {email, provider:'google'}) getCurrentUser (lib/auth.ts:528) คำนวณ isAdmin จาก DB ตาม email จึงได้ admin จริง

### #1 body.adminEmail ทำให้ใครก็ได้กลายเป็น Admin ✔Lead
- ที่: `app/api/auth/me/route.ts:92` · authz
- ปัญหา: isCallerAdmin เป็น true เมื่อ body.adminEmail ตรงกับ superAdminEmail ซึ่งเป็นค่าที่ client ส่งมาเอง แม้ไม่มี session ก็ใช้ action change_super_admin, add_allowed_user, update_allowed_user และ remove_allowed_user ได้
- เกิดเมื่อ: คนที่ไม่ได้ล็อกอินส่ง POST {"action":"add_allowed_user","adminEmail":"<super admin>","email":"attacker@gmail.com","role":"admin"} ได้ 200 และบัญชีผู้โจมตีกลายเป็น admin ส่วน {"action":"change_super_admin",...} ใช้ยึด Super Admin ได้ และ remove_allowed_user ใช้ลบผู้ใช้กับ MCP token ของคนอื่นได้
- หลักฐาน: app/api/auth/me/route.ts:86-92 isCallerAdmin = ... || (callerAdminEmail && callerAdminEmail === superAdminEmail) โดย callerAdminEmail มาจาก body.adminEmail ที่ client ส่งเอง ใช้เป็นด่านเดียวของ change_super_admin (95), add/update_allowed_user (117) และ remove_allowed_user (151) ไม่ต้องมี cookie เลย; ต้องรู้อีเมล super admin เต็ม (หลุดได้ทาง callback/route.ts:92) ต่างจาก #0 ตรงที่เป็นการเชื่อฟิลด์ใน body ไม่ใช่ flow login

### #2 ไม่ล็อกอิน = project_admin (fail-open) ทุก route ✔Lead
- ที่: `lib/auth.ts:118` · authz
- ปัญหา: validateUserProjectAction(null) คืน allowed:true และ getUserProjectPermission(null) คืน "project_admin" (lib/permissions.ts:172) ส่วน route issues/[code]/comments เช็คสิทธิ์เฉพาะใน `if (effectiveUser)` ผลคือคำขอที่ไม่มี session (หรือ getCurrentUser คืน null เพราะ DB error) ข้ามการตรวจสิทธิ์ไปทั้งหมด
- เกิดเมื่อ: คนที่ไม่ได้ล็อกอินส่ง DELETE /api/issues/ABC-101 (route.ts:90 ข้ามการเช็คเพราะ effectiveUser=null) แล้ว issue ถูกลบจริง ส่วน PATCH {status:"wont_fix"} ปิดงานคนอื่นได้, POST /api/issues สร้างเรื่องได้ทุกโปรเจกต์ทุก type และ POST comments ตอบได้ทุกเรื่อง
- หลักฐาน: lib/auth.ts:117-119 validateUserProjectAction(null) คืน {allowed:true, permission:'project_admin'} และ lib/permissions.ts:172 คืน project_admin เมื่อ user=null; ทุก route เช็คแบบ if (effectiveUser) เท่านั้น: app/api/issues/[code]/route.ts:90 (DELETE), :55 (PATCH), app/api/issues/route.ts:68 (POST), comments/route.ts:32; ไม่มี cookie -> getCurrentUser คืน null (lib/auth.ts:522) -> ข้ามการตรวจ -> deleteIssue(code) ที่ :104 ทำงานจริง; getCurrentUser ยัง catch ทุก error แล้วคืน null (lib/auth.ts:549) ทำให้ DB error กลายเป็น fail-open ด้วย

### #4 สร้าง/ลบโปรเจกต์ได้โดยไม่ต้องล็อกอิน (ลบ issue ทั้งหมด) ✔Lead
- ที่: `app/api/projects/route.ts:35` · data-integrity
- ปัญหา: POST และ DELETE /api/projects ไม่เรียก getCurrentUser และไม่เช็ค admin เลย DELETE ลบโปรเจกต์ ลบ issues.deleteMany({projectKey}) และลบไฟล์แนบใน MinIO
- เกิดเมื่อ: ใครก็ได้ส่ง DELETE /api/projects?key=BC ทำให้โปรเจกต์ BC พร้อม issue/คอมเมนต์/ไฟล์แนบทั้งหมดหายถาวร (กู้คืนไม่ได้) ส่วน POST สร้างโปรเจกต์ขยะได้ไม่จำกัด
- หลักฐาน: app/api/projects/route.ts:17-33 (POST) และ :35-54 (DELETE) ไม่เรียก getCurrentUser ไม่เช็ค admin เลย; DELETE ทำ projects.deleteOne + issues.deleteMany({projectKey:key}) แล้ว removeUnreferencedAttachments ลบไฟล์ MinIO (:44-48) ไม่มี middleware กันไว้ -> คนนิรนาม DELETE /api/projects?key=BC ลบโปรเจกต์ + issue + ไฟล์แนบถาวร

### #38 POST /api/seed ไม่มี auth ล้าง Issues+ไฟล์ทั้งระบบ ✔Lead
- ที่: `app/api/seed/route.ts:9` · data-integrity
- ปัญหา: endpoint POST /api/seed เรียก ensureIndexesAndSeed(db, true) โดยไม่ตรวจสิทธิ์ใดๆ และ forceReseed=true ข้ามเช็ค seed_version ทำให้ issues.deleteMany({}) ลบ Issue ทุกโปรเจกต์ + ลบไฟล์แนบทั้งหมดใน MinIO + ลบ mcp_tokens/users/allowed_users ของอีเมล jead@/pakpoom@/claude@dedezoom.com + รีเซ็ต nextIssueNumber ทุกโปรเจกต์เป็น 1 (lib/mongodb.ts:164-229)
- เกิดเมื่อ: ใครก็ได้ (ไม่ต้อง login) ยิง `curl -X POST https://issue.dedezoom.com/api/seed` หรือคลิกปุ่ม 'รีเซ็ตข้อมูลตัวอย่าง DevOps' ใน Monitor (components/MonitorDashboardView.tsx:101 -> app/page.tsx:444 ไม่มี confirm) หรือปุ่ม 'ล้างข้อมูล Issues เริ่มใหม่' (GoogleLoginModal.tsx:763) -> Issue ทั้งหมดของทุกโปรเจกต์ (รวม SMLAIACC) และไฟล์แนบหายถาวร, MCP token ของ jead@dedezoom.com ถูกลบทำให้ Antigravity ใช้ไม่ได้, เลข Issue กลับไปเริ่มที่ 1 ทำให้รหัสเก่าที่อ้างอิงใน commit/แชทชี้ไปยัง Issue ใหม่คนละเรื่อง ทั้งที่ seed ไม่ได้สร้าง sample issue ใดๆ ปุ่มจึงเป็น 'ลบทั้งหมด' ล้วนๆ (ไม่ได้ POST ทดสอบ อ่านโค้ดยืนยันเส้นทางเท่านั้น)
- หลักฐาน: app/api/seed/route.ts:6-10 POST เรียก ensureIndexesAndSeed(db, true) ตรงๆ ไม่มี getCurrentUser/validate ใดๆ และ repo ไม่มี middleware.ts/proxy.ts (ls root ไม่พบ) จึงไม่มี guard ชั้นอื่น; lib/mongodb.ts:165 forceReseed=true ข้ามเช็ค seed_version แล้ว :173-177 attachmentKeysOf+issues.deleteMany({})+deleteObjectsFromMinio, :180-188 ลบ mcp_tokens/users/allowed_users ของ jead@/pakpoom@/claude@dedezoom.com, :226 updateMany nextIssueNumber=1 ทุกโปรเจกต์; GET /api/seed ได้ 405 ยืนยันว่ามี POST handler; ปุ่มที่เรียกได้: MonitorDashboardView.tsx:101 -> page.tsx:444-447 (ไม่มี confirm) และ GoogleLoginModal.tsx:567/763; validateUserProjectAction ก็ไม่ถูกเรียกเลย

### #54 ปุ่มรีเซ็ตข้อมูลตัวอย่างลบ Issue ทั้งระบบ ไม่มี confirm
- ที่: `app/page.tsx:444` · data-integrity
- ปัญหา: handleReseedSampleData (ส่งให้ MonitorDashboardView ผ่าน onReseedSampleData ที่ page.tsx:1135 และปุ่มที่ MonitorDashboardView.tsx:98-108) ยิง POST /api/seed ทันทีโดยไม่มี confirm และไม่เช็กสิทธิ์ผู้ใช้ ขณะที่ฝั่ง server ensureIndexesAndSeed(db, true) ใน lib/mongodb.ts:172-176 สั่ง issuesCol.deleteMany({}) ลบ Issue ทุกโปรเจกต์ ลบไฟล์แนบใน MinIO และรีเซ็ต nextIssueNumber เป็น 1 ปุ่มติดป้ายว่า 'ข้อมูลตัวอย่าง' ทั้งที่ลบข้อมูลจริง
- เกิดเมื่อ: ผู้ใช้ระดับ viewer/reporter หรือคนที่ยังไม่ล็อกอิน เปิดหน้า 'ภาพรวมสถิติ' แล้วกด 'รีเซ็ตข้อมูลตัวอย่าง DevOps' ครั้งเดียว -> Issue, คอมเมนต์ และไฟล์แนบจริงของทุกโปรเจกต์ถูกลบถาวร เลขรหัสเรื่องเริ่มนับ 1 ใหม่ ไม่มีหน้าต่างยืนยันและไม่มีทางกู้คืน
- หลักฐาน: app/api/seed/route.ts:6-10 POST ไม่มีการตรวจสิทธิ์เลย (ไม่มี getCurrentUser) และ repo ไม่มี middleware.ts/proxy.ts; เรียก ensureIndexesAndSeed(db, true) ซึ่ง lib/mongodb.ts:164 ข้าม early-return เพราะ forceReseed แล้ว :172-176 ทำ attachmentKeysOf(issuesCol, {}) + issuesCol.deleteMany({}) + deleteObjectsFromMinio ลบทุก Issue และไฟล์แนบ, :228 รีเซ็ต nextIssueNumber=1 ทุกโปรเจกต์; ฝั่ง client app/page.tsx:444-453 ยิง fetch('/api/seed',{method:'POST'}) ทันทีไม่มี confirm และ page.tsx:1135 ส่ง onReseedSampleData ให้ทุกคน (ไม่เช็ก isAdmin) MonitorDashboardView.tsx:98-108 แสดงปุ่มเสมอเมื่อมี prop -> ผู้ใช้ไม่ล็อกอินก็กดลบข้อมูลจริงทั้งระบบได้

### #71 POST /api/seed ล้างข้อมูลทั้งระบบโดยไม่ตรวจสิทธิ์ ✔Lead
- ที่: `app/api/seed/route.ts:6` · authz
- ปัญหา: handler POST เรียก ensureIndexesAndSeed(db, true) (โหมด reset) โดยไม่เรียก getCurrentUser และไม่ตรวจ isAdmin ใดๆ ส่วนปุ่ม "ล้างข้อมูล Issues เริ่มใหม่" ใน GoogleLoginModal (บรรทัด 759-768) ก็เรียก route นี้ตรงๆ
- เกิดเมื่อ: ใครก็ตามที่เข้าถึงเซิร์ฟเวอร์ได้ (ไม่ต้องล็อกอิน) ส่ง curl -X POST /api/seed แล้ว Issues/คอมเมนต์ทั้งหมดถูกล้างและรีเซ็ตเลขเริ่มต้นเป็น #1 ข้อมูลใช้งานจริงหายถาวร
- หลักฐาน: app/api/seed/route.ts:6-10 POST เรียก ensureIndexesAndSeed(db, true) โดยไม่ตรวจ session/admin; lib/mongodb.ts:173-177 ทำ issuesCol.deleteMany({}) และ deleteObjectsFromMinio ไฟล์แนบทั้งหมด แล้ว :226-228 รีเซ็ต nextIssueNumber=1 ทุกโปรเจกต์ ไม่มี middleware กัน ใครก็ curl -X POST /api/seed ล้าง Issue/คอมเมนต์/ไฟล์ทั้งระบบได้

## HIGH (12)

### #3 ปลอมตัวด้วย actorEmail/reporterEmail จาก body ✔Lead
- ที่: `app/api/issues/route.ts:58` · authz
- ปัญหา: ทุก route เขียน (POST issues, PATCH/DELETE [code], POST comments) เอาอีเมลจาก body.actorEmail/reporterEmail/email หรือ query ?actorEmail= ไปหา getAllowedUser แล้วใช้แทน session (explicitUser || sessionUser) จึงอ้างเป็นผู้ใช้คนอื่นได้โดยไม่ต้องพิสูจน์
- เกิดเมื่อ: ผู้ใช้สิทธิ์ viewer (หรือคนที่ไม่ได้ล็อกอิน) ส่ง DELETE /api/issues/ABC-101?actorEmail=<อีเมล admin> (app/api/issues/[code]/route.ts:86-90) ระบบเช็คสิทธิ์ของ admin แทน แล้วผ่าน delete_issue ทำให้ issue ถูกลบ ส่วน question_only ส่ง POST /api/issues {type:"bug",actorEmail:<reporter คนอื่น>} ก็สร้าง bug ได้
- หลักฐาน: app/api/issues/route.ts:58-66 candidateEmail จาก body.actorEmail/reporterEmail/email -> getAllowedUser แล้ว effectiveUser = explicitUser || sessionUser (explicit ชนะ session); แบบเดียวกันที่ app/api/issues/[code]/route.ts:41-45 (PATCH) และ :86-89 (DELETE อ่าน ?actorEmail=) และ comments/route.ts:26-30; getAllowedUser คืน role จริงจาก DB ('admin') จึงได้ project_admin; ต้องรู้อีเมลเต็มของเป้าหมาย (ถูก mask ใน GET แต่หลุดได้ทาง #15/#16) ระดับ high เพราะ #2 เปิดช่องที่ง่ายกว่าอยู่แล้ว

### #5 save_oauth_config ไม่เช็คสิทธิ์ Admin ✔Lead
- ที่: `app/api/auth/me/route.ts:168` · authz
- ปัญหา: action save_oauth_config บันทึก Google clientId/clientSecret/allowedDomain ลง system_meta ได้โดยไม่ตรวจ isCallerAdmin หรือ session
- เกิดเมื่อ: คนที่ไม่ได้ล็อกอินส่ง POST {"action":"save_oauth_config","clientId":"x","clientSecret":"y"} ทำให้ Google Login ของทุกคนพัง หรือใส่ allowedDomain="nobody.invalid" ทำให้ทุกบัญชีถูกปฏิเสธที่ callback หรือเปลี่ยนเป็น OAuth client ของผู้โจมตีเอง
- หลักฐาน: app/api/auth/me/route.ts:168-175 branch save_oauth_config เรียก saveGoogleOAuthConfig ทันทีโดยไม่ตรวจ isCallerAdmin (คำนวณไว้แล้วที่ :89 แต่ไม่ได้ใช้) และ saveGoogleOAuthConfig (lib/auth.ts:451-484) $set clientId/allowedDomain ลง system_meta ตรงๆ; callback (callback/route.ts:97-109) ใช้ allowedDomain ปฏิเสธทุกบัญชีได้ และ getGoogleOAuthConfig ให้ค่า DB ชนะ env (lib/auth.ts:438)

### #6 GET issues/issue/files ไม่ตรวจ login และไม่จำกัดโปรเจกต์ ✔Lead
- ที่: `app/api/issues/route.ts:33` · authz
- ปัญหา: GET /api/issues, GET /api/issues/[code] (line 17) และ GET /api/files/[...key] ไม่เรียก getCurrentUser และไม่กรองตาม allowedProjects ทำให้ทุก issue ทุกโปรเจกต์ รวม reviewMeta/devopsMeta/คอมเมนต์และ URL ไฟล์แนบ เปิดให้คนนอกและสมาชิกที่ไม่มีสิทธิ์โปรเจกต์นั้นอ่านได้
- เกิดเมื่อ: สมาชิกที่ได้สิทธิ์เฉพาะ PRJA หรือคนที่ไม่ได้ล็อกอินเรียก GET /api/issues?projectKey=PRJB ก็ได้รายการ issue ของ PRJB ครบ แล้วเอา attachment.url ไปเปิด /api/files/... ดาวน์โหลด PDF/รูปของโปรเจกต์อื่นได้ (ทดสอบแล้วว่า GET /api/auth/me และ /api/issues ตอบ 200 โดยไม่มี cookie)
- หลักฐาน: app/api/issues/route.ts:20-44 GET เรียก listIssues ตรงโดยไม่มี getCurrentUser/ตัวกรองสิทธิ์; app/api/issues/[code]/route.ts:11-26 GET ก็เหมือนกัน; app/api/files/[...key]/route.ts:6-29 ไม่ตรวจอะไร; action 'view' ใน validateUserProjectAction (lib/auth.ts:128) ไม่มี route ไหนเรียกเลย (grep ยืนยัน) ทั้งที่ getUserProjectPermission คืน 'none' สำหรับโปรเจกต์ที่ไม่อนุญาต (permissions.ts:175-177); curl GET /api/issues ไม่มี cookie ได้ 200 จริง

### #7 เลี่ยงสิทธิ์ PATCH ด้วย toggleUpvoteBy แนบฟิลด์อื่น ✔Lead
- ที่: `app/api/issues/[code]/route.ts:48` · authz
- ปัญหา: isOnlyUpvoteOrReaction ยกเว้นแค่ status/reviewMeta/title/description และเช็คแบบ truthy ถ้าส่ง toggleUpvoteBy ไปพร้อม priority, assignee, labels, attachments, subtasks, devopsMeta, aiSummary, type, dueDate หรือ title:""/description:""/status:"" ก็ข้าม change_status ได้ทั้งหมด และ upvote เองก็ไม่ได้กัน viewer หรือผู้ที่ไม่มีสิทธิ์โปรเจกต์ (perm none) ตามที่ comment บอกไว้
- เกิดเมื่อ: ผู้ใช้ viewer ส่ง PATCH /api/issues/ABC-101 {"toggleUpvoteBy":"x","attachments":[],"title":"","description":"","priority":"low"} ระบบไม่เช็คสิทธิ์ updateIssue จึงลบไฟล์แนบทั้งหมด ล้างหัวข้อ/รายละเอียดเป็นค่าว่าง และลดความสำคัญ ส่วน status:"" ทำให้สถานะเสียหายเป็นสตริงว่าง
- หลักฐาน: app/api/issues/[code]/route.ts:48-53 isOnlyUpvoteOrReaction ยกเว้นแค่ status/reviewMeta/title/description และเช็คแบบ falsy; body {toggleUpvoteBy:'x',attachments:[],title:'',description:'',priority:'low'} ได้ true -> ข้ามการเช็คที่ :55 แล้ว updateIssue (lib/issue-service.ts:462-474, 481, 590-591) ตั้ง title='' (เพราะ ''!==existing.title), description='', priority, attachments=[]; status:'' ผ่าน !body.status แต่ :613 ตั้ง status='' ได้; และไม่มีการกัน viewer ตามที่ comment บรรทัด 47 บอกเลย

### #8 คอมเมนต์ nextStatus เปลี่ยน/ปิดสถานะได้โดยไม่ต้องเป็น developer ✔Lead
- ที่: `app/api/issues/[code]/comments/route.ts:84` · authz
- ปัญหา: route comments เช็คแค่สิทธิ์ "comment" แต่ส่ง body.nextStatus ต่อให้ addIssueComment ซึ่ง $set status/closedAt/closedBy ทำให้ question_only/reporter เปลี่ยนสถานะได้ ทั้งที่ change_status ต้องเป็น developer ขึ้นไป และ nextStatus ไม่ได้ถูกตรวจว่าเป็นค่าที่อนุญาต (enum)
- เกิดเมื่อ: ผู้ใช้ question_only ส่ง POST /api/issues/ABC-101/comments {"body":"ok","nextStatus":"deployed","isResolution":true} แล้ว issue ถูกปิดเป็น deployed โดยมี closedBy เป็นชื่อเขา (ปุ่มนี้ UI ซ่อนไว้เพราะ canManageStatus=false) ถ้าส่ง nextStatus:"hacked" ก็ได้สถานะนอก enum ที่ Kanban/Monitor ไม่รู้จัก
- หลักฐาน: app/api/issues/[code]/comments/route.ts:32-37 เช็คแค่ action 'comment' (question_only/reporter ผ่านตาม lib/auth.ts:148-157) แต่ :84 ส่ง body.nextStatus ต่อ; addIssueComment (lib/issue-service.ts:697-710) $set status/closedAt/closedBy ทันทีโดยไม่ตรวจ enum; STATUS_NAME_MAP['hacked'] ได้ undefined จึงเก็บสถานะนอก enum ได้ ขณะที่ PATCH บังคับ change_status (developer+) ที่ [code]/route.ts:56-59

### #9 อัปโหลดไม่ต้อง login + Stored XSS ผ่าน text/html/SVG ✔Lead
- ที่: `app/api/upload/route.ts:63` · security
- ปัญหา: /api/upload (รวมถึง body.files ใน POST issues และ comments) ไม่ตรวจ session และให้ client กำหนด mimeType เองได้ จากนั้น /api/files/[...key] (line 20) ส่งไฟล์กลับด้วย Content-Type เดิมจาก origin เดียวกัน โดยไม่มี Content-Disposition: attachment, X-Content-Type-Options หรือ CSP
- เกิดเมื่อ: ผู้โจมตีอัปโหลด {"filename":"a.svg","mimeType":"image/svg+xml","base64":"<svg onload=fetch('/api/auth/me',{method:'POST',...})>"} แล้วแนบไว้ใน issue เมื่อ admin คลิกรูป (FileAttachmentZone href={fileUrl(img)}) สคริปต์จะรันใน origin ของ IssueMate พร้อม cookie ของ admin และสั่ง API admin แทนได้ ไฟล์ text/html ก็ทำได้เหมือนกัน
- หลักฐาน: app/api/upload/route.ts:9-69 ไม่ตรวจ session และ :63 ใช้ item.mimeType จาก client; lib/minio.ts:88-95 เก็บเป็น ContentType; app/api/files/[...key]/route.ts:19-21 ส่ง Content-Type เดิมกลับโดยไม่มี Content-Disposition/nosniff/CSP (next.config.ts ไม่มี headers()); UI เปิดไฟล์ใน origin เดียวกันด้วย <a href={fileUrl(doc)} target=_blank> (components/ui/FileAttachmentZone.tsx:571-574) ไฟล์ text/html หรือ image/svg+xml จึงรันสคริปต์ใน origin ของแอปและเรียก API ด้วย cookie ของเหยื่อ (sameSite=lax + same-origin)

### #11 ออก MCP Token แทนอีเมลใครก็ได้ / ปิด enforceTokenAuth ได้ ✔Lead
- ที่: `app/api/mcp/tokens/route.ts:87` · authz
- ปัญหา: POST /api/mcp/tokens ไม่ต้อง login และใช้ body.ownerEmail ที่ส่งมาเองเพื่อออก token ในนามผู้ใช้คนนั้น (ให้ agentRole "admin" ได้) ส่วน action update_settings (line 81) ปิด enforceTokenAuth ได้โดยไม่เช็ค admin
- เกิดเมื่อ: คนนอกส่ง POST {"ownerEmail":"<อีเมล developer>","projectKey":"BC","agentRole":"admin"} ได้ rawToken ไปสั่ง MCP แก้/ปิด issue ในนาม developer คนนั้น หรือส่ง {"action":"update_settings","enforceTokenAuth":false} เพื่อปิดการบังคับใช้ token ของ MCP ทั้งระบบ
- หลักฐาน: app/api/mcp/tokens/route.ts:86-133 ไม่บังคับ login: ownerEmail = body.ownerEmail || currentUser?.email แล้ว generateMcpToken (lib/mcp-tokens.ts:91-173) เช็คแค่ว่าอีเมลนั้นอยู่ใน allowed_users และมีสิทธิ์ developer+ ของ 'อีเมลนั้น' ไม่ได้ตรวจว่าผู้เรียกเป็นเจ้าของ; คืน rawToken (:137) ให้ผู้เรียกทันที; agentRole 'admin' รับได้ (:122-125); นอกจากนี้ update_settings ที่ :81-84 ก็ไม่ตรวจสิทธิ์ (ซ้ำกับ #21)

### #22 MCP เปิดให้คนไม่ระบุตัวตนเขียนข้อมูลได้เป็นค่าเริ่มต้น ✔Lead
- ที่: `lib/mcp-tokens.ts:240` · authz
- ปัญหา: ถ้าไม่ได้แนบ token และ enforceTokenAuth=false (ค่า default คือ Boolean(undefined)=false ซึ่ง GET /api/mcp ที่ localhost:3300 ตอบมาแบบนี้จริง) ระบบจะอนุญาตเลย ทำให้ tokenUser เป็น undefined และ tool ทั้ง 14 ตัวทำงานแบบไม่มีการตรวจสิทธิ์รายโปรเจกต์ของ v3.1 เลย
- เกิดเมื่อ: ผู้ใช้ที่ Admin ตั้งสิทธิ์ไว้แค่ 'viewer' หรือคนนอกที่ไม่มีบัญชี ส่ง POST /api/mcp tools/call update_issue_status {code:'PRJA3712-101', status:'wont_fix', actor:'Admin'} โดยไม่แนบ token แล้วปิด Issue ได้สำเร็จ ทั้งที่หน้า UI (PATCH /api/issues/[code]) จะตอบ 403 ให้สิทธิ์ระดับนี้
- หลักฐาน: lib/mcp-tokens.ts:233-245 ถ้าไม่มี token และ enforceTokenAuth=false จะคืน allowed:true; getMcpAuthSettings คืน Boolean(undefined)=false เป็นค่าเริ่มต้น (:51) และ GET /api/mcp ที่ localhost:3300 ตอบ enforceTokenAuth:false จริง; app/api/mcp/route.ts:49-52 สร้าง server ด้วย tokenUser=undefined และ tool เขียนทุกตัวใน lib/mcp-server.ts (เช่น update_issue_status :907-909) เรียก updateIssue ตรงโดยไม่เรียก validateUserProjectAction (grep ไม่เจอใน mcp-server.ts)

### #23 Token ไม่ตรวจสิทธิ์รายโปรเจกต์ซ้ำตอนใช้งาน และ tool ไม่บังคับ permission
- ที่: `lib/mcp-tokens.ts:265` · authz
- ปัญหา: verifyMcpRequestToken ตรวจแค่ isEmailAllowed ไม่ได้ตรวจซ้ำ canUserAccessProject หรือ validateUserProjectAction กับ projectKey ของ token และไม่มี tool ไหนใน mcp-server.ts เรียก validateUserProjectAction ส่วน agentRole (claude_reviewer/antigravity_fixer/admin) ก็ไม่ถูกบังคับใช้ที่ไหนเลย
- เกิดเมื่อ: ผู้ใช้เป็น developer ใน PRJA แล้วสร้าง token ผูก PRJA ไว้ ต่อมา Admin ลดสิทธิ์เหลือ viewer หรือเอา PRJA ออกจาก allowedProjects (update_allowed_user ไม่ได้ลบ token) token เดิมก็ยังเรียก claim_for_fix, mark_deployed, update_issue_status, create_issue (type ใดก็ได้, status='ready_to_fix') ได้ตามปกติ และ token role 'claude_reviewer' ก็เรียก mark_deployed ได้
- หลักฐาน: lib/mcp-tokens.ts:265-271 ตอนใช้ token ตรวจแค่ isEmailAllowed(found.ownerEmail) ไม่ได้ตรวจ canUserAccessProject หรือ validateUserProjectAction ซ้ำ; update_allowed_user (me/route.ts:116-141 -> addAllowedUser) ไม่ลบ/ปรับ token; grep ยืนยันว่า agentRole ถูกใช้แค่แสดงผลใน get_ai_context (lib/mcp-server.ts:129) ไม่มีการบังคับใช้; tool claim_for_fix/mark_deployed/update_issue_status/create_issue ไม่มีการเช็คสิทธิ์

### #24 Token projectKey='ALL' ข้ามข้อจำกัดโปรเจกต์ของสมาชิก
- ที่: `lib/mcp-tokens.ts:122` · authz
- ปัญหา: canUserAccessProject คืน true เสมอเมื่อ projectKey='ALL' (permissions.ts:154) และ getUserProjectPermission ที่ 'ALL' ข้ามการตรวจ access แล้ว fallback ไปใช้ defaultPermission ทำให้สมาชิกที่ถูกจำกัดโปรเจกต์สร้าง token แบบ ALL ได้ จากนั้น verifyMcpRequestToken (บรรทัด 286-287) จะใช้ requestProject จาก header/query โดยไม่ตรวจสิทธิ์
- เกิดเมื่อ: สมาชิก allowedProjects=['PRJA'], defaultPermission='developer' (ตั้งค่า DEFAULT ได้ใน GoogleLoginModal) ส่ง POST token {projectKey:'ALL'} ได้ token ที่ไม่ผูกโปรเจกต์ แล้วเรียก MCP ด้วย X-MCP-Project: PRJB หรือส่ง projectKey:'PRJB' ใน args แล้ว list/get/update/mark_deployed Issue ของ PRJB ที่ไม่มีสิทธิ์เข้าถึงได้ ในทำนองเดียวกันถ้า projectPermissions.PRJA='viewer' แต่ default='developer' token ALL ก็ได้สิทธิ์ developer ใน PRJA
- หลักฐาน: route รับ projectKey 'ALL' ได้ (app/api/mcp/tokens/route.ts:101-104); generateMcpToken: canUserAccessProject(user,'ALL') คืน true (lib/permissions.ts:154) และ getUserProjectPermission ที่ 'ALL' ข้ามการตรวจ access (:175) แล้ว map ของผู้ใช้ allowedProjects ['PRJA'] ไม่มี key ALL จึงตกไป defaultPermission (:185) ถ้าเป็น developer ก็ผ่าน; จากนั้น verifyMcpRequestToken (lib/mcp-tokens.ts:273-287) ใช้ requestProject จาก header/query เมื่อ token เป็น ALL โดยไม่ตรวจสิทธิ์ จึงเข้าถึง PRJB ได้

### #25 ใครก็ยกเลิก (ลบ) MCP Token ของคนอื่นได้ ✔Lead
- ที่: `app/api/mcp/tokens/route.ts:155` · authz
- ปัญหา: DELETE /api/mcp/tokens?id= ไม่ตรวจ session หรือความเป็นเจ้าของ token ส่วน revokeMcpToken ก็ deleteOne({id}) ตรงๆ และ GET /api/mcp/tokens ที่ไม่ต้องล็อกอินก็คืน id ของ token ทุกตัว
- เกิดเมื่อ: ผู้ใช้นิรนามเรียก GET /api/mcp/tokens เพื่อเอา id ทั้งหมด (tok_xxxx) แล้วยิง DELETE ?id=... ไล่ทีละตัว token ของ Antigravity ทุกโปรเจกต์ถูกลบถาวร agent ทั้งหมดได้ 401 'Invalid or revoked MCP Token' (DoS) ผู้ใช้ทั่วไปใน UI ก็กดปุ่ม revoke token ของ Admin ได้เช่นกัน
- หลักฐาน: app/api/mcp/tokens/route.ts:148-161 DELETE ไม่เรียก getCurrentUser และไม่เช็คความเป็นเจ้าของ แล้ว revokeMcpToken ทำ deleteOne({id}) (lib/mcp-tokens.ts:176-180); GET ที่ :19-70 ไม่ต้อง login และคืน tokens พร้อม id ทุกตัว (listMcpTokens :83-88 ตัดแค่ tokenHash) จึงไล่ลบ token ของทุกคนได้

### #10 SESSION_SECRET มีค่า default ปลอมแปลง session ได้ ✔Lead (PLAUSIBLE)
- ที่: `lib/auth.ts:199` · authentication
- ปัญหา: ถ้าไม่ได้ตั้ง env SESSION_SECRET จะใช้ค่าคงที่ "issuemate-default-session-key" ที่อยู่ใน source (ตอนนี้ .env.local ก็ไม่มี SESSION_SECRET) token ไม่มีวันหมดอายุ และเทียบลายเซ็นแบบไม่ constant-time (line 509)
- เกิดเมื่อ: ผู้โจมตีสร้าง payload {"email":"<super admin>"} แล้ว HMAC-SHA256 ด้วย key default ตั้งเป็น cookie issuemate_session แล้ว getCurrentUser ยอมรับและคืน isAdmin=true ได้ทันทีในทุก deployment ที่ลืมตั้ง env
- หลักฐาน: lib/auth.ts:198-199 fallback 'issuemate-default-session-key' อยู่ในซอร์ส; .env.local ของเครื่องนี้ไม่มี SESSION_SECRET (นับได้ 0) แต่ .env.example:18 มีระบุไว้ จึงไม่แน่ว่า prod ตั้งไว้หรือไม่; verifySessionToken (:501-515) ไม่มี exp และเทียบด้วย !== ; getCurrentUser (:517-548) อ่านสิทธิ์จาก allowed_users ตาม email ใน payload จึงปลอม cookie ได้ทันทีถ้าไม่ได้ตั้ง env (เงื่อนไขที่ยืนยันไม่ได้: ค่า env บน production)

## MEDIUM (20)

### #12 projectKey ที่ใช้เช็คสิทธิ์ normalize ไม่ตรงกับตอนบันทึก
- ที่: `app/api/issues/route.ts:54` · authz
- ปัญหา: ตอนเช็คสิทธิ์ใช้ trim().toUpperCase() แต่ createIssue ใช้ normalizeProjectKey ที่ตัดอักขระที่ไม่ใช่ A-Z0-9 ออกและ slice(0,10) ถ้าใส่ขีดหรือจุดใน key ก็ lookup ไม่เจอ projectPermissions[key] แล้วตกไปใช้สิทธิ์ ALL
- เกิดเมื่อ: ผู้ใช้ที่ allowedProjects=["ALL"] (default reporter) แต่ตั้ง projectPermissions {XYZ:"viewer"} ส่ง POST /api/issues {projectKey:"X-YZ",type:"bug"} ตอนเช็คได้ map.ALL=reporter จึงผ่าน แต่ createIssue บันทึกลงโปรเจกต์ XYZ ที่เขามีสิทธิ์แค่ดู ใช้หลบข้อจำกัด question_only ได้แบบเดียวกัน
- หลักฐาน: app/api/issues/route.ts:54 projectKey ใช้แค่ trim().toUpperCase() ('X-YZ') ส่วน createIssue ใช้ normalizeProjectKey ตัดอักขระและ slice(0,10) (lib/issue-service.ts:20-26, 310) -> 'XYZ'; normalizeProjectPermissionsMap สำหรับ allowedProjects ['ALL'] + {XYZ:'viewer'} ได้ {XYZ:'viewer', ALL:'reporter'} (permissions.ts:67-98) แล้ว getUserProjectPermission(user,'X-YZ') หา map['X-YZ'] ไม่เจอ ตกไป map.ALL='reporter' (:179-184) จึงผ่าน create_issue แต่บันทึกลง XYZ ที่ตั้งไว้เป็น viewer

### #13 reporter/question_only ตั้ง status/reviewMeta ได้ตอนสร้าง ✔Lead
- ที่: `app/api/issues/route.ts:130` · authz
- ปัญหา: POST /api/issues ส่ง body.status, reviewMeta, devopsMeta, assignee, aiSummary ต่อให้ createIssue ตรงๆ โดยเช็คแค่ create_issue ทำให้ผู้ที่ไม่มีสิทธิ์ change_status กำหนดสถานะและผลรีวิวเองได้ และไม่ได้ตรวจว่าค่าเป็น enum ที่อนุญาต
- เกิดเมื่อ: ผู้ใช้ question_only ส่ง {type:"question",status:"ready_to_fix",reviewMeta:{decision:"fix",fixInstructions:"rm -rf"}} ได้ issue ที่ข้ามขั้นรีวิวไปอยู่คิว "รอแก้" ให้ Antigravity/MCP หยิบไปแก้โค้ดทันที หรือส่ง status:"foo" จนข้อมูลสถานะเสีย
- หลักฐาน: app/api/issues/route.ts:68-81 เช็คแค่ create_issue แล้ว :130-144 ส่ง body.status, reviewMeta, devopsMeta, assignee, aiSummary ให้ createIssue ตรงๆ; createIssue (lib/issue-service.ts:341, 357, 374-376) ใช้ input.status || 'open' โดยไม่ตรวจ enum และตั้ง reviewMeta.decision='fix' เมื่อ status=ready_to_fix จึงข้ามขั้นรีวิวได้ ผู้ใช้ question_only ที่ไม่มีสิทธิ์ change_status (lib/auth.ts:158-166) จึงกำหนดสถานะเองได้

### #15 ข้อความ error เผยอีเมล Super Admin เต็มให้คนนอก
- ที่: `app/api/auth/google/callback/route.ts:92` · privacy
- ปัญหา: เมื่อ Gmail ไม่อยู่ใน allowed_users ระบบ redirect พร้อม google_auth_error ที่ใส่ SUPER_ADMIN_EMAIL แบบไม่ mask ซึ่งขัดกับการใช้ maskEmail ที่อื่น และอีเมลนี้พอสำหรับล็อกอิน/ยึด admin ผ่าน POST /api/auth/me
- เกิดเมื่อ: คนนอกกดล็อกอิน Google ด้วยบัญชีใดก็ได้ แล้วได้ URL /?google_auth_error=...ติดต่อ Admin (<อีเมลจริงของ super admin>) จากนั้นเอาไปส่ง POST /api/auth/me {email:<นั้น>} ก็ได้ session admin
- หลักฐาน: app/api/auth/google/callback/route.ts:89-94 เมื่อ getAllowedUser(email) ไม่เจอ จะ redirect ด้วยข้อความที่มี SUPER_ADMIN_EMAIL (ค่าจาก env ใน lib/auth.ts:5-11) เต็มโดยไม่ mask ขณะที่ที่อื่นใช้ maskEmail (me/route.ts:58); page.tsx:194-200 แสดงข้อความนี้ให้ผู้ใช้เห็น ใครที่มีบัญชี Google ก็ได้อีเมลนี้ไปใช้กับ #0/#1

### #16 maskEmail ไม่ได้ผล: name เปิดเผย local-part ของอีเมล
- ที่: `app/api/auth/me/route.ts:41` · privacy
- ปัญหา: GET /api/auth/me ส่ง allowedUsers ทั้งหมดให้คนที่ไม่ได้ล็อกอินด้วย โดยมี name, jobTitle, projectPermissions, lastLoginAt ครบ ซึ่ง name ไม่ถูก mask ทั้งที่ UI/addAllowedUser ตั้ง name เป็นค่า default = email.split("@")[0] เมื่อเอามารวมกับ domain จาก maskEmail ก็ได้อีเมลเต็ม
- เกิดเมื่อ: Admin เพิ่ม somchai.k@gmail.com โดยไม่กรอกชื่อ คนนอกเรียก GET /api/auth/me ได้ {email:"s***k@gmail.com",name:"somchai.k"} จึงรู้อีเมลเต็มของสมาชิก รวมถึงรายชื่อสิทธิ์ของทุกคน (ยืนยันด้วย curl แล้วว่าไม่มี cookie ก็ได้ allowedUsers 3 รายการพร้อม projectPermissions)
- หลักฐาน: app/api/auth/me/route.ts:37-54 สำหรับผู้ที่ไม่ใช่ admin ส่ง name ของผู้ใช้ที่ไม่ใช่ super admin แบบไม่ mask พร้อม jobTitle/allowedProjects/projectPermissions/lastLoginAt (...u); addAllowedUser ตั้งชื่อ default = cleanEmail.split('@')[0] (lib/auth.ts:349-352) และ login ด้วยอีเมล (me/route.ts:196, 204) ก็เขียน name = local-part ได้; maskEmail (lib/auth.ts:13-20) เผย domain และตัวอักษรแรก/ท้าย รวมกันจึงได้อีเมลเต็ม; curl ไม่มี cookie ได้ allowedUsers 3 รายการพร้อม projectPermissions จริง (ข้อมูลปัจจุบันตั้งชื่อเองไว้ จึงยังไม่หลุดใน DB นี้)

### #17 Admin ทั่วไปเปลี่ยน Super Admin ได้ (ขัดกับข้อความสิทธิ์)
- ที่: `app/api/auth/me/route.ts:95` · authz
- ปัญหา: change_super_admin ใช้ isCallerAdmin ซึ่งเป็น true สำหรับ admin ทุกคน ไม่ได้จำกัดเฉพาะ Super Admin อย่างที่ข้อความ error บอก และ setSuperAdminEmail ไม่ลดสิทธิ์ Super Admin เดิม
- เกิดเมื่อ: admin ธรรมดาส่ง {action:"change_super_admin",newAdminEmail:<ตัวเอง>} แล้วกลายเป็น Super Admin ต่อด้วย remove_allowed_user อีเมลเจ้าของเดิม (ซึ่งไม่ได้ถูกป้องกันในฐานะ super admin แล้ว) ทำให้เจ้าของระบบถูกล็อกออกและ MCP token ของเขาถูกลบ
- หลักฐาน: app/api/auth/me/route.ts:89-91 isCallerAdmin เป็น true สำหรับ admin ทุกคน (currentUser.isAdmin) และ change_super_admin ที่ :94-103 ใช้เงื่อนไขนี้ ขัดกับข้อความ error ที่ :98; setSuperAdminEmail (lib/auth.ts:37-69) เปลี่ยน super_admin_config แล้ว addAllowedUser คนใหม่ ส่วนคนเดิมเหลือแค่ role admin ธรรมดา removeAllowedUser (:395-407) ป้องกันเฉพาะ getSuperAdminEmail() ตัวปัจจุบัน จึงลบเจ้าของเดิมพร้อม mcp_tokens ของเขาได้

### #28 claim_for_fix ไม่ตรวจสถานะและไม่ atomic ทำให้ agent ชนกันได้
- ที่: `lib/mcp-server.ts:304` · race
- ปัญหา: claim_for_fix ไม่ตรวจว่า status เป็น 'ready_to_fix' และ updateIssue ใช้ findOne แล้ว $set โดยไม่ใส่เงื่อนไข status ใน filter (ไม่ใช่ compare-and-set) mark_deployed ก็ไม่ตรวจว่าเป็น 'fixing'
- เกิดเมื่อ: Antigravity 2 ตัว (token คนละใบ) เรียก claim_for_fix กับ PRJA-101 พร้อมกัน ทั้งคู่ได้ผลสำเร็จ แล้วต่างคนต่างแก้โค้ดและ deploy ซ้อนกัน ผู้เขียนคนหลังทับ assignee/fixedBy ของคนแรก อีกกรณีคือเรียก claim_for_fix กับ Issue ที่ 'deployed' หรือ 'wont_fix' แล้ว Issue ถูกเปิดกลับเป็น fixing และ closedAt ถูกล้าง หรือ mark_deployed กับ Issue 'open' ที่ยังไม่ผ่านรีวิว
- หลักฐาน: lib/mcp-server.ts:301-311 claim_for_fix เรียก updateIssue(status:'fixing') โดยไม่เช็คสถานะเดิม; updateIssue (lib/issue-service.ts:449, 634) ใช้ findOne แล้ว updateOne({code}) ไม่มีเงื่อนไข status ใน filter จึงไม่ใช่ compare-and-set ทั้งสอง agent ได้ผลสำเร็จและคนหลังทับ assignee/fixedBy; ถ้าเดิมเป็น deployed/wont_fix บรรทัด 618-620 จะล้าง closedAt/closedBy แล้วเปิดงานกลับ; mark_deployed (:341-367) ก็ไม่เช็ค 'fixing'

### #29 คอมเมนต์/timeline หายเมื่อมีการเขียนพร้อมกัน (lost update)
- ที่: `lib/issue-service.ts:712` · data-integrity
- ปัญหา: addIssueComment และ updateIssue (บรรทัด 634) อ่านเอกสารมาก่อน แล้ว $set ทั้งอาร์เรย์ comments/timeline ทับกลับไป ไม่ได้ใช้ $push หรือ version check ส่วน tool MCP อย่าง submit_claude_review, mark_deployed, converse_on_issue เรียก updateIssue แล้วต่อด้วย addIssueComment เป็น read-modify-write สองรอบ
- เกิดเมื่อ: ผู้ใช้ส่งคอมเมนต์ผ่าน UI ในจังหวะที่ Antigravity เรียก mark_deployed กับ Issue เดียวกัน ฝั่งหนึ่งอ่าน comments ชุดเก่าแล้ว $set ทับ ทำให้คอมเมนต์ของผู้ใช้หรือ timeline event 'deployed' หายถาวร
- หลักฐาน: addIssueComment (lib/issue-service.ts:653, 667-668, 712) อ่าน doc แล้ว $set comments/timeline ทั้งอาร์เรย์ทับ ส่วน updateIssue (:449, 456, 632-634) $set timeline ทั้งอาร์เรย์ (และ comments เมื่อ toggleCommentReaction :579) ไม่มี $push หรือ version check; mark_deployed/submit_claude_review (lib/mcp-server.ts:356-374, 232-265) เรียก updateIssue ตามด้วย addIssueComment เป็นการอ่าน-แก้-เขียนสองรอบ ถ้า POST comments จาก UI แทรกระหว่างนั้น ข้อมูลของฝั่งหนึ่งจะหาย

### #41 Lost update: เขียนทับ timeline/comments ทั้ง array
- ที่: `lib/issue-service.ts:632` · race
- ปัญหา: updateIssue/addIssueComment อ่านเอกสาร (findOne) แล้ว $set timeline, comments, subtasks, upvotedBy, reactions, attachments ทั้งก้อนที่คำนวณจากสำเนาเก่า (บรรทัด 579, 609, 632, 634, 712) ไม่ใช้ $push/$inc หรือ version check และ updateFields.timeline ถูก set ทุกครั้งแม้ PATCH ที่ไม่เกี่ยวกับ timeline
- เกิดเมื่อ: คนตอบ comment พร้อมกับ agent เรียก submit_claude_review/mark_deployed (หรือกด toggleCommentReaction) ในช่วงมิลลิวินาทีเดียวกัน: ฝ่ายที่เขียนทีหลังเขียนทับ comments/timeline ของอีกฝ่าย -> ข้อความตอบหายเงียบๆ, event 'deployed' หายจาก timeline/recentActivities; โหวตพร้อมกัน 2 คนเหลือ upvotedBy แค่คนสุดท้าย
- หลักฐาน: lib/issue-service.ts:449-450 findOne แล้ว :456 คัดลอก timeline เดิม, :579-584 comments, :609 upvotedBy, :591 attachments และ :632 updateFields.timeline = newTimeline ทุก PATCH (รวม upvote) แล้ว :634 $set ทั้งก้อนไม่มี version filter; addIssueComment :667-712 ทำแบบเดียวกัน; ไม่มี transaction/$push ใดๆ ดังนั้นสอง request ที่ interleave ระหว่าง findOne กับ updateOne จะเขียนทับกัน (หน้าต่างแคบแต่เกิดได้จริง เช่น submit_claude_review เรียก updateIssue แล้ว addIssueComment ต่อกัน mcp-server.ts:232-264)

### #47 cache clientPromise ที่ reject ไว้ถาวร ✔Lead
- ที่: `lib/mongodb.ts:29` · correctness
- ปัญหา: getMongoClient เก็บ client.connect() ลง globalThis ทันที ถ้า connect ครั้งแรกล้มเหลว (Mongo ยังไม่พร้อมตอน container start, timeout 5 วินาที) promise ที่ reject ถูกใช้ซ้ำตลอดอายุ process
- เกิดเมื่อ: แอปบูตก่อน MongoDB พร้อม -> request แรกล้ม และ Mongo ขึ้นมาแล้วทุก request ยังตอบ 500 จนกว่าจะ restart process
- หลักฐาน: lib/mongodb.ts:23-31 เก็บ client.connect() ลง globalForMongo.clientPromise ทันทีและไม่มี .catch ที่รีเซ็ตค่า; serverSelectionTimeoutMS 5000 (:27) ทำให้ connect reject เมื่อ Mongo ยังไม่พร้อม; getDb (:238-243) await promise เดิมทุกครั้ง -> ทุก request 500 ถาวรจนกว่าจะ restart process (process ไม่ crash จึงไม่ถูก restart อัตโนมัติ)

### #56 ปุ่มเลื่อนสถานะใน Kanban ไม่เช็กสิทธิ์ และล้มเหลวแบบเงียบ
- ที่: `components/KanbanBoardView.tsx:125` · authz
- ปัญหา: ปุ่ม onQuickStatusChange แสดงให้ทุกระดับสิทธิ์ (viewer/question_only/reporter) แต่ PATCH /api/issues/[code] เรียก validateUserProjectAction(...,'change_status') ซึ่งปฏิเสธต่ำกว่า developer ด้วย 403 และ handleUpdateIssue (page.tsx:349-367) ตรวจแค่ if (res.ok) ถ้าไม่ ok ไม่ทำอะไรและไม่แจ้งผู้ใช้ KanbanBoardView ไม่ได้รับ userPermission เลย
- เกิดเมื่อ: ผู้ใช้สิทธิ์ reporter กดปุ่ม 'Antigravity เริ่มรีวิว' ที่การ์ด -> server ตอบ 403 แต่หน้าจอไม่มีข้อความใดๆ การ์ดไม่ขยับ ผู้ใช้เข้าใจว่าระบบค้าง (แบบเดียวกันเกิดกับการแก้ title/type/priority/description ใน Drawer ที่ไม่ได้ gate ด้วย canManageStatus: editor ปิดและค่ากลับเป็นเดิมเงียบๆ)
- หลักฐาน: components/KanbanBoardView.tsx:125-136 แสดงปุ่ม onQuickStatusChange ทุกการ์ดโดยไม่ได้รับ permission (ใช้ที่ app/page.tsx:1153-1157); handleQuickStatusChange -> handleUpdateIssue (page.tsx:349-366) ส่ง PATCH {status, actor} โดยไม่มี actorEmail จึงใช้ sessionUser ซึ่งเป็น reporter -> [code]/route.ts:55-66 ตอบ 403 แต่ client เช็คแค่ if (res.ok) ไม่มี else แจ้งผู้ใช้ การ์ดจึงไม่ขยับแบบเงียบ

### #57 ส่งคอมเมนต์ไม่สำเร็จแต่ Drawer ล้างร่างข้อความทิ้ง ✔Lead
- ที่: `app/page.tsx:397` · correctness
- ปัญหา: handleAddComment (และ handleUpdateIssue/handleDeleteIssue) ไม่ throw เมื่อ res.ok เป็น false จึง resolve ปกติ ทำให้ IssueDetailDrawer.tsx:199-207 ทำ setCommentBody('') / setCommentAttachments([]) ต่อทันที, handleSaveReviewAndStatus แสดง 'บันทึกแล้ว' (บรรทัด 168) และปุ่มลบเรียก onClose() (บรรทัด 260-261) ทั้งที่ request ล้มเหลว
- เกิดเมื่อ: ผู้ใช้พิมพ์คำตอบยาวพร้อมแนบไฟล์ แล้ว POST /comments ได้ 403/400/500 (เช่น สิทธิ์ถูกเพิกถอน, Mongo ขัดข้อง) -> ข้อความและไฟล์แนบที่เลือกไว้ถูกล้าง ไม่มี error ผู้ใช้ต้องพิมพ์ใหม่ทั้งหมด; กรณีลบ Issue ล้มเหลว Drawer ปิดเหมือนลบสำเร็จ แต่รายการยังอยู่
- หลักฐาน: app/page.tsx:397-404 handleAddComment ทำงานเฉพาะ if (res.ok) ไม่ throw เมื่อ 4xx/5xx; components/IssueDetailDrawer.tsx:198-207 หลัง await onAddComment จึง setCommentBody('')/setCommentAttachments([]) ทุกกรณี; page.tsx:369-376 handleDeleteIssue ก็ไม่ throw และ IssueDetailDrawer.tsx:259-261 เรียก onClose() ต่อทันที; handleSaveReviewAndStatus (IssueDetailDrawer.tsx:166-168) แสดง savedReviewNotice หลัง onUpdate ที่ล้มเหลว (page.tsx:349-367 ไม่ throw) -> ข้อความ/ไฟล์ร่างหาย, Drawer ปิดเหมือนลบสำเร็จ, ขึ้น 'บันทึกแล้ว' ทั้งที่ล้มเหลว (กรณี network reject จะ throw จึงไม่ล้าง แต่ 403/500 ล้างแน่นอน)

### #59 refetch หลัง await ใช้ closure เก่า ทับข้อมูลโปรเจกต์/ตัวกรองใหม่
- ที่: `app/page.tsx:365` · race
- ปัญหา: handleUpdateIssue/handleDeleteIssue/handleAddComment เรียก await fetchAllData() หลัง await fetch ซึ่ง fetchAllData เป็น closure ของ render ตอนกด (selectedProjectKey/filters เก่า) แต่ได้ fetchId ใหม่ล่าสุด จึงชนะ guard latestFetchId และทับผลของ fetch ที่ตรงกับ state ปัจจุบัน (เกิดที่บรรทัด 365, 375, 404, 448)
- เกิดเมื่อ: อยู่โปรเจกต์ A กดเลื่อนสถานะ/ส่งคอมเมนต์ แล้วสลับไปโปรเจกต์ B ก่อน PATCH เสร็จ -> fetch ของ B (id=2) ถูกทิ้ง เพราะ fetch เก่าของ A (id=3) จบทีหลัง ทำให้หัวข้อและ select ขึ้น B แต่ตาราง/สถิติเป็นของ A จนกว่าจะเปลี่ยนตัวกรองอีกครั้ง (เช่นเดียวกับกรณีพิมพ์ค้นหาระหว่างรอ)
- หลักฐาน: handleUpdateIssue/handleDeleteIssue/handleAddComment (app/page.tsx:349-405) เป็นฟังก์ชันของ render ตอนกด จึงจับ fetchAllData เก่า (selectedProjectKey/filters เก่า) ไว้; หลัง await PATCH เรียก await fetchAllData() ที่ page.tsx:365/375/404 (และ void fetchAllData() ใน handleQuickUpvote :436) ซึ่งทำ ++latestFetchId.current (ref ร่วม, :211) ได้ id ใหม่สุด แล้ว guard :237 ปล่อยผลของ closure เก่าผ่าน -> สลับไปโปรเจกต์ B ระหว่าง PATCH ค้าง ผลของ A ทับตาราง/สถิติ ขณะหัวข้อแสดง B จนกว่า deps จะเปลี่ยนอีก

### #60 effect ใน CreateIssueModal รีเซ็ต type ที่ผู้ใช้เลือกเมื่อ projects/defaultProjectKey เปลี่ยน
- ที่: `components/Modals.tsx:253` · ui-state
- ปัญหา: useEffect deps [defaultProjectKey, projects, open, initialType] เรียก setType(initialType) ทุกครั้งที่ re-run ขณะที่ page ส่ง visibleProjects (page.tsx:455-462) ซึ่งเป็น array ใหม่ทุก render สำหรับสมาชิกที่ถูกจำกัดโปรเจกต์ และเป็น array ใหม่ทุกครั้งที่ fetchAllData เสร็จสำหรับ admin; อีกทั้งการกด pill โปรเจกต์ใน modal เรียก onProjectChange -> selectProject -> เปลี่ยน defaultProjectKey
- เกิดเมื่อ: กดปุ่ม 'แจ้งปัญหา' (preset bug) เลือกหัวข้อ 'ขอเพิ่มฟีเจอร์' แล้วคลิก pill โปรเจกต์อื่น -> หัวข้อเด้งกลับเป็น 'แจ้งปัญหา' (และเด้งอีกครั้งเมื่อ fetch เสร็จ) ผู้ใช้ส่งเรื่องผิดประเภทโดยไม่รู้ตัว
- หลักฐาน: components/Modals.tsx:253-263 effect deps [defaultProjectKey, projects, open, initialType] เรียก setType(initialType) ทุกครั้งที่รัน และ initialType ไม่เคย undefined (page.tsx:102-103 state เริ่ม 'bug', :1231 ส่งเข้า); คลิก pill -> handleSelectProjectKey (Modals.tsx:270-274) -> onProjectChange -> rememberSpecificProject -> selectProject (page.tsx:135-150,110-112) เปลี่ยน selectedProjectKey -> effectiveDefaultProjectKey (page.tsx:497-500) เปลี่ยน -> effect รัน setType('bug'); fetchAllData ที่ตามมา setProjects array ใหม่ (และ visibleProjects ของสมาชิกจำกัดเป็น filter() ใหม่ทุก render page.tsx:455-462) ทำให้รีเซ็ตซ้ำ

### #76 AiMcpGuideModal รีเซ็ตโปรเจกต์ที่เลือกกลับเป็นค่า default
- ที่: `components/Modals.tsx:778` · ui-state
- ปัญหา: useEffect บรรทัด 778-784 มี selectedProjectKey อยู่ใน deps และเมื่อ defaultProjectKey ไม่ใช่ "ALL" (page.tsx ส่ง effectiveDefaultProjectKey ซึ่งไม่เคยเป็น ALL) จะ setSelectedProjectKey(defaultProjectKey) ทุกครั้งที่ผู้ใช้เปลี่ยนค่าใน dropdown (บรรทัด 1078)
- เกิดเมื่อ: ผู้ใช้เปิด MCP Guide ขณะอยู่โปรเจกต์ A เลือกโปรเจกต์ B ใน dropdown เพื่อออก token ค่าเด้งกลับเป็น A ทันที จึงออก MCP Token ให้โปรเจกต์อื่นไม่ได้ หรือออกผิดโปรเจกต์โดยไม่รู้ตัว
- หลักฐาน: components/Modals.tsx:778-784 deps มี selectedProjectKey และ branch แรก setSelectedProjectKey(defaultProjectKey) เมื่อ defaultProjectKey !== 'ALL'; page.tsx:1254 ส่ง effectiveDefaultProjectKey ซึ่ง (page.tsx:497-500) ไม่มีทางเป็น 'ALL' (rememberSpecificProject :138 กัน ALL) -> ผู้ใช้เลือก B ใน select Modals.tsx:1078 -> state เปลี่ยน -> effect รันตั้งกลับเป็น A ทันที; activeProject (:819-821) ที่ใช้ออก token (:851) จึงเป็น A เสมอ

### #77 เปลี่ยนสิทธิ์เริ่มต้น (DEFAULT) ของผู้ใช้เดิมไม่มีผลจริง
- ที่: `components/GoogleLoginModal.tsx:228` · logic
- ปัญหา: handleUpdateExistingUserPermission เมื่อเลือก DEFAULT แก้เฉพาะ defaultPermission แต่ส่ง projectPermissions เดิมกลับไปด้วย ซึ่ง normalizeProjectPermissionsMap ได้เติมค่า (เช่น {ALL:"reporter"}) ไว้แล้ว และ getUserProjectPermission (lib/permissions.ts 178-185) ให้ map[proj]/map.ALL ชนะ defaultPermission เสมอ
- เกิดเมื่อ: แอดมินเปลี่ยนสิทธิ์เริ่มต้นของผู้ใช้ที่มี map {ALL:"reporter"} จาก reporter เป็น developer ระบบแจ้ง "อัปเดตเรียบร้อย" แต่ผู้ใช้ยังเป็น reporter ในทุกโปรเจกต์ เพราะ map.ALL ยังเป็น reporter และกดเปลี่ยนสถานะไม่ได้
- หลักฐาน: lib/auth.ts:242-247 listAllowedUsers คืน projectPermissions ที่ normalizeProjectPermissionsMap (lib/permissions.ts:88-97) เติม key ทุกโปรเจกต์ใน allowedProjects (หรือ ALL) ด้วย defaultPerm แล้ว; GoogleLoginModal.tsx:228-234 เมื่อเลือก DEFAULT ส่ง map เดิมนี้กลับไปพร้อม defaultPermission ใหม่; lib/auth.ts:343-348 normalize ซ้ำ key เดิมยังเป็นค่าเก่า (!result[cleanKey] เป็น false) แล้วบันทึก; getUserProjectPermission (lib/permissions.ts:179-184) ให้ map[proj]/map.ALL ชนะ defaultPermission -> การเปลี่ยนสิทธิ์เริ่มต้นไม่มีผลกับโปรเจกต์ใดเลย แต่ UI แจ้งสำเร็จ (:262-268)

### #78 useEffect([issue]) ล้างข้อความที่กำลังแก้ทุกครั้งที่ issue รีเฟรช
- ที่: `components/IssueDetailDrawer.tsx:99` · ui-state
- ปัญหา: effect บรรทัด 99-117 รีเซ็ต titleValue/descValue/editingTitle/editingDesc และทุกช่องของฟอร์ม review ทุกครั้งที่ object issue เปลี่ยน ซึ่ง page.tsx สร้างใหม่ทุกครั้งที่ fetchAllData/อัปโหลดไฟล์/upvote/คอมเมนต์สำเร็จ ไม่ใช่เฉพาะตอนเปลี่ยน issue.code
- เกิดเมื่อ: ผู้ใช้กำลังพิมพ์คำอธิบายใหม่ยาวๆ หรือกรอกเหตุผล review/คำสั่งแก้ไขค้างไว้ แล้วอัปโหลดไฟล์แนบด้านบน (ซึ่งเรียก onUpdate แล้วรีเฟรช issue) ข้อความที่ยังไม่บันทึกหายและโหมดแก้ไขปิดเอง
- หลักฐาน: components/IssueDetailDrawer.tsx:99-117 useEffect([issue]) รีเซ็ต titleValue/descValue/editingTitle/editingDesc และทุกช่อง review ทุกครั้งที่ reference ของ issue เปลี่ยน; อัปโหลดไฟล์ใน FileUploadZone (IssueDetailDrawer.tsx:430-434) เรียก onUpdate -> page.tsx:358-363 setSelectedIssue(data.issue) object ใหม่ แล้ว fetchAllData :242-248 set refreshed object ใหม่อีก; เช่นเดียวกับเปลี่ยน type/priority (:351-368) -> ข้อความ description/เหตุผลรีวิวที่ยังไม่บันทึกหาย

### #82 ปุ่มส่งไม่รอไฟล์ที่กำลังอัปโหลด ไฟล์หายจากคอมเมนต์/Issue
- ที่: `components/ui/FileAttachmentZone.tsx:56` · ui-state
- ปัญหา: handleFiles เก็บสถานะอัปโหลดไว้ใน uploadingCount ภายในคอมโพเนนต์เท่านั้น (บรรทัด 40, 56) ไม่ส่งออกให้ parent จึงไม่มี disabled บนปุ่มส่งของ CreateIssueModal (Modals.tsx ~667-672 ปิดเฉพาะ isSaving/isViewOnly) และฟอร์มตอบใน IssueDetailDrawer (บรรทัด 678-753); ผลอัปโหลดเรียก onChange ภายหลังจึงอาจมาทับ state ที่ส่งไปแล้ว
- เกิดเมื่อ: ผู้ใช้วางภาพจาก clipboard (หรือเลือกไฟล์ใหญ่ใกล้ 50MB) แล้วกดส่งทันทีระหว่างที่อัปโหลดยังไม่เสร็จ Issue/คอมเมนต์ถูกสร้างโดยไม่มีไฟล์แนบ ส่วนไฟล์ที่อัปโหลดเสร็จทีหลังค้างเป็นไฟล์กำพร้าใน MinIO และโผล่ในร่างฟอร์มที่ถูกรีเซ็ตแล้ว
- หลักฐาน: components/ui/FileAttachmentZone.tsx:40,56,80 uploadingCount เป็น state ภายในไม่ส่งออก; ปุ่มส่งใน Modals.tsx:670 disabled แค่ isSaving||isViewOnly และฟอร์มตอบ IssueDetailDrawer.tsx:716-719,736-739 disabled แค่ submitting/ว่าง -> กดส่งระหว่างอัปโหลด POST ไปโดยไม่มีไฟล์ (Modals.tsx:323 ส่ง attachments ปัจจุบัน); เมื่ออัปโหลดเสร็จ :74 onChange([...attachmentsRef.current, ...uploaded]) ไปเติมใน state ที่ถูกรีเซ็ตแล้ว (CreateIssueModal ยัง mount เพราะ return null หลัง hooks ที่ Modals.tsx:299) ไฟล์จึงไปโผล่ในร่างใหม่/ค้างใน MinIO

### #88 UI ไม่จัดการ response ที่ไม่ ok ทำให้ข้อมูลหายแบบเงียบ
- ที่: `app/page.tsx:358` · ui-state
- ปัญหา: handleUpdateIssue (358), handleDeleteIssue (373) และ handleAddComment (397) ตรวจ res.ok แล้วไม่ทำอะไรเมื่อ 403/400 ไม่มี error ให้ผู้ใช้เห็น และ throw ไม่ได้ จึงทำให้ IssueDetailDrawer.tsx:168 แสดง 'บันทึกแล้ว' เสมอ (153-173), handleSendComment ล้าง draft และไฟล์แนบเสมอ (191-211) และแก้หัวข้อแล้วปิดช่องแก้ (309-312) เสมอ
- เกิดเมื่อ: ผู้ใช้ reporter พิมพ์คำตอบพร้อมแนบ PDF ในเรื่องของโปรเจกต์ที่ตัวเองเป็น viewer เซิร์ฟเวอร์ตอบ 403 แต่ข้อความและไฟล์ที่แนบหายจากกล่อง ไม่มีข้อความผิดพลาด ผู้ใช้เชื่อว่าส่งสำเร็จ หรือกดบันทึก review ที่ถูกปฏิเสธก็ยังเห็น 'บันทึกแล้ว'
- หลักฐาน: app/page.tsx:358-366, :373-376, :397-405 เช็ค res.ok แล้วไม่ทำอะไรเมื่อไม่ ok และไม่ throw; components/IssueDetailDrawer.tsx:167-169 setSavedReviewNotice(true) เสมอ, :201-203 ล้าง commentBody/commentAttachments เสมอ, แก้คำอธิบาย/หัวข้อแล้วปิดช่องแก้เสมอ; เส้นทางที่เกิดได้จริงคือ reporter ล็อกอินแก้ priority/title/description (ไม่ถูกซ่อนตาม #89) -> route :55-66 ตอบ 403 -> ค่าเด้งกลับเงียบๆ; ส่วน scenario viewer ตอบคอมเมนต์ไม่ตรง เพราะ :678 ซ่อนฟอร์มเมื่อ !canComment แต่ 400 อื่นๆ (เช่น error service) ก็ล้าง draft ได้เหมือนกัน

### #18 body.files ใน issues/comments ไม่จำกัดขนาด/จำนวน (PLAUSIBLE)
- ที่: `app/api/issues/route.ts:91` · security
- ปัญหา: POST /api/issues และ POST comments (line 55) decode base64 ของ body.files แล้วอัปโหลดขึ้น MinIO โดยไม่มีเพดาน 50MB แบบ /api/upload และไม่จำกัดจำนวนไฟล์ ส่วน /api/upload เองก็อ่าน body ทั้งก้อน (req.json/req.formData) เข้าหน่วยความจำก่อนเช็คขนาด
- เกิดเมื่อ: คนที่ไม่ได้ล็อกอินส่ง POST /api/issues ที่มี files เป็น base64 รวมหลายร้อย MB ทำให้ Node process กินหน่วยความจำจน OOM และ MinIO เต็ม เพราะไม่มีการยืนยันตัวตนกันไว้
- หลักฐาน: app/api/issues/route.ts:91-107 และ comments/route.ts:55-76 decode base64 ของ body.files แล้วอัปโหลดขึ้น MinIO โดยไม่มีเพดานขนาดหรือจำนวนไฟล์ (ต่างจาก MAX_FILE_SIZE ใน app/api/upload/route.ts:7, 54) และไม่ต้อง login; App Router route handler ไม่มี body size limit ค่าเริ่มต้น และไม่มี middleware; ความรุนแรงจริงขึ้นกับว่า reverse proxy (Caddy) ตั้ง request_body max_size ไว้หรือไม่ ซึ่งไม่มีใน repo

### #39 seed version ไม่ตรง = ลบ Issue ทั้ง DB อัตโนมัติ ✔Lead (PLAUSIBLE)
- ที่: `lib/mongodb.ts:174` · data-integrity
- ปัญหา: ensureIndexesAndSeed ลบ issues.deleteMany({}) และไฟล์แนบทั้งหมดทุกครั้งที่ system_meta.seed_version ไม่มี/ต่ำกว่า CURRENT_SEED_VERSION(6) โดยไม่มีการป้องกัน NODE_ENV/ยืนยัน และตอน cold start หลาย request ขนาน (projects/issues/monitor) ต่างรัน wipe พร้อมกันเพราะ seededVersion ยังไม่ถูกตั้ง
- เกิดเมื่อ: (1) dev แก้ CURRENT_SEED_VERSION เป็น 7 แล้ว deploy -> request แรกหลัง restart ลบ Issue/ไฟล์แนบ production ทั้งหมด (2) restore DB จาก backup ที่ไม่มี collection system_meta หรือเปลี่ยน MONGODB_DB -> ถูก wipe ทันที (3) cold start: request A ผ่าน wipe แล้วผู้ใช้สร้าง Issue SMLAIACC-101 ส่วน request B ที่อ่าน seedMeta ก่อนหน้า (ยังไม่มี version) รัน deleteMany({}) ทีหลัง -> Issue ที่เพิ่งสร้างหาย
- หลักฐาน: lib/mongodb.ts:164-177 ถ้า system_meta.seed_version ไม่มีหรือ < CURRENT_SEED_VERSION จะ deleteMany({}) ทุก Issue+ไฟล์แนบ โดยไม่มี guard NODE_ENV; :121 seededVersion ตั้งเฉพาะตอนจบ (:235) จึง cold start ขนานรัน wipe ซ้ำได้ แต่ diff ปัจจุบันไม่ได้เปลี่ยน CURRENT_SEED_VERSION (HEAD ก็เป็น 6 ที่บรรทัด 34) ดังนั้นความเสียหายต้องอาศัยเหตุการณ์ในอนาคต (bump version / DB ไม่มี system_meta) ที่ยังยืนยันไม่ได้ว่าจะเกิด

## LOW (33)

### #14 ตรวจ OAuth state แบบ fail-open (Login CSRF)
- ที่: `app/api/auth/google/callback/route.ts:38` · authentication
- ปัญหา: เงื่อนไข `savedState && state && savedState !== state` จะปฏิเสธเฉพาะเมื่อมีทั้ง cookie และพารามิเตอร์แต่ค่าไม่ตรงกัน ถ้าไม่มี cookie หรือไม่ส่ง state มาก็ผ่าน การป้องกัน CSRF ของ OAuth จึงไม่ทำงาน
- เกิดเมื่อ: ผู้โจมตี (ผู้ใช้ viewer ที่อยู่ใน allowed_users) เอา code จาก Google ของบัญชีตัวเองไปส่งลิงก์ /api/auth/google/callback?code=<code> (ไม่มี state) ให้ admin กด แล้ว session ของ admin ถูกแทนด้วยบัญชีผู้โจมตีโดยไม่รู้ตัว ข้อมูลที่ admin กรอกต่อจากนั้นจะถูกบันทึกในนามผู้โจมตี
- หลักฐาน: app/api/auth/google/callback/route.ts:37-42 ปฏิเสธเฉพาะเมื่อมีทั้ง savedState และ state แต่ไม่ตรงกัน ถ้าไม่ส่ง ?state= หรือไม่มี cookie ก็ผ่าน (แม้ app/api/auth/google/route.ts:19-32 จะสร้าง state ไว้) จึงเกิด login CSRF ได้ด้วย code ของบัญชีผู้โจมตี ให้ระดับ low เพราะมีช่องล็อกอินด้วยอีเมลอย่างเดียว (#0) ซึ่งร้ายแรงกว่าอยู่แล้ว

### #19 เช็ค role === "admin" แต่ session role คือ jobTitle
- ที่: `lib/permissions.ts:152` · authz
- ปัญหา: getCurrentUser ตั้ง role = allowed.jobTitle || parsed.role (lib/auth.ts:543) ขณะที่ canUserAccessProject และ getUserProjectPermission ให้สิทธิ์ admin เต็มเมื่อ user.role === "admin" ข้อความตำแหน่งงานจึงกลายเป็นตัวให้สิทธิ์
- เกิดเมื่อ: Admin ตั้ง jobTitle ของสมาชิก viewer ที่ได้แค่ PRJA เป็น "admin" (ตั้งใจเป็นแค่ชื่อตำแหน่ง) ผลคือสมาชิกคนนั้นได้ project_admin ทุกโปรเจกต์ และลบ issue ของ PRJB ได้ แม้ isAdmin=false
- หลักฐาน: lib/auth.ts:543 getCurrentUser ตั้ง role = allowed.jobTitle || parsed.role แล้ว lib/permissions.ts:152 และ :173 ให้สิทธิ์เต็มเมื่อ user.role === 'admin'; jobTitle เป็นข้อความอิสระที่ admin กรอกได้ (me/route.ts:139, lib/auth.ts:353-355) ถ้าตั้งเป็น 'admin' ตรงตัว ผู้ใช้ member ที่ถูกจำกัดโปรเจกต์จะได้ project_admin ทุกโปรเจกต์ผ่าน session ต้องตั้ง jobTitle ตรงคำว่า 'admin' (case-sensitive) จึงเกิดได้น้อย

### #20 session cookie ไม่มี secure flag และไม่เช็ค email_verified
- ที่: `app/api/auth/google/callback/route.ts:142` · authentication
- ปัญหา: cookie issuemate_session ไม่ได้ตั้ง secure:true บนโดเมน HTTPS และ callback ใช้ profile.email (line 85) โดยไม่ตรวจ profile.email_verified
- เกิดเมื่อ: ถ้ามีคำขอ http:// ไปยังโดเมนเดียวกัน (เช่นผ่าน HTTP ก่อน redirect หรือเจอ MITM บน Wi-Fi สาธารณะ) cookie session จะถูกส่งแบบ plaintext จนถูกขโมยได้ และบัญชี Google ที่อีเมลยังไม่ verified แต่ตรงกับอีเมลใน allowed_users ก็ล็อกอินได้
- หลักฐาน: app/api/auth/google/callback/route.ts:142-147 และ app/api/auth/me/route.ts:220-225 ตั้ง cookie โดยไม่มี secure:true และไม่มี HSTS ใน next.config.ts; callback ใช้ profile.email ที่ :85 โดยไม่เช็ค profile.email_verified ส่วน email_verified เป็นกรณีที่เกิดได้น้อยกับบัญชี Google จริง

### #30 ปลอมตัวตนผู้เขียนได้ใน converse/claim_and_plan/update_status
- ที่: `lib/mcp-server.ts:862` · data-integrity
- ปัญหา: converse_on_issue (author/role/uploadedBy/reaction user), claim_and_plan_issue (assignee/actor/author) และ update_issue_status (actor ค่า default 'Antigravity') ใช้ agentName/actor ดิบจาก args โดยไม่ผ่าน formatTokenActorIdentity ต่างจาก tool อื่นที่ผูกอีเมล Gmail ของ token ไว้
- เกิดเมื่อ: token ของ dev@gmail.com เรียก converse_on_issue {agentName:'Super Admin [j...i@gmail.com]', role:'Admin', message:'อนุมัติแล้ว', newStatus:'wont_fix'} คอมเมนต์และ closedBy จะแสดงเป็น Super Admin ตรวจย้อนไม่ได้ว่าใครทำจริง (audit trail ถูกปลอม)
- หลักฐาน: converse_on_issue ใช้ args.agentName/args.role ดิบเป็น uploadedBy/actor/reaction user/author (lib/mcp-server.ts:832, 849, 855, 857, 862-863), claim_and_plan_issue ใช้ agentName (:777, 786, 791) และ update_issue_status ส่ง actor จาก args (:905-909) โดยไม่ผ่าน formatTokenActorIdentity ต่างจาก tool อื่น (:211, 303, 343) และ closedBy = actor (lib/issue-service.ts:617); ให้ระดับ low เพราะ REST comments ก็รับ body.author ได้อยู่แล้ว (comments/route.ts:46-48)

### #32 GET token API เปิดเผยสิทธิ์รายโปรเจกต์ให้คนไม่ล็อกอิน
- ที่: `app/api/mcp/tokens/route.ts:49` · security
- ปัญหา: GET /api/mcp/tokens ไม่ต้องล็อกอิน และ mask เฉพาะอีเมล แต่ยังคืน name, jobTitle, allowedProjects, projectPermissions ของ allowed users ทุกคน รวมถึง metadata ของ token ทุกตัว (id, name, projectKey, agentRole, usageCount) และ ?ownerEmail= ใช้เดาว่าอีเมลเต็มมี token หรือไม่ได้
- เกิดเมื่อ: curl http://localhost:3300/api/mcp/tokens แบบไม่มี cookie (ลองแล้ว) ได้ allowedUsers 3 รายการพร้อม {allowedProjects:['PRJA3712','PRJB3712'], projectPermissions:{PRJA3712:'question_only',PRJB3712:'viewer'}} และอีเมล super admin แบบ mask j***i@gmail.com ซึ่งพอใช้เดาเป้าหมายสำหรับช่องโหว่สร้าง token ได้
- หลักฐาน: app/api/mcp/tokens/route.ts:19-70 GET ไม่ต้อง login คืน allowedUsers (name/jobTitle/allowedProjects/projectPermissions) และ token metadata (id/projectKey/agentRole/usageCount); ต่างจาก me route ตรงที่ไม่ mask ชื่อ super admin (:49-59) curl ได้ชื่อจริงของ super admin ไม่ใช่ 'Super Admin'; ?ownerEmail= (:22 -> lib/mcp-tokens.ts:76) ใช้เป็นตัวทดสอบว่าอีเมลเต็มนั้นมี token หรือไม่ได้

### #33 submit_claude_review decision=pending แต่คอมเมนต์บอกว่าไม่แก้
- ที่: `lib/mcp-server.ts:263` · correctness
- ปัญหา: body ของคอมเมนต์มีแค่สองกรณีคือ fix กับอื่นๆ เมื่อ decision='pending' (สถานะถูกตั้งเป็น 'reviewing') จึงตกไปที่ข้อความ '⛔ ผลรีวิว: ไม่แก้ (สถานะ: wont_fix)'
- เกิดเมื่อ: Antigravity เรียก submit_claude_review {code:'PRJA-101', decision:'pending', reviewReason:'กำลังตรวจ log'} Issue ยังเป็น reviewing แต่คอมเมนต์ใน Drawer ประกาศว่าไม่แก้/wont_fix ผู้แจ้งเข้าใจผิดว่าเรื่องถูกปฏิเสธแล้ว
- หลักฐาน: lib/mcp-server.ts:215-220 decision 'pending' ได้ nextStatus 'reviewing' แต่ body ของคอมเมนต์ที่ :258-263 มีแค่สองกรณี fix กับอื่นๆ จึงตกไปที่ข้อความ '⛔ ... ไม่แก้ (สถานะ: wont_fix)' แม้สถานะจริงเป็น reviewing

### #34 converse_on_issue เปลี่ยนสถานะแล้วแต่ tool คืน error (บันทึกไม่ครบ)
- ที่: `lib/mcp-server.ts:842` · data-integrity
- ปัญหา: updateIssue (status/subtasks/reviewMeta) ถูกเขียนลง DB ก่อน addIssueComment ซึ่ง throw เมื่อ message ว่างหรือมีแต่ช่องว่างและไม่มีไฟล์ (zod z.string() รับค่าว่างได้) ไฟล์ที่อัปโหลดเข้า MinIO ไปแล้วก็กลายเป็นไฟล์กำพร้า
- เกิดเมื่อ: converse_on_issue {code:'PRJA-101', agentName:'x', message:'', newStatus:'deployed'} สถานะกลายเป็น deployed และมี timeline แล้ว แต่ AI ได้ isError 'กรุณาพิมพ์ข้อความ...' เลย retry ซ้ำ ทำให้มี event และ reaction toggle ซ้ำซ้อน
- หลักฐาน: lib/mcp-server.ts:842-859 updateIssue (status/subtasks/reviewMeta/toggleReaction) ถูกเขียนลง DB ก่อน แล้ว :861-867 addIssueComment ส่งแค่ body/attachments/isResolution ไม่ได้ส่ง nextStatus จึง throw ที่ lib/issue-service.ts:662-664 เมื่อ message ว่างหรือมีแต่ช่องว่างและไม่มีไฟล์ (z.string() ที่ :813 รับ '' ได้); ไฟล์ที่อัปโหลดแล้วที่ :832 กลายเป็นไฟล์กำพร้า และถ้า retry จะ toggle reaction กลับ

### #36 ความยาว project key ไม่ตรงกัน (ไม่ตัด 10 ตัวอักษรเหมือน normalizeProjectKey)
- ที่: `lib/mcp-server.ts:429` · correctness
- ปัญหา: create_project, resolveScopedProjectKey และ generateMcpToken ทำความสะอาด key โดยไม่ตัดความยาว แต่ createProject/createIssue ใช้ normalizeProjectKey ที่ .slice(0,10) ทำให้ key ยาวกว่า 10 ตัวอักษรถูกเทียบเป็นคนละค่ากัน
- เกิดเมื่อ: create_project {key:'SMLAIACCOUNT', confirmedByUser:true,...} สร้างได้ key จริง 'SMLAIACCOU' จากนั้น create_issue {projectKey:'SMLAIACCOUNT'} ได้ 'project_not_found' พอ AI เรียก create_project ซ้ำก็โดน throw 'มีอยู่ในระบบแล้ว' วนไม่จบ token ที่ผูก 'SMLAIACCOUNT' ก็ใช้กับโปรเจกต์ใดไม่ได้เลย
- หลักฐาน: create_project ทำความสะอาด key โดยไม่ slice (lib/mcp-server.ts:429-432) แล้วเทียบ existing ด้วย key ยาว (:453) แต่ createProject ใช้ normalizeProjectKey ที่ slice(0,10) (lib/issue-service.ts:20-26, 86) -> เก็บเป็น 'SMLAIACCOU'; create_issue เทียบ p.key === 'SMLAIACCOUNT' (:675) จึงได้ project_not_found; เรียก create_project ซ้ำจะหา existing ไม่เจอแล้ว createProject throw 'มีอยู่ในระบบแล้ว' (:95-98); resolveScopedProjectKey (:68-71) และ generateMcpToken (lib/mcp-tokens.ts:107-110) ก็ไม่ slice เช่นกัน

### #37 รับ MCP Token ผ่าน query string ทำให้ token รั่วลง log
- ที่: `lib/mcp-tokens.ts:194` · security
- ปัญหา: extractTokenFromRequest รับ ?token= และ ?apiKey= ด้วย และ UI (Modals.tsx:955) ก็สร้าง config แบบ url .../mcp?project=X&token=ism_live_... ให้ใช้ token ถาวรที่ไม่มีวันหมดอายุจึงไปค้างใน access log ของ reverse proxy และ history
- เกิดเมื่อ: ผู้ใช้ copy config แบบ URL query ไปใช้ ทุก request ไปค้างใน access log ของ Caddy/Next พร้อม token เต็ม ใครที่อ่าน log ได้ก็เอา token ไปเรียก MCP ในนามเจ้าของได้ไม่มีกำหนด เพราะ token ไม่มี expiry
- หลักฐาน: lib/mcp-tokens.ts:192-197 รับ ?token= และ ?apiKey=; README.md:88 และ app/api/mcp/route.ts:83 แนะนำรูปแบบ URL ที่มี token; token ไม่มีวันหมดอายุ (McpTokenRecord ไม่มี exp :11-29) จึงไปค้างใน access log ของ proxy และใช้ได้ไม่จำกัดเวลา

### #43 merge reviewMeta ทำให้ field ถูกล้างเมื่อ MCP ส่ง undefined
- ที่: `lib/issue-service.ts:526` · data-integrity
- ปัญหา: mergedReview = {...existing.reviewMeta, ...patch.reviewMeta} ให้ key ที่มีค่า undefined ทับค่าเดิม และ driver (ignoreUndefined=false ยืนยันที่ node_modules/mongodb/lib/cmap/commands.js:58) บันทึกเป็น null; submit_claude_review ส่ง fixInstructions/targetFiles/deployCommand เป็น undefined เมื่อไม่ได้ระบุ (mcp-server.ts:241-243) และ closedAt/closedBy/assignee/milestone/dueDate ที่ set เป็น undefined ก็กลายเป็น null
- เกิดเมื่อ: Issue ที่ ready_to_fix มี fixInstructions/targetFiles/deployCommand แล้ว Antigravity เรียก submit_claude_review(decision='pending' หรือ 'wont_fix', reviewReason='...') โดยไม่ส่ง field เหล่านั้น -> ค่าเดิมถูกเขียนทับเป็น null สูญหาย
- หลักฐาน: lib/issue-service.ts:526-529 mergedReview = {...existing.reviewMeta, ...patch.reviewMeta} key ที่เป็น undefined ทับค่าเดิม; lib/mcp-server.ts:241-243 ส่ง fixInstructions/targetFiles/deployCommand = args.* ซึ่งเป็น undefined เมื่อไม่ระบุ (เรียก in-process ไม่ผ่าน JSON จึงไม่ถูกตัดทิ้ง); lib/mongodb.ts:25-28 ไม่ตั้ง ignoreUndefined และ node_modules/mongodb/lib/cmap/commands.js:58 default false -> BSON บันทึกเป็น null; ผลกระทบจำกัดเพราะเกิดเมื่อมีการรีวิวใหม่ทับ ซึ่งบางกรณี (wont_fix) การล้างคำสั่งแก้ก็ไม่เสียหาย

### #44 บันทึกรีวิวจาก UI ตีตรา fixedBy/fixedAt ปลอม และล้างช่องไม่ได้
- ที่: `components/IssueDetailDrawer.tsx:147` · ui-state
- ปัญหา: buildReviewMetaPayload ใส่ fixedBy='Antigravity' และ fixedAt=now ทุกครั้งที่บันทึกรีวิว (ก่อนมีการแก้จริง) และส่ง fixInstructions/deployCommand/deployResult เป็น undefined เมื่อช่องว่าง ซึ่ง JSON.stringify ตัดทิ้ง ทำให้ merge ฝั่ง server คงค่าเดิมไว้
- เกิดเมื่อ: ทีมกด 'บันทึกรีวิว' บน Issue ที่ยัง open -> หน้าจอแสดง 'ผู้ดำเนินการ: Antigravity' ทั้งที่ยังไม่มีใครแก้ และ reviewMeta.fixedAt ถูกตั้งเป็นเวลารีวิว; ผู้ใช้ลบข้อความ fixInstructions แล้วบันทึก -> โหลดใหม่ข้อความเดิมกลับมา (ล้างค่าไม่ได้)
- หลักฐาน: components/IssueDetailDrawer.tsx:147-148 fixedBy = fixedBy.trim() || 'Antigravity' (state เริ่มต้น 'Antigravity' ที่ :88/:114) และ fixedAt = existing || now ทุกครั้งที่กดบันทึกรีวิว; :599-602 render 'ผู้ดำเนินการ' เมื่อมี reviewMeta.fixedBy จึงแสดงทันทีแม้ยังไม่มีใครแก้; :141,:146,:149 ส่ง undefined เมื่อช่องว่าง -> JSON.stringify ตัดทิ้ง -> server merge (issue-service.ts:526-529) คงค่าเดิม -> useEffect :111-115 โหลดข้อความเดิมกลับมา ล้างค่าไม่ได้ (ยกเว้น targetFiles ที่ส่ง [] และ reviewReason ที่ส่ง '')

### #45 Upvote ผู้ใช้ไม่ล็อกอินสุ่มชื่อ ไม่มีวันถอนโหวต
- ที่: `app/page.tsx:430` · correctness
- ปัญหา: handleQuickUpvote ใช้ voter = currentUser?.email || `devops-${random 100-999}` สุ่มใหม่ทุกคลิก ขณะที่ updateIssue toggle ตามชื่อ voter (issue-service.ts:603-611) และ route ไม่ผูก voter กับ session จึงไม่เคยเข้าเงื่อนไข removing
- เกิดเมื่อ: ผู้ใช้ที่ยังไม่ล็อกอินกดโหวต Issue เดิม 10 ครั้ง -> upvotes +10 (toggle ไม่เคยลบ มีโอกาส 1/900 ที่ชื่อชนแล้วถอนโหวตโดยไม่ตั้งใจ); คนที่ยิง API เองระบุ toggleUpvoteBy เป็นชื่อ/อีเมลใครก็ได้ปั๊มหรือถอนโหวตแทนคนอื่นได้
- หลักฐาน: app/page.tsx:429-430 voter = currentUser?.email || `devops-${random}` สุ่มใหม่ทุกคลิก; ผู้ใช้ไม่ล็อกอินใช้ UI ได้ (page.tsx:955 ปุ่ม 'เข้าสู่ระบบด้วย Google' เป็นทางเลือก, :507-510 guest ได้สิทธิ์ developer ใน UI); lib/issue-service.ts:603-611 toggle ตาม string voter; app/api/issues/[code]/route.ts:46-51 ถือว่า upvote-only ไม่ตรวจสิทธิ์และไม่ผูก voter กับ session จึงปั๊ม/ถอนโหวตในนามคนอื่นได้ ผลกระทบแค่ตัวเลขโหวต

### #46 ลบไฟล์แนบผ่าน PATCH ไม่ลบจาก MinIO และทับด้วยรายการเก่า
- ที่: `lib/issue-service.ts:590` · data-integrity
- ปัญหา: updateIssue แทนที่ attachments ทั้งรายการตามที่ client ส่งโดยไม่เรียก removeUnreferencedAttachments (ใช้เฉพาะตอนลบ Issue/โปรเจกต์) และรายการมาจาก state ฝั่ง client (IssueDetailDrawer.tsx:433)
- เกิดเมื่อ: ทีมลบภาพหน้าจอที่มีข้อมูลลับออกจาก Issue -> object ยังอยู่ใน MinIO และ /api/files/<key> ยังเปิดได้โดยไม่ต้อง login (cache 1 ปี) พื้นที่ไม่ถูกคืน; ถ้า 2 คนแนบไฟล์พร้อมกัน ไฟล์ของคนแรกหลุดจากรายการเพราะส่ง list เต็มทับกัน
- หลักฐาน: lib/issue-service.ts:590-591 updateFields.attachments = patch.attachments แทนทั้งรายการ ไม่เรียก removeUnreferencedAttachments (มีใช้แค่ deleteIssue :928-935 และลบโปรเจกต์) จึงเหลือ object กำพร้าใน MinIO; รายการมาจาก state ฝั่ง client components/IssueDetailDrawer.tsx:431-433 ทำให้แนบพร้อมกันทับกันได้ (รากเดียวกับ #41); หมายเหตุ: /api/files/[...key] เปิดสาธารณะอยู่แล้วแม้ไฟล์ยังแนบอยู่ ประเด็นความลับจึงไม่ใช่ผลใหม่จากบั๊กนี้

### #49 resolvedToday/overdue คิดวันแบบ UTC ไม่ใช่เวลาไทย
- ที่: `lib/issue-service.ts:731` · correctness
- ปัญหา: todayPrefix = now.toISOString().slice(0,10) เทียบกับ closedAt แบบ UTC (บรรทัด 840) ผู้ใช้เป็นเวลา UTC+7; และ dueDate แบบ date-only ('2026-10-22') ถูกตีเป็น 00:00Z จึง overdue ตั้งแต่ 07:00 ของวันครบกำหนด (บรรทัด 833-836, และ string compare ที่ 169)
- เกิดเมื่อ: เวลา 03:00 น. ไทยวันที่ 22 (20:00Z วันที่ 21) การ์ด 'ปิดวันนี้' นับงานที่ปิดช่วง 07:00-24:00 ไทยของวันที่ 21 (เมื่อวาน) และไม่นับงานที่ปิด 00:00-03:00 ไทยของวันที่ 22; Issue ที่ครบกำหนดวันนี้ถูกนับเป็น overdue ตั้งแต่เช้าของวันนั้น
- หลักฐาน: lib/issue-service.ts:731 todayPrefix = toISOString().slice(0,10) เป็นวัน UTC เสมอ และ :839-841 closedAt.startsWith(todayPrefix) -> ช่วง 00:00-07:00 เวลาไทย 'ปิดวันนี้' นับวันของเมื่อวาน; ส่วน dueDate แบบ date-only เป็นการคาดเดา: ไม่มี UI/MCP ที่ตั้ง dueDate (grep พบแค่ app/api/issues/route.ts:138 ผ่าน body) และ types.ts:123 ระบุเป็น ISO Date

### #50 Monitor projectKey ตัวเล็กทำให้ byProject ว่าง
- ที่: `lib/issue-service.ts:788` · correctness
- ปัญหา: query ใช้ projectKey.toUpperCase() แต่การสร้าง projectStatMap เทียบ p.key !== projectKey ตรงๆ (และ projectStatMap.get(issue.projectKey)) จึงไม่เจอเมื่อ key เป็นตัวเล็ก (ยืนยันด้วย curl: /api/monitor?projectKey=api ได้ byProject=[] ส่วน projectKey=API ได้ [API])
- เกิดเมื่อ: client/สคริปต์เรียก /api/monitor?projectKey=api -> totalIssues ถูกกรองแล้วแต่ byProject ว่าง ตารางแยกโปรเจกต์ใน Monitor ไม่แสดงอะไร
- หลักฐาน: lib/issue-service.ts:723 query ใช้ toUpperCase แต่ :788 เทียบ p.key !== projectKey ดิบ; app/api/monitor/route.ts:9 ส่งค่าจาก query ตรงๆ; curl GET /api/monitor?projectKey=api ได้ byProject=[] ส่วน API ได้ ["API"]; กระทบเฉพาะการเรียก API ตรง เพราะ UI ใช้ key ที่เก็บไว้ (ตัวใหญ่) และ MCP ทำ toUpperCase ใน resolveScopedProjectKey (mcp-server.ts:69-71)

### #51 เรียงตามรหัสเรื่องเป็น string ไม่ใช่เลข
- ที่: `lib/issue-service.ts:208` · correctness
- ปัญหา: คอลัมน์ 'รหัสเรื่อง' ส่ง sortBy=code ซึ่ง Mongo เรียงแบบตัวอักษร (ไม่ใช้ field number)
- เกิดเมื่อ: โปรเจกต์ที่สร้างใหม่เริ่มเลข 101: SMLAIACC-1000 ขึ้นก่อน SMLAIACC-101 และ SMLAIACC-99 อยู่หลัง SMLAIACC-101; มุมมองทุกโปรเจกต์ก็เรียงปนกัน ทำให้ลำดับเลขผิดเมื่อมี Issue เกิน 999
- หลักฐาน: components/IssuesTableView.tsx:34 คอลัมน์ 'รหัสเรื่อง' sortField='code'; lib/issue-service.ts:208-210 sort ตาม field code ที่เป็น string `${projectKey}-${n}` (:329) ไม่มี field ตัวเลข/collation numericOrdering; และ seed รีเซ็ต nextIssueNumber=1 (mongodb.ts:226) จึงเรียงผิดตั้งแต่ Issue ที่ 10 (X-10 มาก่อน X-2)

### #52 PATCH ตั้งหัวข้อว่างได้ ทั้งที่สร้างต้องมี
- ที่: `lib/issue-service.ts:462` · correctness
- ปัญหา: createIssue throw เมื่อ title ว่าง แต่ updateIssue ตั้ง updateFields.title = patch.title.trim() โดยไม่เช็คว่าไม่ว่าง และ patch.title ที่ไม่ใช่ string ทำให้ TypeError
- เกิดเมื่อ: PATCH {title:'   '} -> Issue หัวข้อว่าง แสดงในตาราง/Kanban/recentActivities เป็นช่องว่าง และ timeline ลง 'แก้ไขหัวข้อเป็น ""'
- หลักฐาน: lib/issue-service.ts:462-463 ตั้ง title = patch.title.trim() โดยไม่เช็คว่าว่าง ขณะที่ createIssue :314 throw เมื่อว่าง; route app/api/issues/[code]/route.ts:46-51 ไม่ validate; PATCH {title:'   '} จาก developer/guest (guest ผ่านเพราะ effectiveUser=null :55) ได้หัวข้อว่าง; ค่า non-string ทำให้ TypeError -> 400 (ไม่ crash)

### #58 fetchAllData มี dep selectedIssue?.code ทำให้โหลดซ้ำทุกครั้งที่เปิด/ปิด Drawer
- ที่: `app/page.tsx:264` · react-effect
- ปัญหา: selectedIssue?.code ถูกใส่ใน dependency ของ useCallback ทั้งที่ callback ไม่ได้ใช้ (ใช้ functional setSelectedIssue) ทุกครั้งที่เปิด/ปิด/สลับ Issue จึงเกิด fetch 3 ตัว (projects/issues/monitor) และ spinner กะพริบ ผลลัพธ์ยัง setSelectedIssue(refreshed) เป็นอ็อบเจ็กต์ใหม่ (บรรทัด 242-248) ซึ่งทำให้ useEffect([issue]) ใน IssueDetailDrawer.tsx:99-117 รีเซ็ตฟอร์มที่ยังไม่บันทึกทั้งหมด
- เกิดเมื่อ: คลิกแถว Issue -> Drawer เปิดและ fetch เริ่มทันที ถ้าผู้ใช้กดแก้หัวข้อ/พิมพ์เหตุผลรีวิวก่อน response กลับมา (หรือเปลี่ยน priority ระหว่างแก้ description ซึ่ง PATCH ส่ง issue ใหม่กลับมา) ค่าที่พิมพ์ค้างและโหมดแก้ไขถูกรีเซ็ตกลับเป็นค่าเดิมโดยไม่แจ้ง
- หลักฐาน: app/page.tsx:256-265 deps ของ useCallback มี selectedIssue?.code ทั้งที่ body ใช้แค่ functional setSelectedIssue (242-248); เปิด/ปิด Drawer เปลี่ยน code -> fetchAllData identity ใหม่ -> useEffect page.tsx:267-269 ยิง /api/projects,/api/issues,/api/monitor ใหม่และสลับ isLoading; ผล refreshed เป็น object ใหม่จาก list -> IssueDetailDrawer.tsx:99-117 รีเซ็ตฟอร์ม ถ้าผู้ใช้เริ่มแก้ก่อน response กลับ (ช่วงเวลาสั้น ผลกระทบหลักคือ fetch ซ้ำ ส่วนการรีเซ็ตฟอร์มเป็น root cause ของ #78)

### #62 โหวตตอนไม่ล็อกอินใช้ voter สุ่มใหม่ทุกครั้ง โหวตซ้ำได้ไม่จำกัด
- ที่: `app/page.tsx:429` · data-integrity
- ปัญหา: handleQuickUpvote ใช้ currentUser?.email หรือถ้าไม่มีจะสุ่ม `devops-${100..999}` ใหม่ทุกคลิก ส่วน server toggleUpvoteBy (issue-service.ts:603-610) ถือว่าคนละ voter จึงบวกคะแนนทุกครั้ง และ PATCH แบบ upvote-only ข้ามการตรวจสิทธิ์
- เกิดเมื่อ: ผู้ใช้ที่ยังไม่ล็อกอินคลิกปุ่มโหวตบนแถวเดิม 20 ครั้ง -> upvotes เพิ่ม 20 และไม่มีทางกดยกเลิก (toggle) ลำดับ Top Priority Queue ใน Roadmap ถูกบิดเบือนได้
- หลักฐาน: app/page.tsx:429-430 voter = currentUser?.email || `devops-${random}` สุ่มใหม่ทุกคลิก; app/api/issues/[code]/route.ts:48-56 PATCH ที่มีแค่ toggleUpvoteBy ข้ามการตรวจสิทธิ์ (และถ้าไม่มี effectiveUser ก็ข้ามทั้งหมด); lib/issue-service.ts:603-610 ถือว่า voter ใหม่ทุกครั้ง -> +1 ทุกคลิก ไม่มีทาง toggle ออก; GET /api/issues ไม่ต้องล็อกอิน (curl ได้ 200) ปุ่มโหวตจึงใช้ได้โดยคนไม่ล็อกอิน

### #63 กด Esc ครั้งเดียวปิดทั้ง modal และ Drawer ที่อยู่ข้างล่าง
- ที่: `app/page.tsx:277` · ui-state
- ปัญหา: page.tsx ใช้ลำดับ if/else เพื่อปิดทีละชั้น แต่ IssueDetailDrawer.tsx:119-128 ลงทะเบียน keydown Escape ของตัวเองบน window และเรียก onClose() ทุกครั้ง จึงทำงานคู่กับ handler ของ page และปิดซ้อนกัน
- เกิดเมื่อ: เปิด Drawer ของ Issue แล้วกด Ctrl+K เปิด Command Palette (หรือเปิด modal สร้างเรื่อง/MCP จาก palette) จากนั้นกด Esc เพื่อปิด palette -> Drawer ปิดไปพร้อมกัน ร่างคอมเมนต์ที่พิมพ์ค้างอยู่หาย; กด Esc ระหว่างพิมพ์ในช่องคอมเมนต์ก็ปิด Drawer ทันทีโดยไม่เตือน
- หลักฐาน: app/page.tsx:276-284 ปิดทีละชั้น (palette ก่อน) แต่ components/IssueDetailDrawer.tsx:119-128 ลงทะเบียน window keydown ของตัวเองเรียก onClose() ทุกครั้งที่ issue ไม่ null โดยไม่เช็กว่ามี modal ซ้อน; Ctrl+K (page.tsx:274-276) เปิด palette ได้ขณะ Drawer เปิด -> Esc ปิดทั้ง palette และ Drawer พร้อมกัน; หมายเหตุ: ร่างคอมเมนต์ไม่หายจริงเพราะ Drawer ยัง mount ค้าง (ดู #79) แต่ Drawer ปิดผิดชั้นจริงและสถานะแก้ title/desc ค้างถูกรีเซ็ตเมื่อเปิดใหม่

### #65 สิทธิ์ที่ใช้โชว์/ซ่อนปุ่มในมุมมองรวมอิงโปรเจกต์ที่จำล่าสุดเท่านั้น
- ที่: `app/page.tsx:498` · authz
- ปัญหา: effectiveDefaultProjectKey ตอน selectedProjectKey==='ALL' คือ lastSpecificProjectKey (หรือ 'DEVOPS' เมื่อไม่มีโปรเจกต์) ทำให้ activeProjectPermission (บรรทัด 503-505) ไม่สะท้อนสิทธิ์ของ Issue ที่เห็นในมุมมองรวม; และถ้าผลเป็น 'none' ปุ่มสร้างเรื่องกลับถูกแสดงเพราะเช็กแค่ viewer/question_only (บรรทัด 577, 872)
- เกิดเมื่อ: สมาชิกมีสิทธิ์ viewer ใน A (จำล่าสุด) แต่ reporter ใน B เลือกมุมมองรวม -> sidebar ขึ้น 'สิทธิ์ของคุณในโปรเจกต์นี้คือดูข้อมูลอย่างเดียว' และปุ่ม 'แจ้งปัญหา/สอบถาม' หายหมด ทั้งที่สร้างใน B ได้ ในทางกลับกันถ้าไม่มีสิทธิ์เข้าถึง 'DEVOPS' ที่เป็น fallback ปุ่มสร้างจะโผล่แล้วถูก modal/เซิร์ฟเวอร์ปฏิเสธ
- หลักฐาน: app/page.tsx:498-505 เมื่อ selectedProjectKey==='ALL' ใช้ lastSpecificProjectKey (หรือ 'DEVOPS') คำนวณ activeProjectPermission แล้ว :577 และ :872 ซ่อนปุ่มสร้างเรื่องเฉพาะกรณี === 'viewer' ผู้ที่ viewer ใน A (โปรเจกต์ที่จำไว้) แต่ reporter ใน B จึงไม่เห็นปุ่มในมุมมองรวม ส่วนค่า 'none' กลับแสดงปุ่ม; เป็นปัญหา UI ที่แก้ได้ด้วยการเลือกโปรเจกต์ B

### #67 response ผิดพลาดถูกข้าม ทำให้ข้อมูลโปรเจกต์เก่าค้างภายใต้หัวข้อโปรเจกต์ใหม่
- ที่: `app/page.tsx:239` · correctness
- ปัญหา: fetchAllData ตั้ง state เฉพาะเมื่อมี projData.projects / issuesData.issues / monData.stats และไม่เช็ก res.ok จึงไม่ล้าง issues/stats เดิมเมื่อ API ตอบ {error}; ถ้า response ใด .json() พัง (เช่น HTML จาก proxy) Promise.all ทั้งชุดตกไป catch และ UI ไม่แจ้งอะไร
- เกิดเมื่อ: อยู่โปรเจกต์ A แล้วสลับไป B ขณะที่ /api/issues หรือ /api/monitor ตอบ 500 -> หัวข้อ/ตัวเลือกเป็น B แต่ตาราง, Kanban และสถิติยังเป็นข้อมูลของ A (และ MonitorDashboardView แสดงข้อมูลเก่า) โดยไม่มีข้อความ error
- หลักฐาน: app/page.tsx:224-251 ไม่เช็ก projRes/issuesRes/monRes.ok; :239-249 set state เฉพาะเมื่อ issuesData.issues/monData.stats มีค่า; app/api/issues/route.ts:45-47 ตอบ {error} status 500 เมื่อ Mongo ล้ม -> issues/monitorStats ของโปรเจกต์ A ค้างอยู่ขณะ selectedProjectKey เป็น B; .json() พัง -> catch แค่ console.error (:250-251) ไม่มีข้อความแจ้งใน UI

### #69 พิมพ์ค้นหาทุกตัวอักษรยิง 3 API รวม projects/monitor โดยไม่ debounce
- ที่: `app/page.tsx:260` · performance
- ปัญหา: searchQuery อยู่ใน deps ของ fetchAllData จึง fetch /api/projects, /api/issues (regex scan หลายฟิลด์) และ /api/monitor ทุก keystroke พร้อมสลับ isLoading; ตอนโหลดหน้าครั้งแรกก็ยิง 3 รอบ (ALL ก่อนกู้โปรเจกต์ แล้วค่อยโปรเจกต์ที่จำไว้ เพราะ fetch effect ไม่รอ hasRestoredProject ตามที่เห็นใน network log)
- เกิดเมื่อ: พิมพ์คำว่า 'เซิร์ฟเวอร์' 9 ตัวอักษร -> 27 requests ไปยัง Mongo ที่ใช้ร่วมกัน (monitor/projects ไม่ขึ้นกับคำค้นเลย) ไอคอนรีเฟรชหมุนค้างและเกิดโหลดซ้ำเกินจำเป็น
- หลักฐาน: app/page.tsx:260 searchQuery อยู่ใน deps ของ fetchAllData และ :904 onChange setSearchQuery ทุก keystroke ไม่มี debounce -> useEffect :267-269 ยิง 3 requests (/api/projects, /api/issues, /api/monitor ซึ่งสองตัวไม่ขึ้นกับ search) ต่อหนึ่งตัวอักษร; latestFetchId กันผลผิดได้ จึงเป็นแค่โหลดเกินจำเป็น (performance)

### #79 ร่างคอมเมนต์และไฟล์แนบค้างข้าม Issue
- ที่: `components/IssueDetailDrawer.tsx:67` · ui-state
- ปัญหา: commentBody และ commentAttachments (บรรทัด 67, 71) ไม่ถูกรีเซ็ตเมื่อ issue.code เปลี่ยน เพราะ effect บรรทัด 99-117 ไม่แตะสองตัวนี้ และ drawer ถูก mount ค้างไว้ระหว่างเปิดหลาย Issue
- เกิดเมื่อ: ผู้ใช้พิมพ์คำตอบพร้อมแนบรูปภายใน Issue #12 ยังไม่ส่ง แล้วปิดและเปิด Issue #15 ข้อความและรูปเดิมยังอยู่ในช่องตอบ กดส่งแล้วไฟล์/ข้อความของ #12 ไปโผล่ใน #15 (อาจเป็นโปรเจกต์ที่ผู้อื่นมองเห็น)
- หลักฐาน: app/page.tsx:1172-1181 render <IssueDetailDrawer> ตลอดเวลา (ไม่ conditional) และ IssueDetailDrawer.tsx:130 return null หลัง hooks จึง instance เดิมค้าง state; commentBody (:67) และ commentAttachments (:71) ไม่ถูกแตะใน effect :99-117 -> ปิด #12 เปิด #15 ร่างและไฟล์แนบเดิมยังอยู่ ส่งแล้วไปอยู่ใน #15; severity ต่ำเพราะข้อความ/ไฟล์ยังมองเห็นในช่องก่อนกดส่ง

### #83 setAllowedUsers จากผลลัพธ์ POST ทำให้ isSuperAdmin หาย
- ที่: `components/GoogleLoginModal.tsx:444` · ui-state
- ปัญหา: หลัง add/update/remove (บรรทัด 197, 256, 444, 478) client แทน allowedUsers ด้วย data.allowedUsers จาก POST ซึ่ง /api/auth/me ส่งผลดิบจาก listAllowedUsers() ที่ไม่มีฟิลด์ isSuperAdmin (เฉพาะ GET ที่เติม) แต่ UI ใช้ u.isSuperAdmin ตัดสินป้าย Super Admin และซ่อนปุ่มลบ/แก้ไข (บรรทัด 1010, 1068, 1170)
- เกิดเมื่อ: แอดมินเพิ่ม Gmail ใหม่ แถวของ Super Admin เปลี่ยนเป็นป้าย Admin ธรรมดาและมีปุ่มลบ/แก้บทบาทโผล่ขึ้นมาจนกว่าจะโหลดหน้าใหม่ กดแล้วเซิร์ฟเวอร์ปฏิเสธด้วย error
- หลักฐาน: app/api/auth/me/route.ts:36-53 เฉพาะ GET เติม isSuperAdmin; POST add/update/remove/change_super_admin (:107-113, :142-147, :161-165) คืน listAllowedUsers() ดิบ; GoogleLoginModal.tsx:197,256,444,478,514 setAllowedUsers(data.allowedUsers) -> :1010 isSuper=false -> :1068 ปุ่มลบโผล่ที่แถว Super Admin; กดแล้ว lib/auth.ts:399-401 throw ปฏิเสธ จึงเป็นแค่ UI ผิดชั่วคราว

### #84 สวิตช์ enforceTokenAuth ไม่ตรวจผลและไม่ย้อนค่าเมื่อล้มเหลว
- ที่: `components/Modals.tsx:880` · error-handling
- ปัญหา: handleToggleEnforceAuth ตั้ง setEnforceTokenAuth(nextVal) แบบ optimistic แล้ว fetch POST update_settings โดยไม่ตรวจ res.ok และไม่ rollback ถ้าล้มเหลวหรือ network error (promise reject ไม่ถูกจับ)
- เกิดเมื่อ: แอดมินปิด "บังคับใช้ MCP Token" แต่คำขอล้มเหลว (เซิร์ฟเวอร์ 500/ขาดการเชื่อมต่อ) สวิตช์ใน UI แสดงว่าปิดแล้ว ทั้งที่ระบบยังบังคับ token อยู่ หรือกลับกัน ทำให้ตั้งค่าความปลอดภัยผิดจากที่เห็น
- หลักฐาน: components/Modals.tsx:880-890 setEnforceTokenAuth(nextVal) ก่อน แล้ว await fetch โดยไม่เช็ก res.ok ไม่ try/catch ไม่ rollback; app/api/mcp/tokens/route.ts:81-84 update_settings ไม่มีการตรวจสิทธิ์ จึงล้มเฉพาะกรณี 500/network error ซึ่งไม่บ่อย แต่เมื่อเกิดสวิตช์ใน UI ไม่ตรงค่าจริงและ promise reject ไม่ถูกจับ

### #89 UI แสดงปุ่มแก้ไข/เปลี่ยนสถานะให้ทุกระดับสิทธิ์ ที่ server ปฏิเสธ
- ที่: `components/IssueDetailDrawer.tsx:341` · ui-permission-mismatch
- ปัญหา: หัวข้อ (300-326), ประเภท (341), ความสำคัญ (354) และคำอธิบาย (375-410) แก้ไขได้เสมอโดยไม่เช็ก canManageStatus ส่วน KanbanBoardView.tsx:125-136 แสดงปุ่มเลื่อนสถานะให้ทุกคน (ไม่มี permission prop เลย) แต่ PATCH ที่ไม่ใช่ upvote ต้องผ่าน change_status ซึ่งต้องเป็น developer ขึ้นไป
- เกิดเมื่อ: ผู้ใช้ reporter เปลี่ยนความสำคัญเป็น CRITICAL หรือกดปุ่ม 'ส่งต่อ' บน Kanban เห็นค่าเปลี่ยนชั่วคราวในช่อง select แต่ server ตอบ 403 และ UI เงียบ (ดูรายการก่อนหน้า) ค่าดูเหมือนบันทึกแล้ว ทั้งที่ README บอกว่า reporter/question_only เปลี่ยนสถานะไม่ได้
- หลักฐาน: components/IssueDetailDrawer.tsx:186-187 มี canManageStatus แต่ช่องหัวข้อ (~:304-320), type select (~:343-344), priority select (~:356-357), คำอธิบาย (~:377-402) เรียก onUpdate โดยไม่เช็ค; components/KanbanBoardView.tsx:125-136 ปุ่มเลื่อนสถานะไม่มี permission prop; server app/api/issues/[code]/route.ts:55-66 + lib/auth.ts:158-166 ปฏิเสธ reporter/question_only/viewer -> 403 ที่ UI กลืนเงียบ (#88)

### #91 ไม่ validate status/type/priority ทำให้ได้ค่าเสียในฐานข้อมูล
- ที่: `lib/issue-service.ts:697` · enum-validation
- ปัญหา: addIssueComment ตั้ง status จาก input.nextStatus ตรง ๆ และใช้ STATUS_NAME_MAP[nextStatus] (707) ส่วน updateIssue (477-490) รับ type และ priority เป็น string อะไรก็ได้ โดย PATCH และ POST ของ route ไม่ตรวจ enum (IssueStatus/IssueType/IssuePriority)
- เกิดเมื่อ: PATCH {status:'foo'} หรือ comments {nextStatus:'foo'} ตั้ง status ของ issue เป็น 'foo' ซึ่งไม่ตรงคอลัมน์ Kanban ใด ๆ issue จึงหายจากบอร์ดและตัวกรองสถานะ และ timeline แสดง 'เปลี่ยนสถานะเป็น undefined'
- หลักฐาน: lib/issue-service.ts:613-614 ตั้ง status = patch.status ใดๆ, :477-479 type, :481-482 priority ไม่ตรวจ enum; addIssueComment :697-698 ตั้ง status จาก input.nextStatus และ :707 STATUS_NAME_MAP[nextStatus] ได้ undefined; routes app/api/issues/[code]/route.ts:68 และ comments/route.ts:84 ส่งต่อตรงๆ; ต้องยิง API เอง (UI ใช้ค่าคงที่) แต่ guest ยิงได้เพราะ effectiveUser=null ข้ามการตรวจสิทธิ์

### #93 โมดัลและ README โฆษณา MCP tool ที่ไม่มีอยู่จริง
- ที่: `components/Modals.tsx:1452` · doc-vs-impl
- ปัญหา: รายการ tool ในโมดัล (Modals.tsx:1452-1478) และตารางใน README.md มี batch_create_issues, manage_subtasks, update_issue, add_comment ซึ่งไม่ได้ลงทะเบียนใน lib/mcp-server.ts ขณะที่ tool จริง 14 ตัว (GET /api/mcp ทดสอบแล้ว) คือ list_projects, create_project, claim_and_plan_issue, update_issue_status ที่ไม่อยู่ในรายการเอกสารเลย
- เกิดเมื่อ: Antigravity ทำตาม guide แล้วเรียก update_issue หรือ add_comment ได้ error tool ไม่พบ ทั้งที่ต้องใช้ update_issue_status และ converse_on_issue และไม่รู้ว่ามี create_project ที่มี confirmation gate
- หลักฐาน: tool ที่ลงทะเบียนจริงใน lib/mcp-server.ts มี 14 ตัว (claim_and_plan_issue, claim_for_fix, converse_on_issue, create_issue, create_project, find_similar_issues, get_ai_context, get_issue, get_monitor_summary, list_issues, list_projects, mark_deployed, submit_claude_review, update_issue_status) แต่ components/Modals.tsx:1452-1478 และ README.md:141-147 แสดง batch_create_issues, manage_subtasks, update_issue, add_comment ที่ไม่มีอยู่; ผลกระทบจำกัดเพราะ MCP client ได้รายการจริงจาก tools/list

### #96 ลบโปรเจกต์แล้ว token/สิทธิ์ผู้ใช้ที่ผูกไว้ยังค้างอยู่
- ที่: `app/api/projects/route.ts:44` · data-integrity
- ปัญหา: DELETE ลบแค่ projects และ issues ไม่ลบ mcp_tokens ที่ผูก projectKey นี้ และไม่ถอดคีย์ออกจาก allowed_users.allowedProjects/projectPermissions ผู้ใช้เก่าจึงยังอ้างโปรเจกต์ที่ไม่มีแล้ว
- เกิดเมื่อ: ลบโปรเจกต์ FIN แล้วมีคนสร้างโปรเจกต์ใหม่ที่ใช้คีย์ FIN เดิม ผู้ที่เคยได้สิทธิ์ FIN เดิมและ token MCP เดิมกลับมามีสิทธิ์ในโปรเจกต์ใหม่โดยอัตโนมัติ ทั้งที่เป็นคนละโปรเจกต์
- หลักฐาน: app/api/projects/route.ts:44-46 DELETE ลบแค่ projects.deleteOne และ issues.deleteMany ไม่แตะ mcp_tokens (lib/mcp-tokens.ts:156 เก็บ projectKey) หรือ allowed_users.allowedProjects/projectPermissions; lib/mcp-tokens.ts:273 ใช้ found.projectKey ต่อ จึงเมื่อสร้างโปรเจกต์ key เดิมใหม่ สิทธิ์และ token เก่ากลับมาใช้ได้กับโปรเจกต์ใหม่

### #98 loadTokens เขียนทับรายการโปรเจกต์ด้วยทุกโปรเจกต์
- ที่: `components/Modals.tsx:792` · ui-state
- ปัญหา: loadTokens ตั้ง availableProjects เป็น data.projects ซึ่งเป็นทุกโปรเจกต์ (route ไม่กรองตามผู้ใช้) ทับ propProjects ที่ page.tsx ส่งมาหลังกรองด้วย allowedProjects แล้ว และ selectedProjectKey ตั้งเป็น data.projects[0].key
- เกิดเมื่อ: สมาชิกที่ได้สิทธิ์เฉพาะ PRJA เปิดโมดัล MCP ช่องเลือกโปรเจกต์แสดงโปรเจกต์ที่ไม่ได้รับอนุญาตทั้งหมด และเลือกตัวแรกให้โดยอัตโนมัติ เมื่อกดสร้าง Token ได้ 400 'ไม่มีสิทธิ์เข้าถึงโปรเจกต์' ที่ผู้ใช้ไม่เข้าใจ
- หลักฐาน: components/Modals.tsx:792-796 setAvailableProjects(data.projects) ทับ propProjects ที่กรองแล้ว; app/api/mcp/tokens/route.ts:29,:66 คืน listProjects() ทั้งหมดไม่กรองตามผู้ใช้; :1081 render ทุกรายการใน select -> สมาชิกเห็น/เลือกโปรเจกต์ที่ไม่มีสิทธิ์แล้วได้ 400 ตอนสร้าง token; ส่วนการ auto-select ตัวแรกเกิดเฉพาะเมื่อ prev ว่างหรือ 'ALL' (:794-795) เพราะ state เริ่มต้น :749-752 มักมีค่าแล้ว

### #35 mcp:stdio ไม่โหลด .env.local ทำให้ต่อ DB/MinIO ผิดตัว (PLAUSIBLE)
- ที่: `mcp-stdio.ts:7` · contract
- ปัญหา: `tsx mcp-stdio.ts` ไม่โหลด .env.local (Next.js โหลดให้เฉพาะตอนรันเว็บ) lib/mongodb.ts:6 จึง fallback ไป mongodb://127.0.0.1:27018/issuemate และ MINIO_ACCESS_KEY/SECRET เป็นค่าว่าง ตรวจแล้วว่า MONGODB_URI ใน .env.local ไม่ตรงกับค่า default นี้ และไม่มีเอกสารบอกให้ส่ง env ผ่าน MCP client
- เกิดเมื่อ: รัน npm run mcp:stdio แล้วให้ Claude เรียก create_issue/mark_deployed ข้อมูลจะไปเขียน DB คนละก้อนกับเว็บ (หรือต่อไม่ติด) Issue ที่เห็นในเว็บไม่เปลี่ยน และการแนบไฟล์ fail เพราะ credential MinIO ว่าง
- หลักฐาน: mcp-stdio.ts:1-11 ไม่โหลด .env.local และ package.json script 'mcp:stdio' คือ 'tsx mcp-stdio.ts' ไม่มี --env-file/dotenv; lib/mongodb.ts:5-6 จึง fallback ไป mongodb://127.0.0.1:27018 ซึ่งตรวจแล้วว่าไม่ตรงกับ MONGODB_URI ใน .env.local และ MINIO_ACCESS_KEY/SECRET เป็น '' (lib/minio.ts:16-17); ยืนยันไม่ได้ว่า MCP client ของผู้ใช้ส่ง env มาให้หรือไม่

### #64 Ctrl+K ใช้ e.key จึงไม่ทำงานเมื่อเปิดแป้นพิมพ์ภาษาไทย (PLAUSIBLE)
- ที่: `app/page.tsx:274` · ui-state
- ปัญหา: ตรวจ e.key.toLowerCase()==='k' ซึ่งบน layout ภาษาไทย (Kedmanee) ปุ่ม K จะส่งค่า e.key เป็นอักษรไทย ไม่ใช่ 'k' ทั้งที่ UI โฆษณา Ctrl+K ในปุ่ม 'ค้นหาด่วน / สลับหน้าจอ' ควรใช้ e.code==='KeyK'
- เกิดเมื่อ: ผู้ใช้ไทยที่กำลังพิมพ์ด้วย layout ไทยกด Ctrl+K -> Command Palette ไม่เปิด (เบราว์เซอร์อาจเปิด shortcut ของตัวเองแทนเพราะไม่ได้ preventDefault) ต้องสลับเป็นแป้นอังกฤษก่อน
- หลักฐาน: app/page.tsx:274 ตรวจ e.key.toLowerCase()==='k' ไม่ใช้ e.code; สมมติฐานที่ยังไม่ได้ทดสอบจริง: Chromium บน Windows กับ layout ไทย Kedmanee รายงาน e.key ของ Ctrl+K เป็นอักษรไทย (พฤติกรรมเดียวกับที่รู้กันใน layout รัสเซีย) จึงไม่เข้า branch และไม่ preventDefault; ไม่ได้ยืนยันในเบราว์เซอร์/OS จริง

## ถูกหักล้าง (ไม่ใช่ bug)

- #27 `lib/mcp-server.ts:473` ด่านยืนยัน create_project ข้ามได้ และไม่ตรวจสิทธิ์สร้างโปรเจกต์ — confirmedByUser (lib/mcp-server.ts:420-426, 473) ออกแบบเป็นโปรโตคอลให้ AI ถามผู้ใช้ก่อน ไม่ใช่ security control (nonce ฝั่ง server ก็ถูก AI ตัวเดียวกันส่งกลับมาได้อยู่ดี) และ README.md:33 ระบุชัดว่าการเพิ่มโปรเจกต์ผ่าน MCP create_project เป็นฟีเจอร์ที่ตั้งใจให้มี ไม่ได้จำกัดเฉพาะ Admin; ส่วนการเรียกแบบนิรนามเป็นผลของ #22 และ POST /api/projects ที่เปิดอยู่แล้ว (#4) ไม่ใช่ข้อบกพร่องแยก
- #31 `lib/mcp-server.ts:388` list_projects ไม่เคารพการผูกโปรเจกต์ของ token — list_projects (lib/mcp-server.ts:383-393) คืน listProjects() ทั้งหมดจริง แต่ข้อมูลชุดเดียวกัน (key, name, description, repoOrServer, openCount, readyToFixCount) เปิดให้คนนิรนามอ่านได้อยู่แล้วผ่าน GET /api/projects (app/api/projects/route.ts:7-10) และ GET /api/auth/me (me/route.ts:30, 61) โดยไม่ต้อง login จึงไม่ได้รั่วข้อมูลเพิ่มขึ้น
- #42 `lib/issue-service.ts:613` ไม่มี state machine/บังคับ field ที่จำเป็นของ pipeline — AGENTS.md:8-11 อธิบายความหมายของแต่ละสถานะ ไม่ได้กำหนดให้ server บังคับ transition/field จึงเป็นข้อเสนอฟีเจอร์ ไม่ใช่ defect; ส่วน closedAt/closedBy ค้างหลัง addIssueComment เปิดเรื่องใหม่ (:697-702) ไม่มีผลที่สังเกตได้: getMonitorStats อ่าน closedAt เฉพาะเมื่อ isTerminal (:839) และการปิดซ้ำทั้งสองเส้นทางเขียน closedAt ใหม่ (:625-627, :699-701) ส่วน closedBy ไม่ถูก render ใน components/ หรือ app/page.tsx เลย (grep ไม่พบ); ประเด็นค่านอก enum เป็นของ #91
- #48 `lib/minio.ts:46` ensureBucket race และมองทุก error ว่า bucket ไม่มี — lib/minio.ts:43-55 หลัง restart bucket มีอยู่แล้ว HeadBucket สำเร็จ จึงไม่เข้า CreateBucket ตาม scenario ที่อ้าง; ถ้า Head ล้มเพราะ network blip การอัปโหลดนั้นก็ล้มอยู่แล้วไม่ว่าจะ fallback หรือไม่; race จริงเกิดได้เฉพาะครั้งแรกสุดที่ bucket ยังไม่ถูกสร้างและมี 2 upload พร้อมกันพอดี ซึ่งเป็นกรณีติดตั้งครั้งเดียว
- #53 `lib/issue-service.ts:727` Monitor/ลบ Issue โหลดทุกเอกสารเต็มก้อนเข้า memory — lib/issue-service.ts:727 find ไม่มี projection จริง แต่ไฟล์แนบเก็บใน MinIO เอกสาร Mongo มีแค่ metadata (AttachmentItem) จึงหลักพันเรื่องยังเป็นระดับ MB ไม่ถึง OOM; mongodb.ts:258-265 attachmentKeysOf ใช้ projection attachments/comments แล้ว; เป็นข้อกังวลเชิงประสิทธิภาพตามขนาดในอนาคต ไม่ใช่ความผิดพลาดที่เกิดขึ้นได้ตอนนี้
- #66 `app/page.tsx:962` แท็บกรองสถานะข้ามขั้น 4 (fixing) ทั้งที่มี 6 สถานะ — app/page.tsx:962-1030 มีแท็บ all/pending_review/ready_to_fix/deployed/wont_fix มาตั้งแต่ HEAD (git show HEAD ยืนยัน) เป็นการออกแบบ ไม่ใช่ flow ที่พัง: drill-down KPI ขั้น 4 ยังตั้ง statusFilter='fixing' แล้วกรองถูกต้อง และ active filter chip แสดงที่ page.tsx:1086-1108 ให้ยกเลิกได้; ข้อเรียกร้องคือขอแท็บเพิ่ม = missing feature
- #68 `components/MonitorDashboardView.tsx:70` คิวงานใน Monitor ถูกกรองด้วยตัวกรองของตาราง แต่ KPI ไม่ถูกกรอง — ข้อกล่าวอ้างว่า filter bar ไม่ปรากฏในมุมมอง Monitor ผิด: active filter bar ที่ app/page.tsx:1086 render ตาม activeFilters.length โดยไม่ขึ้นกับ viewMode และแถบแท็บอยู่ใน header ร่วม; คิวใน MonitorDashboardView.tsx:70-72 ใช้ issues ที่ถูกกรองตามตัวกรองที่ผู้ใช้เลือกและมองเห็นอยู่ ส่วน KPI เป็นยอดรวมโปรเจกต์ เป็นการออกแบบที่ไม่สอดคล้อง ไม่ใช่ข้อมูลผิด/พัง
- #73 `components/ui/FileAttachmentZone.tsx:24` fileUrl ใช้ a.url ตรงๆ ใส่ href/src/iframe โดยไม่กรอง scheme — แม้ fileUrl (components/ui/FileAttachmentZone.tsx:24) จะใช้ a.url ตรงๆ และ attachments จาก body ไม่ถูก validate แต่โปรเจกต์ใช้ React 19.2.4 และ react-dom ที่ Next bundle มา (node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.production.js) มีโค้ดบล็อก javascript: URL ใน href/src ('React has blocked a javascript: URL') จึงไม่รันสคริปต์; ส่วน data:text/html แบบ top-level ถูก browser บล็อก และใน iframe จะรันใน opaque origin ไม่ใช่ origin ของแอป
- #94 `tests/issuemate.spec.ts:482` เทสต์ยืนยันช่องโหว่และไม่ครอบคลุมเมทริกซ์สิทธิ์ — เป็นคำวิจารณ์ coverage/คุณภาพเทสต์ใน tests/issuemate.spec.ts ไม่ใช่พฤติกรรมผิดของระบบตอน runtime; ช่องโหว่ที่เทสต์พึ่งพา (auth ข้ามได้เมื่อไม่มี session ที่ lib/auth.ts:117-118 ฯลฯ) ควรรายงานเป็น finding ของโค้ดนั้นเอง
- #97 `app/page.tsx:408` handleUploadFile ใช้ contract ผิดกับ /api/upload และไม่ได้ถูกเรียก — contract ผิดจริง (app/page.tsx:408-420 ส่ง 'file' และอ่าน data.attachment ขณะที่ app/api/upload/route.ts:16 getAll('files') และ :42/:69 คืน {attachments}) แต่ onUploadFile ถูกประกาศที่ IssueDetailDrawer.tsx:53 และไม่ถูกเรียกที่ใดเลย (grep พบแค่ประกาศ prop และ page.tsx:1178) จึงไม่มีความล้มเหลวที่เกิดขึ้นได้ เป็นแค่ dead code
- #99 `tests/issuemate.spec.ts:630` cleanup ใน finally ไม่เชื่อถือได้ ข้อมูลทดสอบค้างใน DB — เป็นปัญหาความสะอาดของชุดทดสอบ (tests/issuemate.spec.ts:57-97 ไม่มี try/finally, :630-637 ไม่ตรวจ response ของ cleanup) ไม่ใช่ defect ของระบบ; ไม่ได้ทำให้พฤติกรรมของแอปผิด
