# ARCANA SURVIVOR

## Local campaign

ล็อบบี้ 5 แท็บพร้อมฮีโร่ อุปกรณ์ Relics/Artifacts รูน ภูต ผู้พิทักษ์ วิจัย ฐาน ภารกิจและเส้นทางรางวัลฟรี เชื่อมกับการต่อสู้แบบ survivor ที่เดินและยิงอัตโนมัติ มี 3 บทและ 7 โหมด ดูวิธีเล่นและขอบเขตจริงใน [คู่มือ Campaign](docs/CAMPAIGN_GUIDE.md)

ใช้ **Node 20+**: `npm run dev` แล้วเปิด `http://localhost:4173`; `npm test` ตรวจ simulation/progression/save; `npm run build` สร้างเว็บ static ใน `dist/`

เซฟหลักใช้ IndexedDB พร้อมนำเข้าเซฟเดิมครั้งเดียว และรับรางวัลแบบ transaction ป้องกันรับซ้ำ สกินไม่มีค่าพลัง ไม่มีค่าพลังงานหรือการซื้อพลังด้วยเงินจริง **บัญชี cloud, multiplayer, public leaderboard และการชำระเงินยังไม่เปิด**

รายละเอียดสถาปัตยกรรมและหลักฐาน QA อยู่ใน [implementation status](docs/IMPLEMENTATION_STATUS.md) เอกสารวิสัยทัศน์ด้านล่างมีทั้งฟีเจอร์ปัจจุบันและแผนอนาคต ให้ใช้คู่มือ Campaign เป็นรายการฟีเจอร์ runtime

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

กระดาน integration ปัจจุบัน: [#61](https://github.com/tanawutmalirum29-ux/ARCANA-SURVIVOR/issues/61) — รวมเข้า `main` หลัง unit/build, browser matrix และ independent QA ของ head เดียวกันผ่าน

## AWS Amplify Hosting

ตั้งค่า Deploy เว็บเกมผ่าน AWS Amplify Hosting ได้จาก GitHub สาขา `main` โดยใช้ไฟล์ `amplify.yml` และเผยแพร่ไฟล์ใน `dist/` ดูขั้นตอนที่ [คู่มือ Deploy AWS Amplify](docs/DEPLOY_AWS_AMPLIFY.md)
