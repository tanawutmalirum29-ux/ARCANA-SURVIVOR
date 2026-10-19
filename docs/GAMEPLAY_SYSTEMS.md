# Game Design Specification

## 1. Controls & camera
- 2D top-down arena, joystick สัมผัสฝั่งซ้าย หรือ drag-to-move; คีย์บอร์ด WASD/ลูกศร; pause/settings ด้วย UI ของเกม
- Auto-target ศัตรูในระยะตามกฎ deterministic, ไม่ยิงผ่านฉากที่ขวาง; มี aim-assist เฉพาะบางสกิล
- กล้องติดตามตัวละคร ขอบเขตแผนที่ชัดเจน; มี safe area, scaling, ไม่กดค้างแล้วเลือกข้อความหรือ browser zoom
- HUD: HP, XP, timer, skill slots, current objective, pause; ตั้งค่า compact/damage numbers/reduced VFX

## 2. Combat rules
- Tick จำลองความเสียหาย/คูลดาวน์/สุ่มศัตรูแบบ fixed simulation step; Render แยก FPS
- Stats: MaxHP, Attack, Armor, MoveSpeed, CooldownRate, CritChance, CritDamage, PickupRange; มี clamp และ cap
- Priority: enemy AI -> movement -> attack/hit -> status effect -> death/XP -> spawn -> victory/fail. ระบุลำดับเพื่อทดสอบ replay ได้
- Enemy types P0: Swarmer (ไว/บาง), Brute (ช้า/ถึก), Ranged Cultist (ยิงไกล)
- Boss P0: Starfall Warden มี 3 telegraphed patterns, damage window, enrage ตอนไทม์กำหนด; เอฟเฟกต์เตือนต้องต่างจากสกินผู้เล่น
- แพ้เมื่อ HP <= 0; ชนะเมื่อกำจัดบอสปลายรอบ; pause หยุด simulation tick เท่านั้น

## 3. Skills & builds
P0: Arcane Bolt (auto projectile), Frost Nova (slow/zone), Flame Orbit (AOE), Lightning Chain (bounce). เลือก 1 จาก 3 เมื่อเลเวลขึ้น; max active slots 4 ใน P0 และพิจารณาขยายเป็น 6 ใน P1.
- สกิลแต่ละชนิดมี level 1–5; ค่าดาเมจ scale ด้วยตาราง ไม่กระโดดไม่สมเหตุผล
- Rare upgrades ต้องมี prerequisite และ UI บอกผลก่อนเลือก
- Passive เพิ่ม HP, cooldown, pickup, movespeed; ไม่มี stat แอบมาจาก skin ID

## 4. Meta-progression
- Profile level ปลดล็อกอาชีพ/โหมดตาม milestone ไม่ใช่ปิด paywall
- Free currency (Gold) จากการจบ/แพ้ตามส่วน; material จาก boss/challenge; skill unlock ได้จาก mission
- Achievement แยก combat, exploration, streak แบบไม่บังคับ daily login; รางวัล cosmetic/material
- Daily/weekly missions เป็นเป้าหมายเสริม และ reroll หรือ alternative สำหรับผู้เล่นที่ไม่มีเวลาทุกวัน

## 5. Content expansion
- Hero roles: Mage (burst), Guardian (survivability), Ranger (mobility); ทุก role มี baseline power budget เทียบกัน
- Biomes: Astral Ruins, Emerald Grove, Eclipse Citadel, Frost Cathedral; collision/spawn tables/biome bosses แยก data
- Future modes: Endless score, Boss Rush, Daily Challenge (seed เหมือนกัน), Co-op optional หลัง network readiness
- Level scaling: wave table มี max spawn, concurrent enemy, threat-budget; challenge modifiers เลือกเพิ่มความยากเพื่อรางวัลเกมเพลย์ ไม่ใช่เพื่อบังคับซื้อ

## 6. Balancing & acceptance
- P0 baseline: เปิดเกม -> เข้า arena -> เล่นจนชนะหรือแพ้ -> รับผล -> กลับล็อบบี้ -> เล่นใหม่ได้
- ไม่มี weapon lock / stat buff จากสกิน; QA ตรวจสลับสกินก่อน/หลังรอบแล้ว damage log เท่ากันเมื่อ seed เดียวกัน
- ความยากต้องมี indicator telegraph ชัดเจน, safe-zone เมื่อเกิด, invincibility frame หลังโดน, accessibility mode
- รายการตัวเลขด้านบนเป็นค่าตั้งต้นสำหรับ prototype; ปรับจาก playtest และบันทึกเหตุผลใน balance change log
