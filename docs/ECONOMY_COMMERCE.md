# Economy, Store, Rewards & Monetization Plan

## 1. Currency model
| Currency | Source | Spending | Real-money convertible? |
|---|---|---|---|
| Gold | เล่นรอบ, missions, achievements | Free cosmetics, upgrade unlocks, shop rotations | ไม่ |
| Arcane Dust | boss, craft, duplicate conversion เฉพาะที่ออกแบบ | Craft cosmetics, recolors | ไม่ |
| Event Tokens | กิจกรรมตามช่วงเวลา | Event shop, event cosmetics/materials | ไม่ |
| Season XP | season objectives/gameplay | Season reward track | ไม่ |
| Astral Gems | ซื้อผ่าน provider; อาจแจกแบบ non-purchasable promo credits แยกยอด | Premium direct-cosmetic purchases | ไม่สามารถ cash-out |

- Ledger ต้องแยก earned balance, paid balance, promo balance, transaction history, idempotency; virtual balances ที่มีมูลค่าต้อง validate server
- Seasonal/event token conversion ตอนหมดกิจกรรม **ประกาศก่อน**; ตัวอย่าง: เหลือ -> Gold ตามเพดานและอัตราใน event config
- Gold earn/sink ต้องวัดจาก telemetry; ห้ามเพิ่มระบบเงินหลายชนิดจนผู้เล่นสับสน

## 2. Acquisition lanes
- Free earned: Gold shop, tutorial, level milestones
- Achievement-only: skill mastery / no-hit challenge / boss milestones
- Event: objective chains, boss drops, token shop, community global goals (progress controlled server)
- Craft: สูตรชัด, ต้องแสดงไอเทมใช้ไป, preview ก่อนยืนยัน
- Season: free track และ paid track ที่มีแต่ cosmetics/convenience ที่ไม่เพิ่มความเก่งในการแข่งขัน
- Premium: ขายสกินโดยตรงและ bundle ที่ราคา/ของชัดเจน; no lootbox/gacha in launch scope

## 3. Pricing (hypotheses, THB, not approved live prices)
Rare 39, Epic 99, Legendary 199, Mythic 349; **ต้อง validate** ต้นทุน/ภาษี/platform fees/ความพึงพอใจก่อนตั้งราคาจริง
- ผู้เล่นเห็นราคาสุดท้าย, item ID, ภาพ preview, ส่วนประกอบ bundle และเงื่อนไขคืนเงินก่อนยืนยัน
- ไม่ใช้ countdown ปลอม, dark patterns, หรือขาย stat boosters; การซื้อไม่เพิ่มโอกาสชนะ
- ร้านค้าหมุนเวียนแบบ curated; display period และ return-policy ของ item อย่างชัดเจน
- สิทธิ์ผู้เยาว์: ตรวจนโยบายแพลตฟอร์ม/ตลาด และการยินยอมก่อนเปิด payment

## 4. Purchase state machine
Draft cart -> checkout intent (server) -> payment provider -> server verifies signed receipt/webhook -> grant entitlement idempotently -> client refresh inventory
- pending/rejected/refunded/chargeback/granted states, reconciliation queue; ห้ามเชื่อ client flag paid=true
- One purchase ID grants once; no duplicate inventory; on refund entitlement revocation under published policy & support flow
- Cross-device recovery and purchase restore for supported channels
- Platform rules, taxes, privacy requirements, virtual currency expiration checked before commercial launch; no legal assumptions in prototype

## 5. Reward fairness & sinks
- Mission and run rewards generated from validated rules with per-day/season limits; no pay gate for core stages
- Cosmetics มี free earnable aspirational target ทุกซีซัน (อย่างน้อย 1 tier สูง)
- จ่ายแล้วไม่ต้อง grind เพื่อใช้สินค้าที่ซื้อ; free route มีเป้าหมายระยะสมเหตุผล
- ก่อนเปิดอีเวนต์ ทดสอบว่าผู้เล่นที่เล่น 3 sessions/week ยังเก็บ event reward หลักได้โดยไม่ต้องเติม
- Balance review ดู acquisition/consumption, median time to rewards, duplicate rate, refund rate, support incidents
