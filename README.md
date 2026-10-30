# IssueMate DevOps — ระบบแจ้งปัญหา & ติดตามงานสำหรับ Antigravity, Claude Code และ Codex

> **Production URL**: [https://issue.dedezoom.com](https://issue.dedezoom.com) · **Version**: `v3.6.0` (แสดงเลขเวอร์ชันและวัน-เวลา Deploy ล่าสุดบนหน้าเว็บและ API `/api/auth/me`)

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

## ✨ จุดเด่นหลักของระบบ (Core Capabilities — `v3.6.0`)

1. **การอนุมัติก่อนให้ AI แก้ไข (`Admin Approval Gate`) & โหมดอัตโนมัติรายโปรเจกต์ (`Per-Project Auto Mode`)**:
   - AI สามารถวิเคราะห์และรีวิว (`submit_claude_review`) ได้ทันที แต่จะแก้โค้ดหรือ Deploy (`claim_for_fix`, `mark_deployed`, เปลี่ยนสถานะเป็น `fixing`/`deployed`) ได้เฉพาะเรื่องที่ผู้ดูแลกด **"อนุมัติให้ AI แก้ไข"** หรือเมื่อโปรเจกต์เปิดสวิตช์ **"โหมดอัตโนมัติ"** เท่านั้น
   - การกด **"ไม่อนุมัติ" (`rejected`)** ชนะโหมดอัตโนมัติเสมอ และเรื่องประเภท **คำถาม (`question`)** AI ตอบกลับพร้อมปิดเรื่องได้ทันทีโดยไม่ต้องรออนุมัติ
2. **ระบบจำโปรเจกต์ล่าสุดที่ใช้ (`Last Active Project Memory`)**:
   - จดจำโปรเจกต์ที่ทำงานล่าสุดไว้ใน `localStorage` และ `?project=KEY` เพื่อป้องกันการแจ้งหรือแก้ไขงานผิดโปรเจกต์
3. **รองรับหัวข้อ "สอบถาม / ตั้งคำถาม" (`question`) & การตอบกลับพร้อมไฟล์ PDF/รูปภาพ**:
   - ผู้ใช้ตั้งคำถามได้ง่าย ทีมงานแนบไฟล์ PDF คู่มือและรูปภาพตอบกลับพร้อมกดปุ่ม **"ส่งคำตอบและปิดเรื่อง"** ในคลิกเดียว เปิดอ่าน PDF ในหน้าจอได้ทันที (`Inline PDF Viewer`)
4. **ระบบสิทธิ์ผู้ใช้งานละเอียดถึงระดับโปรเจกต์ (`Granular Per-Project Permissions`)**:
   - กำหนดสิทธิ์ราย Gmail แยกตามโปรเจกต์ได้ 5 ระดับ: `question_only` (ถามได้อย่างเดียว), `reporter` (แจ้งปัญหา & ถามได้), `viewer` (ดูอย่างเดียว), `developer` (ทีมแก้ไข/ตอบคำถาม), `project_admin` (ผู้ดูแลโปรเจกต์ — มีสิทธิ์อนุมัติให้ AI แก้ไขและเปิด/ปิดโหมดอัตโนมัติ)
5. **เรียงลำดับตามวันที่เวลาสร้าง (`createdAt`) และแสดงวันที่-เวลาครบทุกมุมมอง**:
   - แสดงวันที่และเวลาสร้างชัดเจนทั้งในตารางหลัก (กว้างเต็ม 100% ปรับขนาดคอลัมน์ได้), การ์ดบนมือถือ, บอร์ดติดตามงาน 6 สถานะ (`Kanban`) และหน้าต่างรายละเอียดเรื่อง (`IssueDetailDrawer`)
6. **แจ้งผลการดำเนินการชัดเจนทุกปุ่ม (`Action Response Feedback`) & หน้าจอ `Auto-Responsive + Auto-Refresh`**:
   - ทุกการกดส่งความคิดเห็น เปลี่ยนสถานะ อนุมัติ AI โหวต สร้างรายการ หรือตั้งค่า มีแถบแจ้งเตือนยืนยันผลสำเร็จ/ไม่สำเร็จชัดเจนทันที และซิงค์ข้อมูลอัตโนมัติในพื้นหลังทุก 8 วินาที
7. **ความปลอดภัยระดับ Production (Hardened Auth & CSRF/XSS Protection)**:
   - ล็อกอินผ่าน **Sign in with Google** เท่านั้น เซ็นคุกกี้ด้วย `HMAC-SHA256 (SESSION_SECRET)` พร้อมวันหมดอายุและ `sessionVersion`
   - ซ่อนอีเมลส่วนตัว (`***`) สำหรับผู้ที่ไม่ได้เป็น Admin และบังคับตรวจสิทธิ์โปรเจกต์ทุก API รวมถึงการดาวน์โหลดไฟล์แนบ
8. **หมวดเหตุผลเมื่อปิดแบบไม่แก้ไข (`wontFixCategory`) & การ์ด "คุณภาพเรื่องที่แจ้งเข้ามา"** (`v3.4.0`):
   - ปิดเรื่องเป็น `wont_fix` ต้องเลือกหมวดทุกครั้ง ทั้งหน้าเว็บและ MCP: `test_error` (ตัวทดสอบผิดเอง), `duplicate` (ซ้ำกับเรื่องอื่น), `by_design` (ระบบทำงานตามที่ออกแบบ), `cannot_reproduce` (ทำซ้ำไม่ได้), `other` (อื่นๆ) — ไม่ระบุหมวดจะถูกปฏิเสธ และหมวดจะถูกล้างเมื่อเปิดเรื่องใหม่
   - หน้า Monitor แสดงผู้แจ้ง 6 รายที่ส่งเรื่องมากสุด ว่าถูกปิดแบบไม่แก้ไขกี่เรื่อง (กี่ %) แยกตามหมวด — เรื่องที่ปิดก่อน `v3.4.0` ขึ้นเป็น "ไม่ระบุหมวด" และดึงผ่าน MCP ได้จาก `get_monitor_summary` (`reporterQuality`)
9. **แนบประวัติเรื่องคล้ายอัตโนมัติ (`Similar-Issue History`)** (`v3.4.0`):
   - เมื่อสร้างเรื่องใหม่ ระบบเทียบชื่อเรื่องกับ 300 เรื่องล่าสุดในโปรเจกต์เดียวกัน (ตัดป้าย `[...]` นำหน้าและส่วนหลัง ` — ` ออกก่อนเทียบ) ถ้าคล้ายตั้งแต่ 85% ขึ้นไป จะแนบคอมเมนต์ระบบ **"🔎 พบเรื่องคล้ายที่เคยแจ้งในโปรเจกต์นี้"** สูงสุด 3 เรื่อง พร้อมสถานะ หมวด และผลครั้งก่อน และเพิ่มรหัสเรื่องเหล่านั้นใน `relatedCodes`
10. **ธีม Aurora + Motion Graphics** (`v3.5.0`):
   - พื้นหลังแสง aurora ม่วง-ฟ้าใต้พื้นผิวกระจกฝ้า (`app/globals.css`) และภาพเคลื่อนไหวชุดเดียวทั้งระบบใน `components/ui/Motion.tsx` (ไลบรารี `motion`): สลับมุมมองแบบจางและเลื่อน (`ViewSwitch`), รายการไล่ขึ้นทีละแถว (`rise`), ตัวเลข KPI นับขึ้น (`CountUp`), แท่งกราฟค่อยๆ ยืด (`GrowBar`)
   - ปิดภาพเคลื่อนไหวให้เองเมื่อเครื่องตั้ง "ลดการเคลื่อนไหว" (`MotionConfig reducedMotion="user"` และ `@media (prefers-reduced-motion: reduce)`)
11. **คิวคำถาม + คำตอบเป็น PDF ภาษาไทยที่ IssueMate สร้างเอง (`Question Queue & PDF Answer`)**:
   - คำถาม (`type="question"`) ที่ยังไม่ปิดเข้าคิว `questionQueue` ใน `get_ai_context` เรียงจากเก่าไปใหม่ Antigravity รับคำถามด้วย `claim_question` แล้วตอบด้วย `answer_question` — IssueMate แปลงคำตอบเป็น PDF ด้วย Chromium (สระ/วรรณยุกต์ไทยไม่ลอยไม่ซ้อน) แนบในคอมเมนต์คำตอบ และปิดเรื่องให้ทันที รายละเอียดดูหัวข้อ [คิวคำถาม & คำตอบ PDF](#-คิวคำถาม--คำตอบ-pdf-question-queue)

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

### 1. Prompt มาตรฐานเมื่อเปิด Session ใหม่ (ดึงคิวงาน -> รีวิว -> รออนุมัติ/แก้โค้ด -> ทดสอบ -> Deploy)
```text
คุณกำลังดูแลโปรเจกต์ "ชื่อโปรเจกต์ของคุณ" (รหัสโปรเจกต์ใน IssueMate คือ projectKey="YOUR_PROJECT_KEY")
ให้เชื่อมต่อและใช้ MCP Server ชื่อ "issuemate" โดยระบุ projectKey="YOUR_PROJECT_KEY" เสมอเพื่อกันพลาดข้ามโปรเจกต์ แล้วทำตามขั้นตอนนี้:
1. เรียก MCP tool `get_ai_context` (ส่ง `projectKey: "YOUR_PROJECT_KEY"`) เพื่อตรวจสอบโปรเจกต์และดึงรายการปัญหาทั้งหมดที่รอรีวิว (open) และรอแก้ไข (ready_to_fix)
   - หากยังไม่มีโปรเจกต์ "YOUR_PROJECT_KEY" ในระบบ ให้ถามยืนยันรหัสย่อ (key), ชื่อโปรเจกต์ (name) และคำอธิบาย (description) กับฉันให้เรียบร้อยก่อน แล้วจึงเรียก `create_project` โดยส่ง `confirmedByUser: true`
2. สำหรับแต่ละ Issue ให้เรียก `get_issue` เพื่ออ่านรายละเอียด ขั้นตอนจำลองปัญหา ข้อมูลอุปกรณ์ (Device & Environment Info) และเปิดดูรูปภาพ/ไฟล์แนบทั้งหมดที่ผู้ใช้แนบไว้
3. วิเคราะห์สาเหตุของปัญหา แล้วเรียก `submit_claude_review` บันทึกผลวิเคราะห์ (เลือก decision="fix" พร้อมระบุ fixInstructions และ targetFiles หรือ decision="wont_fix" พร้อม wontFixCategory หากไม่ต้องแก้)
4. แก้โค้ดได้เฉพาะเรื่องที่ `aiFixAllowed: true` (ผู้ดูแลกดอนุมัติให้ AI แก้ไขแล้ว หรือโปรเจกต์เปิดโหมดอัตโนมัติ):
   - เรื่องที่ยังไม่อนุมัติ (`aiFixAllowed: false` / `pending`) ให้รีวิวเสร็จแล้วรอผู้ดูแลอนุมัติ ห้ามแก้โค้ด
   - เรื่องที่ผู้ดูแลกด "ไม่อนุมัติ" (`rejected`) ห้ามแตะโค้ดเด็ดขาดแม้โปรเจกต์เปิดโหมดอัตโนมัติ
   - เรื่องประเภทคำถาม (`type="question"`) ใน `questionQueue` ให้เรียก `claim_question` แล้วตอบด้วย `answer_question` (ระบบสร้าง PDF คำตอบและปิดเรื่องให้เอง ไม่ต้องรออนุมัติ)
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
- หากเป็นคำถามการใช้งาน (`type="question"`) ให้เรียก `claim_question` ตรวจสอบโค้ดจริง แล้วส่งคำตอบอย่างละเอียดด้วย `answer_question` (แนบรูปเพิ่มได้ใน `files`) — IssueMate สร้าง PDF คำตอบและปิดเรื่องเป็น `deployed` ให้เอง
- หากเป็นบั๊กหรือฟีเจอร์ ให้วิเคราะห์สาเหตุ บันทึก `submit_claude_review` -> ตรวจ `aiFixAllowed` (ถ้ายังไม่อนุมัติให้หยุดรอผู้ดูแล) -> `claim_for_fix` -> แก้ไขโค้ดและรันเทสต์ให้ผ่าน -> บันทึกผลด้วย `mark_deployed`
```

---

## 🛡️ การอนุมัติก่อนให้ AI แก้ไข (Admin Approval Gate) & โหมดอัตโนมัติ

- AI **วิเคราะห์และรีวิวได้ทันที** (`get_issue`, `submit_claude_review`) แต่ **แก้โค้ด/Deploy ได้เฉพาะเรื่องที่ผู้ดูแลอนุมัติแล้ว** — ระบบปฏิเสธ `claim_for_fix`, `mark_deployed` และการเปลี่ยนสถานะเป็น `fixing`/`deployed` ผ่าน MCP ทุกช่องทางจนกว่าจะได้รับอนุมัติ
- ผู้อนุมัติ: **Admin** หรือ **ผู้ดูแลโปรเจกต์ (`project_admin`)** กดปุ่ม **"อนุมัติให้ AI แก้ไข" / "ไม่อนุมัติ"** ในหน้ารายละเอียดเรื่อง (ทำได้เฉพาะในหน้าเว็บ — MCP Token อนุมัติเองไม่ได้)
- **โหมดอัตโนมัติ (ต่อโปรเจกต์)**: ผู้ดูแลเปิดสวิตช์ในแถบ "AI แก้ไขอัตโนมัติ" เมื่อไม่ต้องการเฝ้าจอ — AI แก้เรื่องที่ตรวจสอบแล้วได้ทันที ระบบบันทึกว่า "อนุมัติโดยโหมดอัตโนมัติ" ทุกครั้ง และเรื่องที่ผู้ดูแลกด "ไม่อนุมัติ" ไว้จะไม่ถูกแก้แม้เปิดโหมดนี้
- เรื่องประเภท **คำถาม (`question`)** AI ตอบและปิดเรื่องได้โดยไม่ต้องรออนุมัติ (ไม่มีการแก้โค้ด)
- เปิดเรื่องที่ปิดไปแล้วขึ้นมาใหม่ = ต้องขออนุมัติใหม่ (ทั้งการเปลี่ยนสถานะโดยตรงและการเปลี่ยนสถานะพร้อมคอมเมนต์ เช่น `converse_on_issue`)
- เรื่องที่อยู่สถานะ "กำลังแก้ไข" แต่ยังไม่มีการอนุมัติ (เช่น เริ่มแก้ก่อนอัปเกรดเป็น v3.3.0) จะขึ้นในปุ่ม **"รออนุมัติ N เรื่อง"** ด้วย — AI จะ `mark_deployed` ไม่ได้จนกว่าผู้ดูแลจะอนุมัติ
- `get_ai_context` คืน `readyToFixQueue` พร้อม `aiFixAllowed` ของแต่ละเรื่อง และ `get_issue` คืน `aiFixAllowed` / `aiFixBlockedReason`

## ❓ คิวคำถาม & คำตอบ PDF (Question Queue)

- **เป้าหมาย**: ผู้ใช้ตั้งคำถามแล้วรอคำตอบในคิว Antigravity ดึงคิวไปตอบ และผู้ถามได้คำตอบเป็นไฟล์ PDF ภาษาไทยที่เปิดอ่านใน IssueMate ได้ทันที
- **ขั้นตอน**:
  1. ผู้ใช้ที่มีสิทธิ์สร้างเรื่อง (`question_only`, `reporter`, `developer`, `project_admin`) กดปุ่ม "ถามคำถาม" เรื่องจะเข้าสถานะ `open`
  2. `get_ai_context` คืน `questionQueue` (คำถามสถานะ `open`/`reviewing` เรียงจากเก่าไปใหม่ สูงสุด 50 เรื่อง พร้อม `status` และ `assignee`) และ `guideForAi.questionWorkflow`
  3. `claim_question` เปลี่ยน `open` → `reviewing` แบบ Atomic และบันทึกผู้รับเป็น `assignee` — ถ้ามี Agent รับไปก่อนแล้ว คำสั่งจะถูกปฏิเสธ
  4. `answer_question` สร้าง PDF A4 (หัวเรื่อง, คำถาม, คำตอบ, ผู้ตอบ, วันเวลาไทย, เลขหน้า) อัปโหลดเข้า MinIO ชื่อ `answer-<รหัสเรื่อง>.pdf` แนบในคอมเมนต์คำตอบ (`isResolution`) แล้วปิดเรื่องเป็น `deployed`
  5. ผู้ถามเปิดเรื่อง → กดดู PDF ในหน้าจอ (`Inline PDF Viewer`) หรือดาวน์โหลดได้
- **การตั้งค่า**: `PDF_CHROMIUM_PATH` (ไม่บังคับ) = path ของ Chromium/Chrome ที่ใช้สร้าง PDF ถ้าไม่ตั้ง จะใช้ Chromium ที่ `playwright-core` ติดตั้งไว้
- **Dependency**: `playwright-core` (ใช้ตอนรัน) และ Chromium บนเซิร์ฟเวอร์ — บน Ubuntu ติดตั้งด้วย `npx playwright-core install --with-deps chromium-headless-shell` ซึ่งลงฟอนต์ไทย `fonts-tlwg-loma-otf` ให้ด้วย
- **ตัวอย่างการเรียก MCP**:
```json
{ "name": "claim_question", "arguments": { "projectKey": "POS", "code": "POS-12", "agentName": "Antigravity" } }
{ "name": "answer_question", "arguments": { "projectKey": "POS", "code": "POS-12", "agentName": "Antigravity", "answer": "เข้าเมนู ขาย > ใบกำกับภาษี แล้วกดปุ่ม พิมพ์ซ้ำ" } }
```
  ผลลัพธ์ `answer_question`: `{ "status": "answered", "code": "POS-12", "currentStatus": "deployed", "pdf": { "name": "answer-POS-12.pdf", "url": "/api/files/...", "size": 51684 } }`
- **ข้อจำกัด**:
  - คำตอบเป็นข้อความธรรมดา (ขึ้นบรรทัดใหม่ได้ ไม่แปลง Markdown) เหมือนคอมเมนต์บนหน้าเว็บ
  - สร้าง PDF ครั้งละหนึ่ง Chromium (เปิด-ปิดทุกคำตอบ) เหมาะกับคิวคำถามปริมาณปกติ
  - ถ้าไม่ได้ `claim_question` ก่อน และมี Agent สองตัวตอบคำถามเดียวกันพร้อมกัน จะได้คำตอบสองชุด
  - ฟอนต์ใน PDF ใช้ฟอนต์ไทยของเครื่องที่รัน (Windows: Leelawadee UI / Tahoma, Linux: Loma) หน้าตาจึงต่างจากฟอนต์บนเว็บเล็กน้อย

## 🛠️ รายการ 16 MCP Tools ในระบบ (ล็อกตาม Project)

| Tool Name | รายละเอียดการทำงาน |
| :--- | :--- |
| `get_ai_context` | ดึงคิวงานที่รอรีวิว (`open`/`reviewing`), คิวที่รอแก้ (`readyToFixQueue` พร้อม `aiFixAllowed`), คิวคำถาม (`questionQueue` เรียงจากเก่าไปใหม่), สถานะ `projects[].aiAutoMode`, กฎ `guideForAi.aiFixApprovalRule` และยอดค้างอนุมัติ (`queues.awaitingAdminApproval` / `queues.fixingButNotApprovedForDeploy`) |
| `list_projects` | แสดงรายการโปรเจกต์ที่ Token นี้มีสิทธิ์เข้าถึง พร้อมจำนวน Issue คงค้างและสถานะโหมดอัตโนมัติ |
| `create_project` | สร้างโปรเจกต์ใหม่ (มี Confirmation Gate บังคับถามยืนยันผู้ใช้ก่อนด้วย `confirmedByUser: true`) |
| `list_issues` | ค้นหาและกรองรายการ Issue ตามโปรเจกต์ สถานะ ประเภท และความสำคัญ |
| `get_issue` | ดึงข้อมูลเชิงลึกของ Issue พร้อม URL รูปภาพ ไฟล์แนบ และสถานะ `aiFixAllowed` / `aiFixBlockedReason` (บล็อกทันทีหากข้ามโปรเจกต์) |
| `find_similar_issues` | ค้นหา Issue หรือคำถามที่คล้ายกันในโปรเจกต์ก่อนสร้างรายการใหม่ |
| `create_issue` | สร้างรายการปัญหา/คำถามใหม่ พร้อมอัปโหลดรูปภาพหรือไฟล์แนบ (Base64 / Text / URL) เข้า MinIO S3 |
| `submit_claude_review` | บันทึกผลวิเคราะห์สาเหตุ: เลือก `decision: "fix"` (ย้ายไป `ready_to_fix`) หรือ `decision: "wont_fix"` (ต้องระบุ `wontFixCategory`: `test_error` / `duplicate` / `by_design` / `cannot_reproduce` / `other`) |
| `claim_for_fix` | รับงานจาก `ready_to_fix` เข้าสู่สถานะ `fixing` แบบ Atomic (ป้องกัน Agent ชนกัน) — บังคับตรวจ `requireAiFixApproval` ก่อนเสมอ |
| `mark_deployed` | บันทึกผลการแก้ไขและผลการ Deploy ขึ้นเซิร์ฟเวอร์ (`deployed`) — บังคับตรวจ `requireAiFixApproval` ก่อนเสมอ |
| `claim_and_plan_issue` | รับเรื่องพร้อมแตก Subtasks แผนการแก้ไขและโพสต์คอมเมนต์ในคำสั่งเดียว (ตรวจการอนุมัติหากเปลี่ยนเข้า `fixing`/`deployed`) |
| `converse_on_issue` | ตอบคอมเมนต์ แนบไฟล์ PDF/รูปภาพประกอบ ติ๊กถูกงานย่อย กดรีแอคชัน และเปลี่ยนสถานะ (เรื่อง `question` ปิดเป็น `deployed` ได้ทันที; ปิดเป็น `wont_fix` ต้องระบุ `wontFixCategory`) |
| `update_issue_status` | อัปเดตสถานะของ Issue ตามขั้นตอนใน Pipeline พร้อมบันทึกหมายเหตุ (ตรวจการอนุมัติหากเปลี่ยนเข้า `fixing`/`deployed`; ปิดเป็น `wont_fix` ต้องระบุ `wontFixCategory`) |
| `get_monitor_summary` | ดึงสรุปสถิติ KPI ของ Pipeline แบบเรียลไทม์ (รวม `awaitingAiApprovalCount`, `awaitingAiApprovalFixingCount` และคุณภาพเรื่องรายผู้แจ้ง `reporterQuality`) |
| `claim_question` | รับคำถาม (`type="question"`) จากคิว เปลี่ยน `open` → `reviewing` แบบ Atomic กัน Agent ตอบซ้ำ |
| `answer_question` | ส่งคำตอบ: IssueMate สร้าง PDF ภาษาไทยด้วย Chromium แนบในคอมเมนต์คำตอบ และปิดเรื่องเป็น `deployed` ทันที |

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
`answer_question` ต้องมี Chromium สำหรับสร้าง PDF: ติดตั้งด้วย `npx playwright-core install chromium-headless-shell` (บน Linux เพิ่ม `--with-deps`) หรือตั้ง `PDF_CHROMIUM_PATH` ชี้ไปยัง Chromium/Chrome ที่มีอยู่ — `npx playwright test` ส่ง path ของ Chromium ที่ใช้รันเทสต์ให้ dev server เอง

### 3. คำสั่งตรวจสอบและทดสอบระบบ (Verification & E2E Tests)
```bash
npx tsc --noEmit
npx playwright test
```
