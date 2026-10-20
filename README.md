# ARCANA SURVIVOR

## Playable Demo (development)
**P0/P1 prototype source is available in `main` after PR acceptance**; this is an offline local demo, not the commercial game. For local development use **Node 20+**: run `npm run dev` and open `http://localhost:4173`. Run `npm test` for deterministic core and save tests; `npm run build` for distributable static files in `dist/`.

Features: arena combat, auto-targeting, 3 enemy archetypes, 4 upgradeable skills, boss encounter, keyboard/touch controls, offline unlockable visual-only skins, settings and local save. **No real payments, online events, seasonal shop, multiplayer or backend yet.** See [implementation status](docs/IMPLEMENTATION_STATUS.md) for QA scope, limitations, and technical stack decision.


**สถานะ: OFFLINE PROTOTYPE IN MAIN / PARALLEL DEVELOPMENT** — ตัวเกมทดลองเล่นออฟไลน์ได้แล้ว แต่ยังไม่เปิดขายเงินจริงหรือ LiveOps จริง

ARCANA SURVIVOR เป็นเกม 2D fantasy bullet-heaven / survivor สำหรับ Web และมือถือ: ผู้เล่นเดินหลบศัตรู ตัวละครโจมตีอัตโนมัติ เลือกสกิลระหว่างรอบ ต่อสู้กับบอส และสะสมเครื่องแต่งกาย/เอฟเฟกต์ที่สวยงาม

**หลักธุรกิจ: Free-to-Play, Cosmetics-Only, No Pay-to-Win.** สกินฟรี สกินกิจกรรม สกินจากผลงาน สกินคราฟต์ สกินซีซัน และสกินซื้อโดยตรงอยู่ร่วมกันได้ ไม่มีสกินเพิ่ม HP, DPS, ความเร็ว หรือโอกาสชนะ

## เริ่มอ่าน
| เอกสาร | เนื้อหา |
|---|---|
| [วิสัยทัศน์และขอบเขต](docs/PRODUCT_VISION.md) | เสาหลักเกม กลุ่มเป้าหมาย MVP / Future |
| [ระบบเกมเพลย์](docs/GAMEPLAY_SYSTEMS.md) | ลูปเกม ต่อสู้ สกิล บอส ความก้าวหน้า |
| [สกินและ VFX](docs/COSMETICS_VFX.md) | ประเภท ระดับ ความอลังการ ข้อกำหนดประสิทธิภาพ |
| [เศรษฐกิจและร้านค้า](docs/ECONOMY_COMMERCE.md) | เงินเกม รางวัล ราคา การเติมเงินที่ปลอดภัย |
| [กิจกรรมทั้งหมด](docs/EVENTS_PLAYBOOK.md) | Daily / Weekly / Festival / Boss / Challenge / Return |
| [ซีซันปีแรก](docs/SEASONS_YEAR_ONE.md) | 4 ซีซัน ธีม ปฏิทิน คอนเทนต์ และพาส |
| [แค็ตตาล็อกกิจกรรมปีแรก](docs/EVENT_CATALOG_YEAR_ONE.md) | 12 กิจกรรมธีมซีซัน พร้อมเป้าหมาย/รางวัล/การขาย |
| [สถาปัตยกรรม](docs/TECH_ARCHITECTURE.md) | Client, save, server, billing และขอบเขต |
| [สัญญาข้อมูล](docs/DATA_SCHEMA.md) | โครงสร้าง config, ID, state และ validation |
| [สายการผลิตคอนเทนต์](docs/CONTENT_PRODUCTION.md) | การผลิตตัวละคร สกิน อีเวนต์ การตรวจคุณภาพ |
| [แผนพัฒนาและ backlog](docs/ROADMAP_BACKLOG.md) | Phase, dependency, acceptance gates, issues |
| [QA และ LiveOps](docs/QA_LIVEOPS.md) | ทดสอบมือถือ ความเสี่ยง metrics การปล่อยคอนเทนต์ |
| [กฎทำงานร่วมกัน](docs/GOVERNANCE.md) | Branch, PR, ownership, คำสั่งงานแบบสั้น |
| [คู่มือทีมขนาน](docs/TEAM_EXECUTION.md) | ทีม, Role Issues, file ownership, CEO integration, startup messages |
| [สัญญาเชื่อมโมดูล](docs/TEAM_API_CONTRACT.md) | ESM domain events, rewards, event schedule, CEO wiring |

## หลักที่ต้องรักษา
1. เกมเปล่าต้องสนุกก่อนทำร้านค้า; P0 เล่นได้โดยไม่พึ่ง server
2. สกินเป็น data-driven, แยก presentation ออกจาก combat/stat อย่างเด็ดขาด
3. กิจกรรมและซีซันเป็นข้อมูลกำหนดเวลา ไม่ hardcode ในเกม
4. การซื้อเงินจริงต้องผ่าน backend ตรวจหลักฐานและสิทธิ์ ไม่เชื่อ client
5. มีช่องทางรางวัลฟรีที่มีคุณค่าและระบบคืน/นำสกินกิจกรรมกลับมา
6. ลด motion/flash, รองรับมือถือเล็ก, ไม่ใช้ OS alert/menu ใน UI เกม
7. งานส่ง main หลังผ่าน QA; เอกสารเป็น **แผน** ไม่ใช่คำกล่าวอ้างว่าระบบมีแล้ว

[เปิดกระดานงาน GitHub Issues](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues)

**Next action:** ให้แต่ละแชทผู้รับเริ่มงานด้วยข้อความ `ROLE: AP-ROLE #<issue> <issue-url>` ตาม [TEAM_EXECUTION](docs/TEAM_EXECUTION.md); CEO ตรวจ PR รวมเข้า `main` หลัง QA ผ่าน; การขายเงินจริงยัง HOLD

## AWS Amplify Hosting

ตั้งค่า Deploy เว็บเกมผ่าน AWS Amplify Hosting ได้จาก GitHub สาขา `main` โดยใช้ไฟล์ `amplify.yml` และเผยแพร่ไฟล์ใน `dist/` ดูขั้นตอนที่ [คู่มือ Deploy AWS Amplify](docs/DEPLOY_AWS_AMPLIFY.md)
