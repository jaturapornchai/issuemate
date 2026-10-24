# IssueMate DevOps — ระบบแจ้งปัญหา & ติดตามงานสำหรับ Antigravity, Claude Code และ Codex

> **Production URL**: [https://issue.dedezoom.com](https://issue.dedezoom.com) · **Version**: `v3.2.0` (แสดงเลขเวอร์ชันและวัน-เวลา Deploy ล่าสุดบนหน้าเว็บและ API `/api/auth/me`)

ระบบบริหารจัดการปัญหา (Issue Tracker) และเชื่อมโยงระหว่าง **ผู้ใช้งานทั่วไป / Tester (Non-Tech)** กับ **ทีมนักพัฒนา & AI Agent (Antigravity, Claude Code, Codex)** บน **`https://issue.dedezoom.com`** ภายใต้แนวคิด **"Easy for Tester, Rich for Dev"** — ให้ผู้แจ้งปัญหาพิมพ์หรือพูดเหมือนคุยแชท วางภาพแคปหน้าจอด้วย `Ctrl+V` พร้อมวาดวงกลม/ลูกศร/เบลอข้อมูลสำคัญได้ทันที ขณะที่ระบบแอบเก็บข้อมูลอุปกรณ์และจัดโครงสร้างเป็น Issue ระดับมืออาชีพให้นักพัฒนาครบ 100%

---

## 🚀 ชุดฟีเจอร์ใหม่ "Easy for Tester, Rich for Dev" (5 ฟีเจอร์หลัก)

### 1. 🎙️ "Speak or Type Like Chat" Input + Voice-to-Issue
- ช่องแชทเป็นมิตรสำหรับผู้ใช้งานทั่วไป: *"เจอปัญหาอะไร หรืออยากให้ทำอะไร พิมพ์หรือพูดบอกได้เลย..."* พร้อมปุ่มสลับโหมด **`💬 โหมดง่าย (Simple)`** และ **`🛠️ โหมดละเอียด (Technical)`**
- ปุ่มไมโครโฟน **`พูดบอกปัญหา`** ใช้ `Web Speech API` (`SpeechRecognition` / `webkitSpeechRecognition`) รองรับทั้งภาษาไทย (`th-TH`) และภาษาอังกฤษ (`en-US`)
- ระบบ AI (`POST /api/ai/format-issue`) แปลงข้อความพูดคุยทั่วไปให้เป็นโครงสร้าง GitHub/DevOps Issue อัตโนมัติ:
  - **Clear Title** (`[Bug]` / `[Feat]` / `[Question]` สรุปชัดเจน)
  - **Steps to Reproduce** (ลำดับขั้นตอน 1, 2, 3...)
  - **Expected vs. Actual Behavior** (สิ่งที่ควรจะเป็น เทียบกับ อาการที่เกิดขึ้นจริง)
  - **Severity Badge** (`🔴 Urgent`, `🟡 Medium`, `🟢 Minor`)

### 2. 🎨 Instant Clipboard Paste (`Ctrl+V`) & Simple HTML5 Canvas Image Annotator
- กด **`Ctrl+V`** ที่ไหนก็ได้ในหน้าฟอร์มเพื่อวางภาพแคปหน้าจอจาก Clipboard หรือลากวางรูปภาพ/ไฟล์เอกสารหลายไฟล์พร้อมกันเข้า MinIO S3
- ปุ่ม **`✏️ วาดจุดเสีย / ลูกศร / เบลอ`** บนรูปภาพแนบ เปิดเครื่องมือวาดบน `<canvas>` ที่ใช้งานง่ายที่สุด 3 ปุ่ม:
  1. **⭕ วงกลมสีแดง (Red Circle)** — วงล้อมจุดที่ปุ่มพังหรือแสดงผลผิด
  2. **➡️ ลูกศรชี้ (Arrow)** — ชี้จุดที่ต้องการให้แก้ไข
  3. **🔒 เบลอข้อมูลลับ (Blur Tool)** — ลากคลุมเพื่อเบลอชื่อลูกค้า เบอร์โทร หรือยอดเงินสำคัญก่อนส่ง

### 3. 📱 Zero-Effort Environment Auto-Capture (เก็บข้อมูลเครื่องอัตโนมัติ)
- เก็บข้อมูลสภาพแวดล้อมของผู้แจ้งในเบื้องหลังอัตโนมัติโดยที่ผู้ใช้ไม่ต้องกรอกเอง (`navigator.userAgent`, `window.innerWidth/Height`, `screen.width/height`, `navigator.connection`, เวลาและ Timezone)
- แนบท้ายรายละเอียด Issue ในบล็อกพับเก็บได้ `<details><summary>📱 Device & Environment Info</summary>...</details>` พร้อมแสดงเป็นตารางอ่านง่ายในหน้าต่างรายละเอียดสำหรับนักพัฒนา

### 4. 💬 AI "Missing Info" Politeness Check (ถามกลับอย่างสุภาพเมื่อข้อมูลสั้นเกินไป)
- หากผู้แจ้งพิมพ์สั้นหรือคลุมเครือเกินไป (เช่น *"พัง"*, *"กดไม่ได้"*, *"เว็บพังเข้าไม่ได้"*) ระบบจะยังไม่สร้าง Issue ที่ข้อมูลไม่ครบ
- น้อง AI จะถามกลับด้วยคำถามภาษาไทยสั้นๆ เข้าใจง่าย 1 ข้อ (`clarifyingQuestion`) พร้อมปุ่มตัวเลือกตอบด่วน (`quickReplyOptions` 2–3 ปุ่ม เช่น *"เกิดที่หน้าล็อกอินเข้าระบบ"*, *"มีข้อความ Error ขึ้นบนหน้าจอ"*) ให้คลิกเลือกแล้วสร้าง Issue ที่สมบูรณ์ได้ทันที

### 5. ⚡ One-Click Dev Action Bar (แถบคำสั่งด่วนสำหรับนักพัฒนา)
- ในหน้าต่างรายละเอียด Issue (`IssueDetailDrawer`) มีแถบคำสั่งด่วนสำหรับนักพัฒนาและ QA:
  - **Copy Git Branch Command**: คัดลอกคำสั่ง `git checkout -b fix/issue-{code}-{slug}` ในคลิกเดียว
  - **Copy Checklist for PR**: คัดลอกรายการ Markdown Checklist (`- [ ] ...`) สำหรับแปะใน Pull Request หรือใช้ตรวจทานซ้ำ (QA Retest)

---

## ✨ จุดเด่นหลักของระบบ (Core Capabilities)

1. **ระบบจำโปรเจกต์ล่าสุดที่ใช้ (`Last Active Project Memory`)**:
   - จดจำโปรเจกต์ที่ทำงานล่าสุดไว้ใน `localStorage` และ `?project=KEY` เพื่อป้องกันการแจ้งหรือแก้ไขงานผิดโปรเจกต์
2. **รองรับหัวข้อ "สอบถาม / ตั้งคำถาม" (`question`) & การตอบกลับพร้อมไฟล์ PDF/รูปภาพ**:
   - ผู้ใช้ตั้งคำถามได้ง่าย ทีมงานแนบไฟล์ PDF คู่มือและรูปภาพตอบกลับพร้อมกดปุ่ม **"ส่งคำตอบพร้อมไฟล์แนบ & ปิดเรื่องว่าเรียบร้อย"** ในคลิกเดียว เปิดอ่าน PDF ในหน้าจอได้ทันที (`Inline PDF Viewer`)
3. **ระบบสิทธิ์ผู้ใช้งานละเอียดถึงระดับโปรเจกต์ (`Granular Per-Project Permissions`)**:
   - กำหนดสิทธิ์ราย Gmail แยกตามโปรเจกต์ได้ 5 ระดับ: `question_only` (ถามได้อย่างเดียว), `reporter` (แจ้งปัญหา & ถามได้), `viewer` (ดูอย่างเดียว), `developer` (ทีมแก้ไข/ตอบคำถาม), `project_admin` (ผู้ดูแลโปรเจกต์)
4. **แจ้งผลการดำเนินการชัดเจนทุกปุ่ม (`Action Response Feedback`) & หน้าจอ `Auto-Responsive + Auto-Refresh`**:
   - ทุกการกดส่งความคิดเห็น เปลี่ยนสถานะ โหวต สร้างรายการ หรือตั้งค่า มีแถบแจ้งเตือนยืนยันผลสำเร็จ/ไม่สำเร็จชัดเจนทันที
   - ตารางแสดงผลเต็ม 100% แบบ Auto-Responsive ไม่ล้นจอ พับ Sidebar อัตโนมัติบนหน้าจอขนาดเล็ก และซิงค์ข้อมูลอัตโนมัติในพื้นหลังทุก 8 วินาที
5. **ความปลอดภัยระดับ Production (Hardened Auth & CSRF/XSS Protection)**:
   - ล็อกอินผ่าน **Sign in with Google** เท่านั้น เซ็นคุกกี้ด้วย `HMAC-SHA256 (SESSION_SECRET)` พร้อมวันหมดอายุและ `sessionVersion`
   - ซ่อนอีเมลส่วนตัว (`***`) สำหรับผู้ที่ไม่ได้เป็น Admin และบังคับตรวจสิทธิ์โปรเจกต์ทุก API รวมถึงการดาวน์โหลดไฟล์แนบ

---

## 🔌 การตั้งค่าเชื่อมต่อ MCP Server สำหรับ Antigravity, Claude Code และ Codex

### ขั้นตอนที่ 1: สร้าง MCP API Token ผูกกับโปรเจกต์ (`projectKey`)
1. เปิดเว็บ `https://issue.dedezoom.com` แล้วล็อกอินด้วย Google
2. กดปุ่ม **`เชื่อมต่อ AI`** มุมซ้ายบน
3. เลือก **โปรเจกต์ที่ต้องการล็อก (`projectKey`)** เช่น `SMLAIACC`, `DEVOPS`, `POS` แล้วกดปุ่ม **"สร้าง Token"** จะได้รหัส `ism_live_<40-hex>`

---

### ขั้นตอนที่ 2: ตั้งค่า MCP ตามเครื่องมือ AI ที่ใช้งาน

#### A. สำหรับ Google Antigravity / Cursor / Windsurf (`mcp_config.json`)
```json
{
  "mcpServers": {
    "issuemate": {
      "url": "https://issue.dedezoom.com/mcp?project=YOUR_PROJECT_KEY",
      "headers": {
        "Authorization": "Bearer ism_live_YOUR_GENERATED_TOKEN",
        "X-MCP-Project": "YOUR_PROJECT_KEY"
      }
    }
  }
}
```

#### B. สำหรับ Claude Code CLI (`.mcp.json` ในโฟลเดอร์โปรเจกต์ หรือคำสั่ง CLI)
รันคำสั่งใน Terminal ของโปรเจกต์:
```bash
claude mcp add --transport http issuemate "https://issue.dedezoom.com/mcp?project=YOUR_PROJECT_KEY" \
  --header "Authorization: Bearer ism_live_YOUR_GENERATED_TOKEN" \
  --header "X-MCP-Project: YOUR_PROJECT_KEY"
```
หรือสร้างไฟล์ `.mcp.json` ที่รากของโปรเจกต์:
```json
{
  "mcpServers": {
    "issuemate": {
      "type": "http",
      "url": "https://issue.dedezoom.com/mcp?project=YOUR_PROJECT_KEY",
      "headers": {
        "Authorization": "Bearer ism_live_YOUR_GENERATED_TOKEN",
        "X-MCP-Project": "YOUR_PROJECT_KEY"
      }
    }
  }
}
```

#### C. สำหรับ OpenAI Codex CLI (`~/.codex/config.toml`)
เพิ่มการตั้งค่าในไฟล์ `~/.codex/config.toml`:
```toml
[mcp_servers.issuemate]
url = "https://issue.dedezoom.com/mcp?project=YOUR_PROJECT_KEY"
http_headers = { "Authorization" = "Bearer ism_live_YOUR_GENERATED_TOKEN", "X-MCP-Project" = "YOUR_PROJECT_KEY" }
```

---

## 💬 วิธีสั่ง Prompt ให้กับ Antigravity, Claude Code, Codex ฯลฯ สำหรับโปรเจกต์ใหม่ (เปิด Session ใหม่)

เมื่อคุณเปิดโฟลเดอร์โค้ดโปรเจกต์ใหม่และ **เปิด Session ใหม่ใน Antigravity, Claude Code หรือ Codex** สามารถคัดลอก Prompt ด้านล่างไปวางสั่งงานได้ทันที (เปลี่ยน `YOUR_PROJECT_KEY` และชื่อโปรเจกต์ให้ตรงกับงานของคุณ):

### 1. Prompt มาตรฐานเมื่อเปิด Session ใหม่ (ดึงคิวงาน -> รีวิว -> แก้โค้ด -> ทดสอบ -> Deploy)
```text
คุณกำลังดูแลโปรเจกต์ "ชื่อโปรเจกต์ของคุณ" (รหัสโปรเจกต์ใน IssueMate คือ projectKey="YOUR_PROJECT_KEY")
ให้เชื่อมต่อและใช้ MCP Server ชื่อ "issuemate" โดยระบุ projectKey="YOUR_PROJECT_KEY" เสมอเพื่อกันพลาดข้ามโปรเจกต์ แล้วทำตามขั้นตอนนี้:
1. เรียก MCP tool `get_ai_context` (ส่ง `projectKey: "YOUR_PROJECT_KEY"`) เพื่อดึงรายการปัญหาและคำถามทั้งหมดที่รอรีวิว (open) และรอแก้ไข (ready_to_fix) ของโปรเจกต์นี้
2. สำหรับแต่ละ Issue ให้เรียก `get_issue` เพื่ออ่านรายละเอียด ขั้นตอนจำลองปัญหา ข้อมูลอุปกรณ์ (Device & Environment Info) และเปิดดูรูปภาพ/ไฟล์แนบทั้งหมดที่ผู้ใช้แนบไว้
3. วิเคราะห์สาเหตุของปัญหา แล้วเรียก `submit_claude_review` บันทึกผลวิเคราะห์ (เลือก decision="fix" พร้อมระบุ fixInstructions และ targetFiles หรือ decision="wont_fix" หากไม่ต้องแก้)
4. แก้โค้ดได้เฉพาะเรื่องที่ `aiFixAllowed: true` (ผู้ดูแลกดอนุมัติให้ AI แก้ไขแล้ว หรือโปรเจกต์เปิดโหมดอัตโนมัติ) — เรื่องที่ยังไม่อนุมัติให้ข้ามไปและห้ามแก้โค้ด
5. เรียก `claim_for_fix` เพื่อรับงานเข้าสู่สถานะกำลังแก้ (fixing) จากนั้นลงมือแก้ไขโค้ดในโปรเจกต์นี้ รันทดสอบให้ผ่านจริง และ Deploy ขึ้นเซิร์ฟเวอร์
6. เมื่อแก้ไขและ Deploy เสร็จเรียบร้อยแล้ว ให้เรียก `mark_deployed` บันทึกผลการแก้ไขและผลการ Deploy กลับเข้า IssueMate ทันที
```

### 2. Prompt สำหรับเริ่มโปรเจกต์ใหม่แกะกล่อง (ให้ AI ถามยืนยันรหัสโปรเจกต์ก่อนสร้างใน IssueMate)
```text
ตอนนี้เรากำลังเริ่มโปรเจกต์ใหม่ ให้ใช้ MCP Server "issuemate" ดำเนินการดังนี้:
1. ถามฉันก่อนว่าต้องการตั้งรหัสย่อโปรเจกต์ (key 2-10 ตัวอักษรภาษาอังกฤษ/ตัวเลข), ชื่อเต็มของโปรเจกต์ (name) และคำอธิบายโปรเจกต์ (description) ว่าอย่างไร
2. เมื่อฉันตอบยืนยันแล้ว ให้เรียก MCP tool `create_project` โดยส่ง `confirmedByUser: true` เพื่อสร้างโปรเจกต์ใน IssueMate
3. เรียก `get_ai_context` โดยระบุ `projectKey` ของโปรเจกต์ใหม่เสมอห้ามปนกับโปรเจกต์อื่น แล้วเริ่มตรวจสอบและแก้ไข Issue ทั้งหมดของโปรเจกต์นี้
```

### 3. Prompt สำหรับสั่งแก้หรือตอบคำถาม Issue เฉพาะข้อ (เช่น `POS-12`)
```text
ให้ใช้ MCP Server "issuemate" (ระบุ projectKey="POS") ดึงข้อมูล Issue รหัส POS-12 ด้วย `get_issue`:
- หากเป็นคำถามการใช้งาน (`type="question"`) ให้ตรวจสอบโค้ดจริงแล้วตอบกลับอย่างละเอียดพร้อมแนบไฟล์/รูปภาพผ่าน `converse_on_issue` และเปลี่ยนสถานะเป็น `deployed`
- หากเป็นบั๊กหรือฟีเจอร์ ให้วิเคราะห์สาเหตุ บันทึก `submit_claude_review` -> ตรวจ `aiFixAllowed` (ถ้ายังไม่อนุมัติให้หยุดรอผู้ดูแล) -> `claim_for_fix` -> แก้ไขโค้ดและรันเทสต์ให้ผ่าน -> บันทึกผลด้วย `mark_deployed`
```

---

## 🛡️ การอนุมัติก่อนให้ AI แก้ไข (Admin Approval Gate) & โหมดอัตโนมัติ

- AI **วิเคราะห์และรีวิวได้ทันที** (`get_issue`, `submit_claude_review`) แต่ **แก้โค้ด/Deploy ได้เฉพาะเรื่องที่ผู้ดูแลอนุมัติแล้ว** — ระบบปฏิเสธ `claim_for_fix`, `mark_deployed` และการเปลี่ยนสถานะเป็น `fixing`/`deployed` ผ่าน MCP ทุกช่องทางจนกว่าจะได้รับอนุมัติ
- ผู้อนุมัติ: **Admin** หรือ **ผู้ดูแลโปรเจกต์ (`project_admin`)** กดปุ่ม **"อนุมัติให้ AI แก้ไข" / "ไม่อนุมัติ"** ในหน้ารายละเอียดเรื่อง (ทำได้เฉพาะในหน้าเว็บ — MCP Token อนุมัติเองไม่ได้)
- **โหมดอัตโนมัติ (ต่อโปรเจกต์)**: ผู้ดูแลเปิดสวิตช์ในแถบ "AI แก้ไขอัตโนมัติ" เมื่อไม่ต้องการเฝ้าจอ — AI แก้เรื่องที่ตรวจสอบแล้วได้ทันที ระบบบันทึกว่า "อนุมัติโดยโหมดอัตโนมัติ" ทุกครั้ง และเรื่องที่ผู้ดูแลกด "ไม่อนุมัติ" ไว้จะไม่ถูกแก้แม้เปิดโหมดนี้
- เรื่องประเภท **คำถาม (`question`)** AI ตอบและปิดเรื่องได้โดยไม่ต้องรออนุมัติ (ไม่มีการแก้โค้ด)
- เปิดเรื่องที่ปิดไปแล้วขึ้นมาใหม่ = ต้องขออนุมัติใหม่
- `get_ai_context` คืน `readyToFixQueue` พร้อม `aiFixAllowed` ของแต่ละเรื่อง และ `get_issue` คืน `aiFixAllowed` / `aiFixBlockedReason`

## 🛠️ รายการ 14 MCP Tools ในระบบ (ล็อกตาม Project)

| Tool Name | รายละเอียดการทำงาน |
| :--- | :--- |
| `get_ai_context` | ดึงคิวงานที่รอรีวิว (`open`/`reviewing`) และคิวที่รอแก้ (`ready_to_fix`/`fixing`) เฉพาะโปรเจกต์ที่ระบุ |
| `list_projects` | แสดงรายการโปรเจกต์ที่ Token นี้มีสิทธิ์เข้าถึง พร้อมจำนวน Issue คงค้าง |
| `create_project` | สร้างโปรเจกต์ใหม่ (มี Confirmation Gate บังคับถามยืนยันผู้ใช้ก่อนด้วย `confirmedByUser: true`) |
| `list_issues` | ค้นหาและกรองรายการ Issue ตามโปรเจกต์ สถานะ ประเภท และความสำคัญ |
| `get_issue` | ดึงข้อมูลเชิงลึกของ Issue พร้อม URL รูปภาพ ไฟล์แนบ และประวัติทั้งหมด (บล็อกทันทีหากข้ามโปรเจกต์) |
| `find_similar_issues` | ค้นหา Issue หรือคำถามที่คล้ายกันในโปรเจกต์ก่อนสร้างรายการใหม่ |
| `create_issue` | สร้างรายการปัญหา/คำถามใหม่ พร้อมอัปโหลดรูปภาพหรือไฟล์แนบ (Base64 / Text / URL) เข้า MinIO S3 |
| `submit_claude_review` | บันทึกผลวิเคราะห์สาเหตุ: เลือก `decision: "fix"` (ย้ายไป `ready_to_fix`) หรือ `decision: "wont_fix"` |
| `claim_for_fix` | รับงานจาก `ready_to_fix` เข้าสู่สถานะ `fixing` แบบ Atomic (ป้องกัน Agent ชนกัน) — ต้องได้รับอนุมัติจากผู้ดูแลก่อน |
| `mark_deployed` | บันทึกผลการแก้ไขและผลการ Deploy ขึ้นเซิร์ฟเวอร์ (`deployed`) |
| `claim_and_plan_issue` | รับเรื่องพร้อมแตก Subtasks แผนการแก้ไขและโพสต์คอมเมนต์ในคำสั่งเดียว |
| `converse_on_issue` | ตอบคอมเมนต์ แนบไฟล์ PDF/รูปภาพประกอบ ติ๊กถูกงานย่อย กดรีแอคชัน และเปลี่ยนสถานะ |
| `update_issue_status` | อัปเดตสถานะของ Issue ตามขั้นตอนใน Pipeline พร้อมบันทึกหมายเหตุ |
| `get_monitor_summary` | ดึงสรุปสถิติ KPI ของ Pipeline แบบเรียลไทม์ |

---

## ⚙️ การติดตั้งและรันระบบ (Local Development)

### 1. คัดลอกไฟล์ตัวแปรสภาพแวดล้อม
```bash
cp .env.example .env.local
```
ตั้งค่า `MONGODB_URI`, `MINIO_*`, `SUPER_ADMIN_EMAIL` และ `SESSION_SECRET` (ความยาวอย่างน้อย 32 ตัวอักษร) ในไฟล์ `.env.local` *(ไฟล์ `.env*` ถูกเพิกเฉยใน `.gitignore` เพื่อป้องกันรหัสผ่านและความลับรั่วไหล)*

### 2. ติดตั้ง Dependencies และรันเซิร์ฟเวอร์
```bash
npm install
npm run dev
```

### 3. คำสั่งตรวจสอบและทดสอบระบบ (Verification & E2E Tests)
```bash
npx tsc --noEmit
npx playwright test
```
