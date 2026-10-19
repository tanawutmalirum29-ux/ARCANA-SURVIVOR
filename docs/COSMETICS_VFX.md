# Cosmetics, Skin Collection & VFX Engine

## 1. Item slots (composable)
Character outfit, hair/helmet (ถ้ามี), weapon appearance, projectile trail, hit burst, aura, wings, summon/victory animation, profile frame, lobby background, emote. ไม่จำเป็นต้องมีทุก slot ใน MVP.
- Loadout แยก **base hero stats** ออกจาก **cosmetic references**; rendering อ่าน cosmetic_id เท่านั้น
- Skin ที่ซื้อแล้วใส่กับ hero ที่ระบุหรือแบบ universal ตาม catalog; preview ก่อนซื้อ
- ไม่ให้ VFX ของสกินบังตำแหน่งตัวละคร, ศัตรู, hitbox, telegraph บอส

## 2. Rarity means presentation, not power
| Tier | Appearance budget |
|---|---|
| Common | เปลี่ยน palette/outfit |
| Rare | texture + minor particles |
| Epic | custom projectile/hit trail + aura |
| Legendary | custom weapon theme + ability FX + animation + optional sound |
| Mythic | coordinated transformation, ultimate, victory intro, ambient effects with performance fallbacks |
ระดับนี้ไม่กำหนดการเข้าถึง: Epic/Mythic สามารถได้จากกิจกรรม/ผลงานฟรีได้

## 3. Entitlement sources
FREE / ACHIEVEMENT / EVENT / CRAFT / SEASON_FREE / SEASON_PREMIUM / DIRECT_PURCHASE / PROMO (พิจารณาภายหลัง). ทุก entitlement เก็บ source, granted_at, campaign_id, transaction reference ถ้ามี.
- Inventory: owned / equipped / favorites / acquisition source / first owned date
- Duplicates: ในระบบ craft ให้แปลงเป็น dust ตามตาราง; direct purchase ห้ามซื้อซ้ำถ้าไม่ใช่ gift bundle
- Archive gallery แสดง skin ที่เคยมี รวม lock reason และช่องทางกลับมาในอนาคต

## 4. Visual system
- Style: Arcane Royal Fantasy / deep midnight, luminous gold, purple, cyan; มี theme bible และ layer naming
- Asset pipeline: concept -> silhouette -> color variants -> idle/run/cast/hit/death -> particle anchors -> VFX -> preview -> QA -> catalog
- ใช้ sprite sheet/texture atlas, batched particles, object pooling, capped overdraw, reusable shader templates
- VFX quality: Low (ลด particles/glow, ตัด postFX), Medium (balanced), High (full); Auto ลองเลือกตามอุปกรณ์และยอมให้ผู้เล่น override
- ติดตั้ง reduce motion, reduce flashes, lower contrast bloom, hide ally FX (เมื่อมี co-op) และ disable screen shake

## 5. Example first skin lineup (proposal, P1 8 units)
- Free: Apprentice Azure, Verdant Adept, Ember Initiate
- Achievement: Wardenbreaker
- Event: Moonlit Petal, Star Lantern
- Direct Purchase (sandbox until P3): Crimson Sovereign, Celestial Empress
Season Year One เพิ่ม catalog ต่อเนื่อง ไม่จำเป็นต้องสร้างทั้งหมดก่อน prototype.

## 6. Budgets & QA
- เป้าหมาย Low: 30 FPS playable บนมือถือระดับเริ่มต้นที่เลือกทดสอบ; High: 60 FPS on capable hardware; ทดสอบ p95 frame time ไม่ใช้ภาพนิ่งเป็นหลักฐาน
- จำกัด particle emitter และ simultaneous ultimate FX ด้วยค่าปรับจาก profiling ไม่ใส่ตัวเลขจำเพาะก่อน benchmark
- Visual regression: ยืน/เดิน/ยิง/รับดาเมจ/บอส telegraph/โหมด low/หลาย aspect ratios
- ไม่มีสกินไหนแก้ hitbox, damage, cooldown, HP หรือ AI; ทดสอบ data contract และ snapshot combat seed เดียวกัน
