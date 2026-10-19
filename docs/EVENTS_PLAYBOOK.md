# Live Events Framework — Event Types, Rules, Lifecycle

## 1. Engine design
ทุกกิจกรรมสร้างจาก config: event_id, type, title, start_at/end_at (UTC), timezone display, requirements, objectives, counters, caps, rewards, event_shop, art pack, localization, status, archive/return policy.
- Server authoritative clock/reward grant เมื่อออนไลน์; prototype offline แค่ simulated test events ไม่ให้ redeem สินค้ามูลค่าจริง
- Quest counter idempotent; anti-abuse; audit event grants; support compensation; rollback switch
- กิจกรรมต้องไม่ล็อก main gameplay, ไม่ขาย stat advantage, มี accessibility fallback

## 2. Recurring cadence (proposed, adjust after player tests)
| Cadence | Event | Rule | Reward / anti-FOMO |
|---|---|---|---|
| Daily | Daily Orders | 3 missions เลือกทำ: ชนะรอบ/ใช้ skill/สะสม XP | Gold, Season XP; ไม่ต้อง streak ทุกวัน |
| Daily | Free Login Claim | รับรางวัล 1 ครั้ง/วัน, makeup option พิจารณา | Gold/dust; ไม่มี Mythic ผูก streak |
| Weekly | Weekly Arcane Trials | 5 missions และ milestone | Dust, tokens, season XP |
| Weekly | Boss Hunt | boss modifier เปลี่ยนทุกสัปดาห์ (solo) | free frame, crafting material, achievement |
| Biweekly | Themed Event | 2-week quest chain + token shop + mini story | event skin มีทางหาได้ฟรี |
| Monthly | Boss Rush / Arena Challenge | คะแนนจาก seed/กติกาเท่ากัน (ยังไม่ PvP) | titles/frames, non-power rewards |
| Seasonal | 12-week Season Pass | 50 levels dual track | free & premium cosmetics |
| Annual | Anniversary | community milestones + retrospectives | free memorial skin |
| Return | Archive Rerun | นำสกินเก่าบางรายการกลับมาตามเกณฑ์ | สำหรับผู้พลาด event |

## 3. Event design templates
**A. Token Festival**: เล่นโหมดปกติ/ทำภารกิจรับ tokens, event shop มี free recolor, aura, title, featured skin. Tokens มี weekly earning cap ที่ประกาศและ catch-up ต่อสัปดาห์.

**B. Event Boss**: บอสพิเศษหนึ่งตัวกับท่าโจมตีที่อ่านง่าย; ชนะ 1/3/5 ครั้งปลดล็อกธง, frame, skin; ไม่มีการซื้อแต้มชนะ.

**C. Challenge Ladder**: 5 ชั้นความยาก ผู้เล่นใหม่ผ่านชั้นต้นได้; item cosmetic สูงต้องใช้ skill ไม่ใช่การเติมเงิน; มี assist mode แต่ไม่แข่งขัน leaderboard เดียวกับ challenge hard.

**D. Daily Puzzle / Rune Quest**: เก็บชิ้นส่วนรูนจากแผนที่/เลือก build; เหมาะผู้เล่นเล่นสั้น; ไม่ lock ของสำคัญไว้ที่ทำทุกวันติดกัน

**E. Community Goal**: รวมยอดเล่น/ชนะจากฝั่งเซิร์ฟเวอร์, ทุกคนรับรางวัลตาม milestone; พร้อมกรณีจำนวนผู้เล่นไม่ถึงเป้าและระบบป้องกันโกง

**F. Seasonal Story Chapters**: 4 act narratives, quest branch สั้น, cosmetic lore sets, boss skin recolor; narrative ไม่เปลี่ยนค่าสถานะ

**G. Comeback Week**: ผู้เล่นหายไป 14+ วันรับ catch-up missions และ access ผ่าน archive; หลีกเลี่ยงการให้ของเหนือผู้เล่นประจำ

**H. Seasonal Showcase**: แสดงผลงานจัดชุด/ภาพถ่ายผ่าน gallery ในอนาคต; เมื่อมี uploads ต้องมี moderation, report, privacy & consent; ไม่มีใน P1

## 4. Standard two-week event lifecycle
D-28 brief/owner and reward budget -> D-21 design/art requirements -> D-14 content lock -> D-10 implementation + validation -> D-7 QA -> D-3 staging rehearsal -> D0 publish -> Daily health check -> D+14 close -> D+15 claim grace window -> D+21 economy review and retrospective.
- Event activation ต้องมี operator, backup operator, rollback plan, monitoring/metrics and clear end time
- Event entry/claim cutoff แยกกัน: claim grace ช่วยคนที่ทำสำเร็จทันเวลาแต่กดรับช้า
- Timezones: store canonical UTC, UI แสดงเวลาท้องถิ่นพร้อมวัน/เดือนชัด; leap year/DST tests

## 5. Sample recurring event catalog
- Star Lantern Parade: เก็บโคมจาก wave drops, แลกรับ moon glow trail
- Verdant Bloom: ปลดล็อกแผนที่พฤกษา, rune puzzle, free flower wings
- Crimson Eclipse Hunt: บอส eclipse, no-hit challenge, shadow aura
- Frostlight Festival: winter arena modifier, daily candle missions, aurora trail
- Founder's Celebration: anniversary quest chain, profile badge & exclusive commemorative free outfit
- Crossovers: ทำได้ก็ต่อเมื่อมีสิทธิ์ใช้งาน IP และขอบเขตสัญญาชัด; ไม่สมมติว่าได้รับสิทธิ์แล้ว

## 6. Balancing & UX check
- ทุก event ต้องระบุ 1) กลุ่มผู้เล่นเป้าหมาย 2) เวลาเล่นโดยประมาณ 3) กติกา 4) เส้นทางรางวัลฟรี 5) รางวัล paid-only ถ้ามี 6) เงื่อนไขการกลับมา 7) การชดเชยเมื่อเกิด incident
- ไม่แอบเปลี่ยน end time หรือ requirement ระหว่าง event ยกเว้น hotfix ที่ประกาศ
- แยก maintenance และ compensation ledger จาก reward ledger, ไม่ให้ของซ้ำจาก retry
