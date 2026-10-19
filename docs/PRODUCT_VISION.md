# Product Vision & Scope — ARCANA SURVIVOR

## 1. Product thesis
เกม survivor เวทมนตร์ 2D ที่เล่นรอบสั้น บังคับง่ายบนมือถือ ภาพสวย สกิลอลังการ และของสะสมที่ผู้เล่นอยากโชว์; เน้นไลฟ์ไซเคิลคอนเทนต์โดยไม่เพิ่มความเก่งจากการใช้เงินจริง

### 3 Pillars
- **Instant fun:** เริ่มรอบในไม่กี่จังหวะ; เดินหลบ, auto-attack, build สกิลง่ายแต่เลือกได้หลายแนว
- **Visual identity:** สกิน/ออร่า/กระสุน/วงเวท/ท่าไม้ตาย/ชัยชนะ มีเอกลักษณ์; ตั้งค่า low graphics ได้
- **Fair collection:** มีเส้นทาง ฟรี/ภารกิจ/กิจกรรม/ผลงาน/คราฟต์/พาส/ซื้อโดยตรง; ทุกคนเล่นเนื้อหาหลักได้

### Audience & platform
ผู้เล่นทั่วไปที่ชอบ survivor/สะสมแฟชั่น, เล่น 8–12 นาทีต่อรอบ, แนวตั้งเป็นค่าเริ่มต้นแต่รองรับแนวนอน; เปิดเว็บ/มือถือก่อน รองรับ desktop keyboard ภายหลัง. อายุผู้เล่นหลากหลาย: การตลาด การชำระเงิน และการเก็บข้อมูลต้องคำนึงถึงผู้เยาว์ตามตลาดที่เปิดให้บริการ

## 2. Core loop
ล็อบบี้ -> เลือกฮีโร่/สกิน -> เข้าแผนที่ -> เคลื่อนที่หลบและโจมตีอัตโนมัติ -> เก็บ EXP/เลือกสกิล -> บอส -> รับของรางวัล -> อัปเกรด/สะสม/ภารกิจ -> เล่นใหม่
- เป้าหมายรอบปกติ: 10 นาที (ช่วงทดสอบ 8–12 นาที)
- รอบแพ้ยังรับความคืบหน้าบางส่วน ไม่ล็อกผู้เล่นใหม่
- มีเป้าหมายระยะยาวที่ไม่บังคับเติมเงิน

## 3. Scope gates
| Gate | Included | Explicitly excluded |
|---|---|---|
| P0 Prototype | 1 hero, 1 map, 3 enemy archetypes, 1 boss, movement, auto attack, 4 skills, XP, win/lose, offline local save, 2 demo skins | Shopเงินจริง, multiplayer, ranking |
| P1 Vertical Slice | 2 heroes, 2 maps, 8+ skills, 8 sample skins, wardrobe, currency loop, achievements, basic missions, VFX tiers | real-money payment, competitive leaderboards |
| P2 Soft Launch | Account/cloud save, validated inventory, shop preview/direct purchase sandbox, live-event templates, season-pass infrastructure, telemetry, support flow | Startเงินจริงก่อน audit |
| P3 Commercial | Verified billing, refunds, entitlement sync, live events/seasons, admin tools, moderation, anti-fraud | การเพิ่มพลังด้วยเงินจริง |
| Later | Co-op, social plaza, guilds, cross-platform cloud, UGC โดยผ่านการประเมินต้นทุนและความเสี่ยง | ไม่ผูกวันส่งมอบล่วงหน้า |

## 4. North-star measures (targets for testing, not forecasts)
- สำเร็จ tutorial, first-run completion, D1/D7 retention, crash-free sessions
- Frame-time p95 บนเครื่องทดสอบขั้นต่ำ, แพ้เพราะมองเอฟเฟกต์ไม่เห็นหรือไม่
- จำนวนผู้ใช้สกินฟรี/กิจกรรมเทียบกับสกินเสียเงิน; complaint เรื่อง pay-to-win = 0
- วัดคอนเทนต์รายซีซันจากความสนุกและความสามารถผู้เล่นจะกลับมาร่วม ไม่ใช่ยอดขายอย่างเดียว

## 5. Product decisions
- **Single-player first** ลด dependency ต่อเซิร์ฟเวอร์และโกงแรงก์
- **Portrait first, landscape compatible** HUD ไม่บังแผนที่/ตัวละคร
- **No loot boxes at launch** ราคาและของที่จะได้รับต้องแสดงชัดเจน
- **No FOMO-only ownership** ของกิจกรรมบางส่วนกลับมาได้ผ่าน Archive Shop หลังช่วงพักตามเงื่อนไขประกาศ
- Pricing, exact event dates, launch markets, and legal/payment rules remain **TBD** until platform/compliance review.
