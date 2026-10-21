# IssueMate DevOps — ระบบแจ้งปัญหา & ติดตามงานสำหรับ Antigravity

> **Production URL**: [https://issue.dedezoom.com](https://issue.dedezoom.com)

ระบบบริหารจัดการปัญหา (Issue Tracker) และติดตามงานแบบครบวงจรบน **`https://issue.dedezoom.com`** ที่ออกแบบให้ผู้ใช้งานทั่วไปใช้งานง่ายที่สุด เน้นการ **แนบรูปภาพหลายรูปและแนบไฟล์เอกสารหลายไฟล์พร้อมกัน** (รวมถึงกด `Ctrl+V` วางภาพแคปหน้าจอได้ทันที) เก็บไฟล์ลง **MinIO S3 Object Storage** และฐานข้อมูล **MongoDB** พร้อมระบบ **Login by Google (Gmail Whitelist ควบคุมโดย Admin พร้อมซ่อนอีเมลเพื่อความเป็นส่วนตัว)** และ **MCP Server v3.0 ที่บังคับระบุโปรเจกต์ (`projectKey`) กันพลาด** สำหรับให้ **Antigravity** ดึงรายการปัญหาไปวิเคราะห์สาเหตุ แก้ไขโค้ด และ Deploy อัตโนมัติ

---

## ✨ จุดเด่นหลักของระบบ (Core Features)

1. **การเข้าสู่ระบบและจัดการสิทธิ์ด้วย Gmail (กำหนดสิทธิ์สมาชิกเลือกได้หลาย Project + ซ่อนอีเมลส่วนตัว)**:
   - ผู้ดูแลระบบสูงสุด (**Super Admin**) เป็นผู้กำหนดรายชื่ออีเมล Gmail (`allowed_users`) ที่ได้รับอนุญาตให้เข้าใช้งานระบบและสร้าง MCP API Token
   - **Gmail สมาชิกเลือกสิทธิ์ได้หลายโปรเจกต์ (`allowedProjects`)**: Admin สามารถกำหนดได้ว่าสมาชิกแต่ละคนเข้าถึงได้ **ทุกโปรเจกต์ (`ALL`)** หรือเลือกติ๊กเฉพาะบางโปรเจกต์ได้หลายโปรเจกต์พร้อมกัน (เช่น `["SMLAIACC", "POS"]`) และสามารถคลิกสลับเพิ่ม/ลดโปรเจกต์ของสมาชิกแต่ละคนได้ทันทีในตาราง Admin
   - **เพิ่มโปรเจกต์ใหม่ได้ทั้ง 2 ช่องทาง**:
     1. เพิ่มผ่าน **หน้าจอ Admin** (`Login by Google` -> ส่วน **"จัดการและเพิ่มโปรเจกต์ใหม่"**) หรือปุ่ม `+ เพิ่มโปรเจกต์` บนหน้าเว็บ
     2. เพิ่มผ่าน **MCP (`create_project`)** โดยระบบบังคับให้ Antigravity **ต้องถามรหัสย่อ (`key`), ชื่อโปรเจกต์ (`name`), และคำอธิบาย (`description`) เพื่อยืนยันกับผู้ใช้งานให้เรียบร้อยก่อน (`confirmedByUser: true`)** จึงจะสร้างโปรเจกต์ให้จริง
   - เมื่อเปิดหน้าเว็บโดยยังไม่ได้ล็อกอินเป็น Admin ระบบจะ **ซ่อนอีเมลอัตโนมัติ** (เช่น `a***n@gmail.com`) เพื่อไม่ให้เปิดเผยอีเมลส่วนตัวสู่สาธารณะ

2. **หน้าจอแจ้งปัญหาที่เรียบง่ายสำหรับผู้ใช้ทั่วไป (Simple Issue Form + Multi-File Upload)**:
   - กรอกเพียง **โปรเจกต์**, **ประเภทเรื่อง**, **ความเร่งด่วน**, **หัวข้อปัญหา** และ **รายละเอียด**
   - **แนบรูปภาพและไฟล์ได้หลายรายการพร้อมกัน**:
     - ลากวางไฟล์ (Drag & Drop) หรือเลือกหลายไฟล์พร้อมกัน (Multi-Select)
     - กด **`Ctrl+V`** เพื่อวางรูปภาพจาก Clipboard (Screenshot) ต่อเนื่องได้หลายรูป
     - แสดง Thumbnail พรีวิวรูปภาพขนาดใหญ่ พร้อม **Full-screen Image Lightbox** สำหรับซูมดูภาพชัดเจนทั้งในรายละเอียด Issue และในช่องคอมเมนต์

3. **MCP บังคับระบุโปรเจกต์ (`projectKey`) กันพลาดข้ามโปรเจกต์ 100%**:
   - ทุก **MCP API Token (`ism_live_<40-hex>`)** จะถูกผูกเข้ากับ **รหัสโปรเจกต์ (`projectKey`)** และ **อีเมล Gmail ผู้ใช้งาน**
   - หาก Antigravity เผลอส่งคำสั่งอ่าน แก้ไข หรือสร้าง Issue ข้ามไปโปรเจกต์อื่นที่ไม่ตรงกับ Token หรือ Header `X-MCP-Project` ระบบจะ **บล็อกทันทีพร้อมแจ้งเตือนภาษาไทยชัดเจน**

4. **Antigravity 6-Stage Pipeline (ใช้ Antigravity ตัวเดียวครบวงจร)**:
   - `open` — **1. รอรีวิว (Pending Antigravity)**
   - `reviewing` — **2. กำลังรีวิว (Antigravity Reviewing)**
   - `ready_to_fix` — **3. รอแก้ (Ready for Antigravity)**
   - `fixing` — **4. กำลังแก้/Deploy (Antigravity Fixing & Deploying)**
   - `deployed` — **5. Deploy แล้ว (Deployed & Verified)**
   - `wont_fix` — **6. ไม่แก้ (Won't Fix / Rejected)**

---

## 👑 วิธีตั้งค่าและเปลี่ยนอีเมลผู้ดูแลระบบสูงสุด (Super Admin Email)

ระบบรองรับการกำหนดและเปลี่ยนอีเมลผู้ดูแลระบบสูงสุด (**Super Admin**) ได้ 2 วิธี:

### วิธีที่ 1: กำหนดผ่านไฟล์ `.env.local` บนเซิร์ฟเวอร์ (แนะนำสำหรับการติดตั้งครั้งแรก)
เปิดไฟล์ `.env.local` แล้วตั้งค่าตัวแปร `SUPER_ADMIN_EMAIL`:
```env
SUPER_ADMIN_EMAIL=your-admin@gmail.com
```
จากนั้นรีสตาร์ทแอปพลิเคชัน (`npm run dev` หรือ `systemctl restart issuemate-web`)

### วิธีที่ 2: เปลี่ยนผ่านหน้าเว็บ UI ทันที (บันทึกลงฐานข้อมูล MongoDB)
1. กดปุ่ม **"Login by Google"** มุมขวาบนของหน้าเว็บ แล้วล็อกอินด้วยอีเมล Admin ปัจจุบัน
2. ไปที่แท็บ **"วิธีตั้งค่า Google OAuth & เปลี่ยนอีเมล Admin"**
3. ในกล่อง **"วิธีเปลี่ยนอีเมลผู้ดูแลระบบสูงสุด (Super Admin Email)"** ให้กรอกอีเมล Gmail ใหม่แล้วกดปุ่ม **"เปลี่ยน Admin"** ระบบจะอัปเดตสิทธิ์ Super Admin ลงฐานข้อมูลทันทีโดยไม่ต้องรีสตาร์ทเซิร์ฟเวอร์

---

## 🔌 การเชื่อมต่อ MCP Server กับ Antigravity (ระบุ Project กันพลาด)

### ขั้นตอนที่ 1: สร้าง MCP Token ผูกกับโปรเจกต์ (`projectKey`)
1. เปิดหน้าเว็บ `https://issue.dedezoom.com` แล้วกดปุ่ม **`MCP`** มุมซ้ายบน
2. เลือก **รหัสโปรเจกต์ (`ระบุโปรเจกต์ กันพลาด`)** เช่น `SMLAIACC`, `DEVOPS`, `KMS`
3. กรอก **อีเมล Gmail ที่ได้รับอนุญาต** แล้วกดปุ่ม **"สร้าง Token"** จะได้รหัส `ism_live_<40-hex>` ที่ล็อกเฉพาะโปรเจกต์นั้น

### ขั้นตอนที่ 2: ตั้งค่า MCP Config ใน Antigravity (ระบุ `?project=` และ `X-MCP-Project`)

#### รูปแบบที่ 1: เชื่อมต่อผ่าน HTTP Header + Project Lock (แนะนำ)
```json
{
  "mcpServers": {
    "issuemate": {
      "url": "https://issue.dedezoom.com/mcp?project=SMLAIACC",
      "headers": {
        "Authorization": "Bearer ism_live_YOUR_GENERATED_TOKEN",
        "X-MCP-Project": "SMLAIACC"
      }
    }
  }
}
```

#### รูปแบบที่ 2: เชื่อมต่อผ่าน URL Query Parameter
```json
{
  "mcpServers": {
    "issuemate": {
      "url": "https://issue.dedezoom.com/mcp?project=SMLAIACC&token=ism_live_YOUR_GENERATED_TOKEN"
    }
  }
}
```
*(เปลี่ยน `SMLAIACC` เป็นรหัสย่อของโปรเจกต์ที่คุณต้องการให้ Antigravity ดูแล)*

---

## 💬 วิธีสั่ง Prompt ให้กับ Antigravity สำหรับโปรเจกต์ใหม่ (เปิด Session ใหม่)

เมื่อคุณเปิดโฟลเดอร์โค้ดโปรเจกต์ใหม่และ **เปิด Session ใหม่ใน Antigravity** สามารถคัดลอก Prompt ด้านล่างไปวางสั่งงานได้ทันที (หรือกดปุ่ม **"คัดลอก Prompt สั่ง Antigravity"** จากหน้าต่าง MCP บนเว็บซึ่งจะเติมรหัสโปรเจกต์ให้อัตโนมัติ):

### 1. Prompt สำหรับเปิด Session ใหม่ เพื่อดึงและเคลียร์งานทั้งหมดในโปรเจกต์
```text
คุณกำลังดูแลโปรเจกต์ "SML Ai Account" (รหัสโปรเจกต์ใน IssueMate คือ projectKey="SMLAIACC")
ให้เชื่อมต่อและใช้ MCP Server ชื่อ "issuemate" โดยระบุ projectKey="SMLAIACC" เสมอเพื่อกันพลาดข้ามโปรเจกต์ แล้วทำตามขั้นตอนนี้:
1. เรียก MCP tool `get_ai_context` (ส่ง `projectKey: "SMLAIACC"`) เพื่อดึงรายการปัญหาทั้งหมดที่รอรีวิว (open) และรอแก้ไข (ready_to_fix) ของโปรเจกต์ SMLAIACC
2. สำหรับแต่ละ Issue ให้เรียก `get_issue` เพื่ออ่านรายละเอียดและเปิดดูรูปภาพ/ไฟล์แนบทั้งหมดที่ผู้ใช้แนบไว้
3. วิเคราะห์สาเหตุของปัญหา แล้วเรียก `submit_claude_review` บันทึกผลวิเคราะห์ (เลือก decision="fix" พร้อมระบุ fixInstructions และ targetFiles หรือ decision="wont_fix" หากไม่ต้องแก้)
4. เรียก `claim_for_fix` เพื่อรับงานเข้าสู่สถานะกำลังแก้ (fixing) จากนั้นลงมือแก้ไขโค้ดในโปรเจกต์นี้ ทดสอบให้ผ่านจริง และ Deploy ขึ้นเซิร์ฟเวอร์
5. เมื่อแก้ไขและ Deploy เสร็จเรียบร้อยแล้ว ให้เรียก `mark_deployed` บันทึกผลการแก้ไขและผลการ Deploy กลับเข้า IssueMate ทันที
```

### 2. Prompt สำหรับสั่ง Antigravity ให้ถามยืนยันและเพิ่มโปรเจกต์ใหม่เข้า IssueMate แล้วเริ่มทำงาน
```text
ตอนนี้เรากำลังเริ่มโปรเจกต์ใหม่ ให้ใช้ MCP Server "issuemate" ดำเนินการดังนี้:
1. ถามฉันก่อนว่าต้องการตั้งรหัสย่อโปรเจกต์ (key 2-10 ตัวอักษร), ชื่อเต็มของโปรเจกต์ (name) และคำอธิบายโปรเจกต์ (description) ว่าอย่างไร
2. เมื่อฉันตอบยืนยันแล้ว ให้เรียก MCP tool `create_project` โดยส่ง `confirmedByUser: true` เพื่อสร้างโปรเจกต์ใน IssueMate
3. เรียก `get_ai_context` โดยระบุ `projectKey` ของโปรเจกต์ใหม่เสมอห้ามปนกับโปรเจกต์อื่น แล้วเริ่มตรวจสอบและแก้ไข Issue ทั้งหมดของโปรเจกต์นี้
```

### 3. Prompt สำหรับสั่งแก้ Issue เฉพาะข้อ (เช่น `SMLAIACC-1`)
```text
คุณกำลังดูแลโปรเจกต์ [SMLAIACC] ให้ดึง Issue SMLAIACC-1 จาก MCP IssueMate (ระบุ projectKey="SMLAIACC") มาดำเนินการโดย Antigravity:
1. เรียก get_issue (SMLAIACC-1) เพื่ออ่านรายละเอียดและดูรูปภาพ/ไฟล์แนบทั้งหมดใน Issue SMLAIACC-1
2. วิเคราะห์สาเหตุของปัญหาแล้วบันทึกผลด้วย submit_claude_review
3. ถ้าต้องแก้ไข ให้รับงาน (claim_for_fix) แก้ไขโค้ดในโปรเจกต์ [SMLAIACC] ทดสอบให้ผ่าน และ Deploy ขึ้นเซิร์ฟเวอร์
4. บันทึกผลการแก้ไขและ Deploy กลับเข้า IssueMate ด้วย mark_deployed
```

---

## 🛠️ รายการ 14 MCP Tools สำหรับ Antigravity (ล็อกตาม Project)

| Tool Name | รายละเอียดการทำงาน |
| :--- | :--- |
| `get_ai_context` | ดึงคิวงานที่รอ Antigravity รีวิว (`open`/`reviewing`) และคิวที่รอแก้ (`ready_to_fix`/`fixing`) เฉพาะโปรเจกต์ที่ระบุ |
| `submit_claude_review` | บันทึกผลวิเคราะห์สาเหตุ: เลือก `decision: "fix"` (ย้ายไป `ready_to_fix`) หรือ `decision: "wont_fix"` |
| `claim_for_fix` | รับงานเข้าสู่สถานะ `fixing` ก่อนเริ่มแก้ไขโค้ด |
| `mark_deployed` | บันทึกผลการแก้ไขและผลการ Deploy ขึ้นเซิร์ฟเวอร์ (`deployed`) |
| `converse_on_issue` | ตอบคอมเมนต์ แนบรูปภาพ/ไฟล์ประกอบ ติ๊กถูกงานย่อย และเปลี่ยนสถานะในคำสั่งเดียว |
| `create_issue` | สร้างรายการปัญหาใหม่ในโปรเจกต์ พร้อมแนบรูปภาพ (URL หรือ Base64) เข้า MinIO S3 อัตโนมัติ |
| `batch_create_issues` | สร้างหลาย Issues พร้อมกันจากการสแกนโค้ดหรือ Log |
| `find_similar_issues` | ค้นหา Issue ที่คล้ายกันในโปรเจกต์ก่อนสร้างรายการใหม่ |
| `manage_subtasks` | เพิ่มหรือติ๊กถูก Checklist งานย่อยใน Issue |
| `get_issue` | ดึงข้อมูลเชิงลึกของ Issue พร้อม URL รูปภาพและไฟล์แนบทั้งหมด (บล็อกทันทีหากอยู่คนละโปรเจกต์) |
| `list_issues` | ค้นหาและกรองรายการ Issue ตามโปรเจกต์ สถานะ และความสำคัญ |
| `update_issue` | อัปเดตข้อมูลและสถานะของ Issue |
| `add_comment` | เพิ่มคอมเมนต์พร้อมแนบไฟล์ |
| `get_monitor_summary` | ดึงสรุปสถิติ KPI ของ Pipeline แบบเรียลไทม์ |

---

## ⚙️ การติดตั้งและรันระบบ (Local Development)

### 1. คัดลอกไฟล์ตัวแปรสภาพแวดล้อม
```bash
cp .env.example .env.local
```
กำหนดค่าการเชื่อมต่อ MongoDB, MinIO และ `SUPER_ADMIN_EMAIL` ในไฟล์ `.env.local` (ไฟล์ `.env*` ถูกตั้งค่าใน `.gitignore` เพื่อป้องกันรหัสผ่านและความลับรั่วไหล)

### 2. ติดตั้ง Dependencies และรันเซิร์ฟเวอร์
```bash
npm install
npm run dev
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3300`

### 3. คำสั่งตรวจสอบและทดสอบระบบ (Verification & E2E Tests)
```bash
npx tsc --noEmit
npx playwright test
```
