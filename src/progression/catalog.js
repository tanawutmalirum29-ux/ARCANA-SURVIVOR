// Original Arcana content. All rewards are earned locally; no paid power.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const MAX_VALUE = 999999;
export const SLOTS = freeze([
  ['weapon', 'อาวุธ', 'weapon', 0], ['armor', 'เกราะ', 'armor', 0],
  ['ring1', 'แหวน I', 'ring', 0], ['ring2', 'แหวน II', 'ring', 0],
  ['locket', 'จี้', 'locket', 0], ['book', 'คัมภีร์', 'book', 0],
  ['bracelet', 'กำไล', 'bracelet', 2], ['spirit1', 'วิญญาณ I', 'spirit', 2],
  ['spirit2', 'วิญญาณ II', 'spirit', 5],
].map(([id, name, type, unlockRuns]) => ({ id, name, type, unlockRuns, description: `ช่อง${name}` })));
export const RARITIES = freeze([
  ['common', 'ธรรมดา', '#a8b4c5'], ['uncommon', 'ดี', '#79d9a4'], ['rare', 'หายาก', '#75baff'],
  ['epic', 'มหากาพย์', '#bd92ff'], ['legendary', 'ตำนาน', '#ffc768'], ['mythic', 'มายา', '#ff859e'],
].map(([id, name, color], index) => ({ id, name, color, index, multiplier: 1 + index * .4, maxLevel: 5 + index * 5, description: `ระดับ ${index + 1} · เลเวลสูงสุด ${5 + index * 5}` })));
export const HEROES = freeze([
  { id: 'mage', name: 'Astra · นักเวทดารา', icon: '✦', description: 'Nova, Orbit และ Chain แรงขึ้น 10%', unlockRuns: 0, unlockCost: {}, maxLevel: 20, maxStars: 5, stats: { maxHp: 100, attack: 22, speed: 230, fireDelay: 24 }, support: { skillMultiplier: .03 } },
  { id: 'guardian', name: 'Orin · ผู้พิทักษ์', icon: '◈', description: 'สร้างเกราะ 12% ของพลังชีวิตทุก 8 วินาที', unlockRuns: 2, unlockCost: { gold: 180, essence: 15 }, maxLevel: 20, maxStars: 5, stats: { maxHp: 135, attack: 20, speed: 210, fireDelay: 27 }, support: { armor: .025 } },
  { id: 'ranger', name: 'Lyra · ผู้ลาดตระเวน', icon: '➶', description: 'เคลื่อนที่ต่อเนื่อง 1 วินาที ทำให้ลูกธนูแรงขึ้น 12%', unlockRuns: 5, unlockCost: { gold: 300, essence: 25 }, maxLevel: 20, maxStars: 5, stats: { maxHp: 90, attack: 21, speed: 250, fireDelay: 21 }, support: { critChance: .025 } },
].map(hero => ({ ...hero, maxAwakening: 3, awakeningStats: { maxHp: 12, attack: 2, critChance: .01 } })));
export const EQUIPMENT = freeze([
  { id: 'star_wand', name: 'คทาดาวตก', slot: 'weapon', icon: '✦', stats: { attack: 3 }, effect: 'balanced', set: 'astral', craftCost: { gold: 60, essence: 6 }, description: 'พลังโจมตีสมดุลสำหรับทุกเวท' },
  { id: 'piercing_staff', name: 'ไม้เท้ารอยแยก', slot: 'weapon', icon: '↟', stats: { attack: 4, fireDelay: 2 }, effect: 'pierce', set: 'sentinel', craftCost: { gold: 80, essence: 8 }, description: 'Bolt ทะลุศัตรูได้ 2 ตัว แลกกับความเร็วโจมตี' },
  { id: 'gale_scepter', name: 'คทาวายุ', slot: 'weapon', icon: '⌁', stats: { attack: 1, fireDelay: -2 }, effect: 'rapid', set: 'verdant', craftCost: { gold: 80, essence: 8 }, description: 'ยิงเร็วขึ้นและ Bolt เคลื่อนที่เร็วขึ้น 15%' },
  { id: 'sentinel_sword', name: 'ดาบพิทักษ์', slot: 'weapon', icon: '⚔', stats: { attack: 3 }, effect: 'balanced', set: 'sentinel', craftCost: { gold: 60, essence: 6 }, description: 'ดาบระยะประชิดของ Orin · ไม่ยิงกระสุน' },
  { id: 'moonsteel_blade', name: 'ดาบเหล็กจันทร์', slot: 'weapon', icon: '⚔', stats: { attack: 4, fireDelay: 2 }, effect: 'cleave', set: 'astral', craftCost: { gold: 85, essence: 8 }, description: 'ฟันวงกว้างโดนศัตรูหลายตัว' },
  { id: 'swift_saber', name: 'ดาบสายลม', slot: 'weapon', icon: '⚔', stats: { attack: 1, fireDelay: -2 }, effect: 'rapid', set: 'verdant', craftCost: { gold: 80, essence: 8 }, description: 'ฟันประชิดถี่ขึ้น' },
  { id: 'oak_bow', name: 'ธนูไม้จันทรา', slot: 'weapon', icon: '➶', stats: { attack: 3 }, effect: 'balanced', set: 'verdant', craftCost: { gold: 60, essence: 6 }, description: 'Lyra ยิงลูกธนูจริง ไม่ใช่เวท' },
  { id: 'thorn_bow', name: 'ธนูหนามทะลวง', slot: 'weapon', icon: '➶', stats: { attack: 4, fireDelay: 2 }, effect: 'pierce', set: 'sentinel', craftCost: { gold: 85, essence: 8 }, description: 'ลูกธนูทะลุศัตรูได้ 2 ตัว' },
  { id: 'storm_bow', name: 'ธนูวายุ', slot: 'weapon', icon: '➶', stats: { attack: 1, fireDelay: -2 }, effect: 'rapid', set: 'astral', craftCost: { gold: 80, essence: 8 }, description: 'ยิงลูกธนูถี่ขึ้น' },
  { id: 'astral_robe', name: 'ผ้าคลุมดารา', slot: 'armor', icon: '♜', stats: { maxHp: 15 }, effect: null, set: 'astral', craftCost: { gold: 60, essence: 6 }, description: 'เพิ่มพลังชีวิตสูงสุด' },
  { id: 'sentinel_plate', name: 'เกราะผู้พิทักษ์', slot: 'armor', icon: '⬡', stats: { maxHp: 10, armor: .018 }, effect: null, set: 'sentinel', craftCost: { gold: 80, essence: 8 }, description: 'เพิ่มพลังชีวิตและลดความเสียหายที่ได้รับ' },
  { id: 'orbit_ring', name: 'แหวนวงโคจร', slot: 'ring', icon: '◉', stats: { critChance: .012, attack: 1 }, effect: null, set: 'astral', craftCost: { gold: 70, essence: 7 }, description: 'เพิ่มคริติคอลและพลังโจมตี' },
  { id: 'hunter_ring', name: 'แหวนผู้ล่า', slot: 'ring', icon: '◎', stats: { bossDamageMultiplier: .025 }, effect: null, set: 'verdant', craftCost: { gold: 70, essence: 7 }, description: 'เพิ่มความเสียหายต่อบอส' },
  { id: 'dawn_locket', name: 'จี้รุ่งอรุณ', slot: 'locket', icon: '◇', stats: { healingMultiplier: .05, maxHp: 5 }, effect: null, set: 'sentinel', craftCost: { gold: 80, essence: 8 }, description: 'เพิ่มผลการฟื้นฟูและพลังชีวิต' },
  { id: 'nova_book', name: 'คัมภีร์ซูเปอร์โนวา', slot: 'book', icon: '▣', stats: { skillMultiplier: .025 }, effect: null, set: 'astral', craftCost: { gold: 90, essence: 9 }, description: 'เพิ่มความเสียหายเวททั้งหมด' },
  { id: 'pulse_bracelet', name: 'กำไลชีพจร', slot: 'bracelet', icon: '⟐', stats: { fireDelay: -.6, critDamage: .04 }, effect: null, set: 'verdant', craftCost: { gold: 90, essence: 9 }, description: 'โจมตีเร็วขึ้นและคริติคอลแรงขึ้น' },
  { id: 'moon_spirit', name: 'วิญญาณจันทร์', slot: 'spirit', icon: '☾', stats: { pickupRadius: 8, healingMultiplier: .025 }, effect: null, set: 'sentinel', craftCost: { gold: 100, essence: 10 }, description: 'ขยายระยะเก็บและเพิ่มผลการรักษา' },
  { id: 'ember_spirit', name: 'วิญญาณถ่านไฟ', slot: 'spirit', icon: '✷', stats: { attack: 2, skillMultiplier: .015 }, effect: null, set: 'verdant', craftCost: { gold: 100, essence: 10 }, description: 'เพิ่มพลังโจมตีและเวท' },
]);
export const GEAR_SETS = freeze([
  { id: 'astral', name: 'ดารา', description: '2 ชิ้น: โจมตี +2 · 4 ชิ้น: พลังเวท +4%', bonuses: [{ pieces: 2, stats: { attack: 2 } }, { pieces: 4, stats: { skillMultiplier: .04 } }] },
  { id: 'sentinel', name: 'พิทักษ์', description: '2 ชิ้น: HP +12 · 4 ชิ้น: ลดความเสียหาย +2%', bonuses: [{ pieces: 2, stats: { maxHp: 12 } }, { pieces: 4, stats: { armor: .02 } }] },
  { id: 'verdant', name: 'พฤกษา', description: '2 ชิ้น: คริติคอล +2% · 4 ชิ้น: ความเร็ว +8', bonuses: [{ pieces: 2, stats: { critChance: .02 } }, { pieces: 4, stats: { speed: 8 } }] },
]);
export const CHAPTERS = freeze([
  { id: 'astral', name: '01 · ลานดารา', icon: '✦', description: 'ฝ่าคลื่นมอนสเตอร์และปราบผู้กลืนดาว', requires: null, enemyHpMultiplier: 1, enemyDamageMultiplier: 1, spawnMultiplier: 1, bossAtSeconds: 180, bossHpMultiplier: 1, bossName: 'ผู้กลืนดาว' },
  { id: 'grove', name: '02 · ป่าคราส', icon: '♧', description: 'ศัตรูแข็งแกร่งขึ้นท่ามกลางหมู่ไม้จันทรา', requires: 'astral', enemyHpMultiplier: 1.35, enemyDamageMultiplier: 1.15, spawnMultiplier: 1.1, bossAtSeconds: 240, bossHpMultiplier: 1.3, bossName: 'ราชาพฤกษาคราส' },
  { id: 'citadel', name: '03 · ป้อมรอยแยก', icon: '♜', description: 'การทดสอบสุดท้ายของเส้นทางดารา', requires: 'grove', enemyHpMultiplier: 1.7, enemyDamageMultiplier: 1.3, spawnMultiplier: 1.2, bossAtSeconds: 300, bossHpMultiplier: 1.6, bossName: 'จอมราชารอยแยก' },
]);
export const MODES = freeze([
  { id: 'campaign', name: 'ผจญภัย', icon: '⚔', description: 'ปราบบอสเพื่อเปิดบทถัดไป', unlockRuns: 0 },
  { id: 'hard', name: 'ท้าทาย', icon: '◆', description: 'ศัตรูแข็งแกร่งขึ้น · ทองเพิ่ม 35%', requires: 'astral', rewardMultiplier: 1.35 },
  { id: 'resource', name: 'ขุมพลัง', icon: '✧', description: 'เอาชีวิตรอด 90 วินาที · Essence เพิ่มเป็นสองเท่า', unlockRuns: 1, durationSeconds: 90 },
  { id: 'bossRush', name: 'ล่าบอส', icon: '♛', description: 'ปราบบอสต่อเนื่อง 3 ตัว · Research เพิ่ม', requires: 'astral' },
  { id: 'expedition', name: 'สำรวจ', icon: '⌖', description: 'บอส 3 ด่าน · ชิ้นส่วน Relic เพิ่ม', requires: 'grove' },
  { id: 'daily', name: 'ทดสอบประจำวัน', icon: '☀', description: 'ชุดพลังมาตรฐานและ seed ร่วมตามวันบนอุปกรณ์นี้ · โบนัสชนะวันละครั้ง', unlockRuns: 2 },
  { id: 'endless', name: 'ไร้สิ้นสุด', icon: '∞', description: 'บอสทุก 120 วินาที เล่นจนพ่ายแพ้', unlockRuns: 5 },
]);
export const RELICS = freeze([
  ['compass', 'เข็มทิศดารา', 'dawn', { attack: .6 }], ['astrolabe', 'จักรราศีจำลอง', 'dawn', { critChance: .003 }],
  ['sun_coin', 'เหรียญตะวัน', 'dawn', { maxHp: 3 }], ['dawn_seal', 'ตรารุ่งอรุณ', 'dawn', { healingMultiplier: .01 }],
  ['moon_shard', 'เศษเสี้ยวจันทร์', 'dusk', { skillMultiplier: .006 }], ['eclipse_lens', 'เลนส์คราส', 'dusk', { bossDamageMultiplier: .008 }],
  ['night_quill', 'ขนนกราตรี', 'dusk', { speed: 1 }], ['star_map', 'แผนที่ดวงดาว', 'dusk', { pickupRadius: 2 }],
  ['root_crown', 'มงกุฎรากไม้', 'wild', { armor: .003 }], ['amber_seed', 'เมล็ดอำพัน', 'wild', { maxHp: 3 }],
  ['wind_bell', 'ระฆังวายุ', 'wild', { fireDelay: -.08 }], ['phoenix_ash', 'เถ้าฟีนิกซ์', 'wild', { critDamage: .008 }],
].map(([id, name, set, stats]) => ({ id, name, set, stats, icon: '◇', maxLevel: 10, maxStars: 5, unlockFragments: 5, conversion: { fragments: 1, dust: 1 }, description: 'สะสม 5 ชิ้นส่วนเพื่อปลดล็อก โบนัสติดตัวทุกชุด · สะสมครบชุด 4 ชิ้น เพิ่มพลังชีวิต 10 · เมื่อเลเวลและดาวเต็ม แลกชิ้นส่วนส่วนเกินเป็น Dust ได้' })));
export const TALENTS = freeze([
  ['vitality', 'พลังชีวิต', { maxHp: 8 }, 0], ['power', 'พลังเวท', { attack: 1.5 }, 0], ['agility', 'คล่องตัว', { speed: 3 }, 0],
  ['tempo', 'จังหวะร่าย', { fireDelay: -.5 }, 0], ['ward', 'คุ้มกัน', { armor: .008 }, 0], ['focus', 'สมาธิ', { critChance: .01 }, 0],
  ['precision', 'แม่นยำ', { critDamage: .03 }, 5], ['magnet', 'แรงดึงดูด', { pickupRadius: 4 }, 5], ['renewal', 'ฟื้นฟู', { healingMultiplier: .025 }, 5],
  ['arcana', 'ญาณเวท', { skillMultiplier: .015 }, 5], ['slayer', 'พิฆาตบอส', { bossDamageMultiplier: .02 }, 5], ['resilience', 'ความอดทน', { maxHp: 5, armor: .004 }, 5],
].map(([id, name, stats, requiresLevels]) => ({ id, name, stats, requiresLevels, maxLevel: 5, icon: '✦', description: `โบนัสถาวรต่อระดับ${requiresLevels ? ' · ต้องมีพรสวรรค์รวม 5 ระดับ' : ''}` })));
export const RUNES = freeze([
  { id: 'power', name: 'รูนพลัง', category: 'attack', stats: { attack: 1 }, description: 'เพิ่มพลังโจมตี' },
  { id: 'spell', name: 'รูนญาณ', category: 'attack', stats: { skillMultiplier: .012 }, description: 'เพิ่มพลังเวท' },
  { id: 'guard', name: 'รูนพิทักษ์', category: 'defense', stats: { armor: .005 }, description: 'ลดความเสียหายที่ได้รับ' },
  { id: 'life', name: 'รูนชีวิต', category: 'defense', stats: { maxHp: 6 }, description: 'เพิ่มพลังชีวิต' },
  { id: 'haste', name: 'รูนวายุ', category: 'utility', stats: { speed: 2, fireDelay: -.12 }, description: 'เคลื่อนที่และโจมตีเร็วขึ้น' },
  { id: 'harvest', name: 'รูนเก็บเกี่ยว', category: 'utility', stats: { pickupRadius: 4 }, description: 'ขยายระยะเก็บประสบการณ์' },
].map(x => ({ ...x, icon: '◈', maxLevel: 10 })));
export const JEWELS = freeze([
  { id: 'ruby', name: 'ทับทิม', stats: { attack: .7 }, description: 'เพิ่มพลังโจมตี' },
  { id: 'sapphire', name: 'ไพลิน', stats: { maxHp: 4 }, description: 'เพิ่มพลังชีวิต' },
  { id: 'emerald', name: 'มรกต', stats: { critChance: .004 }, description: 'เพิ่มโอกาสคริติคอล' },
  { id: 'topaz', name: 'บุษราคัม', stats: { skillMultiplier: .008 }, description: 'เพิ่มความเสียหายเวท' },
].map(x => ({ ...x, icon: '♦', maxLevel: 10 })));
export const ARTIFACTS = freeze([
  { id: 'hourglass', name: 'นาฬิกาทรายนิรันดร์', icon: '⌛', description: 'ชะลอศัตรูเป็นช่วง ๆ · ระดับเพิ่มระยะเวลาชะลอ', maxLevel: 5 },
  { id: 'lantern', name: 'โคมพิทักษ์', icon: '◉', description: 'สร้างโล่ป้องกันเป็นช่วง ๆ · ระดับเพิ่มขนาดโล่', maxLevel: 5 },
  { id: 'sunburst', name: 'หัวใจสุริยะ', icon: '☀', description: 'ระเบิดพลังรอบตัวเป็นช่วง ๆ · ระดับเพิ่มความเสียหาย', maxLevel: 5 },
]);
export const COMPANIONS = freeze([
  { id: 'wisp', name: 'ภูตแสง', icon: '✧', description: 'ยิงประกายเวทใส่ศัตรู · ระดับเพิ่มความเสียหาย', maxLevel: 5 },
  { id: 'owl', name: 'นกฮูกดารา', icon: '◕', description: 'ยิงเวทชิ่งระหว่างศัตรู · ระดับเพิ่มความเสียหาย', maxLevel: 5 },
  { id: 'sprite', name: 'ภูตพฤกษา', icon: '♧', description: 'ฟื้นฟูพลังชีวิตเป็นระยะ · ระดับเพิ่มผลรักษา', maxLevel: 5 },
]);
export const GUARDIANS = freeze([
  { id: 'phoenix', name: 'ฟีนิกซ์รุ่งอรุณ', icon: '♨', description: 'ฟื้นคืนชีพได้หนึ่งครั้งต่อรอบและรักษาเป็นระยะ', maxLevel: 5 },
  { id: 'tortoise', name: 'เต่าศิลาจันทรา', icon: '⬡', description: 'สร้างเกราะคุ้มกันเป็นระยะ', maxLevel: 5 },
  { id: 'dragon', name: 'มังกรเพลิงฟ้า', icon: '♜', description: 'พ่นพลังไฟรอบตัวเป็นระยะ', maxLevel: 5 },
]);
export const RESEARCH = freeze([
  { id: 'sigils', name: 'ศาสตร์สัญลักษณ์', icon: '⌘', stats: { skillMultiplier: .018 }, description: 'เพิ่มความเสียหายเวท', maxLevel: 10 },
  { id: 'totems', name: 'เสาพิทักษ์', icon: '♜', stats: { maxHp: 7, armor: .003 }, description: 'เพิ่มพลังชีวิตและการป้องกัน', maxLevel: 10 },
  { id: 'altars', name: 'แท่นดารา', icon: '✦', stats: { attack: 1, bossDamageMultiplier: .008 }, description: 'เพิ่มพลังโจมตีและความเสียหายบอส', maxLevel: 10 },
]);
export const BUILDINGS = freeze([
  { id: 'garden', name: 'สวนพฤกษา', icon: '♧', produces: 'essence', amountPerLevel: 2, stats: { maxHp: 3 }, description: 'ผลิตรอบละ 2 Essence ต่อระดับ และเพิ่ม HP 3 ต่อระดับ', maxLevel: 10 },
  { id: 'observatory', name: 'หอดูดาว', icon: '⌖', produces: 'research', amountPerLevel: 1, stats: { skillMultiplier: .005 }, description: 'ผลิตรอบละ 1 Research ต่อระดับ และเพิ่มพลังเวท', maxLevel: 10 },
  { id: 'archive', name: 'หอจดหมายเหตุ', icon: '▤', produces: 'dust', amountPerLevel: 1, stats: { pickupRadius: 2 }, description: 'ผลิตรอบละ 1 Dust ต่อระดับ และขยายระยะเก็บ', maxLevel: 10 },
]);
export const MISSIONS = freeze([
  { id: 'daily_run', name: 'ออกเดินทาง', period: 'daily', stat: 'runs', target: 1, reward: { gold: 25, essence: 3 } },
  { id: 'daily_kills', name: 'ผู้พิทักษ์ประจำวัน', period: 'daily', stat: 'kills', target: 50, reward: { gold: 50, dust: 3 } },
  { id: 'daily_win', name: 'ชัยชนะวันนี้', period: 'daily', stat: 'wins', target: 1, reward: { research: 5, essence: 8 } },
  { id: 'weekly_runs', name: 'นักสำรวจประจำสัปดาห์', period: 'weekly', stat: 'runs', target: 10, reward: { gold: 200, essence: 25 } },
  { id: 'weekly_kills', name: 'กำราบฝูงอสูร', period: 'weekly', stat: 'kills', target: 500, reward: { research: 20, dust: 15 } },
  { id: 'weekly_wins', name: 'ผู้พิชิตประจำสัปดาห์', period: 'weekly', stat: 'wins', target: 3, reward: { gold: 150, research: 15 } },
  { id: 'first_run', name: 'ก้าวแรก', period: 'lifetime', stat: 'runs', target: 1, reward: { gold: 60, essence: 10 } },
  { id: 'hundred_kills', name: 'นักล่าอสูร', period: 'lifetime', stat: 'kills', target: 100, reward: { gold: 100, dust: 10 } },
  { id: 'first_win', name: 'ดาวแห่งชัยชนะ', period: 'lifetime', stat: 'wins', target: 1, reward: { gold: 150, research: 10 } },
  { id: 'upgrader', name: 'ช่างฝึกหัด', period: 'lifetime', stat: 'upgrades', target: 3, reward: { gold: 60, essence: 15 } },
  { id: 'crafter', name: 'ผู้สร้างของวิเศษ', period: 'lifetime', stat: 'crafted', target: 3, reward: { gold: 100, dust: 10 } },
  { id: 'veteran', name: 'นักเดินทางชำนาญ', period: 'lifetime', stat: 'runs', target: 25, reward: { gold: 300, research: 25, dust: 25 } },
].map(x => ({ ...x, icon: '✓', description: `${x.stat} ${x.target} · ${x.period === 'daily' ? 'ประจำวัน' : x.period === 'weekly' ? 'ประจำสัปดาห์' : 'ครั้งเดียว'}` })));
export const SHOP_OFFERS = freeze([
  { id: 'essence_bundle', name: 'ถุง Essence', icon: '✧', description: '60 Gold แลก 12 Essence', cost: { gold: 60 }, reward: { essence: 12 } },
  { id: 'dust_bundle', name: 'ผงอัญมณี', icon: '♦', description: '5 Research แลก 8 Dust', cost: { research: 5 }, reward: { dust: 8 } },
  ...RELICS.map(r => ({ id: `fragment_${r.id}`, name: `ชิ้นส่วน${r.name}`, icon: r.icon, description: '5 Research แลกชิ้นส่วน Relic 2 ชิ้น', cost: { research: 5 }, reward: { relicFragments: [{ id: r.id, amount: 2 }] } })),
]);
export const SEASON_REWARDS = freeze(Array.from({ length: 50 }, (_, i) => ({ id: `chronicle_${i + 1}`, tier: i + 1, name: `บันทึกดารา ${i + 1}`, description: 'เส้นทางสะสมฟรีถาวร · ไม่มีวันหมดอายุ', xp: (i + 1) * 100, reward: { gold: 25 + (i + 1) * 5, essence: 5, ...(i % 5 === 4 ? { research: 10, dust: 10 } : {}) } })));
export const FEATURE_RUNS = freeze({ equipment: 0, heroes: 0, shop: 0, missions: 0, season: 0, presets: 0, forge: 1, talents: 1, relics: 1, artifacts: 2, companions: 2, runes: 3, jewels: 3, homestead: 3, research: 4, refine: 4, glyph: 4, guardians: 5, support: 5 });
