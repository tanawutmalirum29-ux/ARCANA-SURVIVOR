# Project Workflow & Owner Rules

## 1. Single source of truth
รีโปนี้เป็นแหล่งจริงสำหรับ ARCANA SURVIVOR เท่านั้น; **ไม่โยง governance เกมอื่น**. main คือสถานะที่ผ่าน QA แล้ว; docs คือข้อกำหนดที่กำลังวางแผน ไม่เท่ากับฟีเจอร์พร้อมใช้.

## 2. Lightweight roles
- OWNER: เสนอแนวคิด/รับรายงานสั้น ๆ ไม่จำเป็นต้องส่งต่อแชทยาว
- DESIGN LEAD: ดูหลักการเกม, economy, events, season, content specs
- ENGINEER: ลงมือสร้าง feature ตาม issue contract, เขียน tests
- ART/VFX: สกิน asset pipeline, performance fallbacks
- QA/REVIEWER: ตรวจ acceptance และ browser/device จริง
คนเดียวรับหลายบทบาทได้ในทีมขนาดเล็ก แต่ไม่ให้อ้างว่าทดสอบเสร็จทั้งที่ยังไม่มีหลักฐาน

## 3. Workflow
1. ทุกงานเริ่มจาก GitHub Issue มี scope, dependency, acceptance, evidence และ target phase
2. แตก branch ชื่อ feat/arc-xx-short-name; PR -> review -> CI -> QA -> squash merge main
3. Docs-only ที่ OWNER สั่งให้ลง main โดยตรงทำได้ เมื่อไม่ชนการเปลี่ยนแปลงและมี commit เดียวตรวจสอบย้อนหลังได้
4. ห้ามแก้ combat balance โดยเป็นงานเพิ่ม skin; design change มีบันทึกใน Issue
5. ทีมงานแยก mission ได้ และเมื่อ merge + closeout ให้จบ assignment ไม่ต้องมีองค์กรพิธีการหลายชั้น

## 4. Minimal chat commands (proposal)
- **I** = สรุปโครงการ/คำสั่งย่อ
- **MN** = ตรวจงานที่ต้องทำต่อ
- **TR** = ลองทำงานค้างหรือ blocker ซ้ำเมื่อแก้เหตุแล้ว
- **C** = อนุมัติ/ส่งงานที่กำลังขออนุมัติ (ต้องระบุเป้าหมาย/ขอบเขตล่าสุดชัด)
คำสั่งนี้เป็นรูปแบบการสื่อสารมนุษย์/AI **ไม่ใช่ฟังก์ชันที่ระบบ GitHub รองรับโดยอัตโนมัติ**

## 5. Reporting format
STATUS: DONE / IN_PROGRESS / BLOCKED
PROOF: PR/commit/issue URL
NEXT: หนึ่ง action ชัดเจน
BLOCKER: เฉพาะเมื่อมีจริง
ไม่มีการสร้างสถานะว่า merge/test ผ่านโดยไม่มีหลักฐาน
