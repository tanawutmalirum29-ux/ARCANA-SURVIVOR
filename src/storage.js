export const COSMETICS = Object.freeze([
  { id: 'apprentice', name: 'ASTRAL APPRENTICE', th: 'นักเวทแห่งดวงดาว', color: '#92c6ff', glow: '#6287ff', projectile: '#d4efff', vfx: 'arcane', rarity: 'COMMON', source: 'FREE', desc: 'สกินเริ่มต้นสำหรับผู้เล่นทุกคน' },
  { id: 'ember', name: 'EMBER SOVEREIGN', th: 'จ้าวแห่งเพลิง', color: '#ffb87d', glow: '#ff5a60', projectile: '#ffe0a3', vfx: 'fire', rarity: 'EPIC', source: 'GOLD', desc: 'ปลดล็อกด้วย 120 GOLD จากการเล่น' },
  { id: 'moon', name: 'MOONLIGHT ORACLE', th: 'เทพพยากรณ์จันทรา', color: '#eac7ff', glow: '#ba70fd', projectile: '#f0e7ff', vfx: 'moon', rarity: 'EPIC', source: 'ACHIEVEMENT', desc: 'กำจัดศัตรูสะสม 30 ตัว' },
  { id: 'lantern', name: 'STAR LANTERN', th: 'โคมดาวนิรันดร์', color: '#ffd6a4', glow: '#f6ae58', projectile: '#ffecbd', vfx: 'lantern', rarity: 'EPIC', source: 'EVENT', desc: 'ตัวอย่างสกินกิจกรรม · ยังไม่เปิดกิจกรรม' },
  { id: 'verdant', name: 'VERDANT GUARDIAN', th: 'ผู้พิทักษ์พฤกษา', color: '#bbf0be', glow: '#52cc8c', projectile: '#d6ffe8', vfx: 'nature', rarity: 'LEGENDARY', source: 'SEASON FREE', desc: 'ตัวอย่างรางวัลซีซันฟรี · ยังไม่เปิดซีซัน' },
  { id: 'aurora', name: 'AURORA SHAPER', th: 'จิตรกรแสงเหนือ', color: '#a3f9ff', glow: '#67b6fc', projectile: '#e4f7ff', vfx: 'aurora', rarity: 'LEGENDARY', source: 'CRAFT', desc: 'ตัวอย่างสกินคราฟต์ · ยังไม่มีระบบคราฟต์' },
  { id: 'crimson', name: 'CRIMSON REGENT', th: 'จักรพรรดิสีชาด', color: '#ff9dbd', glow: '#e53a69', projectile: '#ffb6bc', vfx: 'bloodmoon', rarity: 'MYTHIC', source: 'PREMIUM PREVIEW', desc: 'ตัวอย่างสกินซื้อโดยตรง · ยังไม่มีการชำระเงิน' },
  { id: 'celestial', name: 'CELESTIAL EMPRESS', th: 'ราชินีจักรวาล', color: '#fff0b3', glow: '#d0a4ff', projectile: '#ffefc3', vfx: 'celestial', rarity: 'MYTHIC', source: 'SEASON PREMIUM PREVIEW', desc: 'ตัวอย่างรางวัลพาสพรีเมียม · ยังไม่มีการชำระเงิน' },
]);
const DEMO_GRANTABLE = new Set(['apprentice', 'ember', 'moon']);
export const SAVE_KEY = 'arcana-survivor-v1';
export function defaultProfile() {
  return { version: 1, gold: 0, totalKills: 0, runs: 0, bestSeconds: 0, skin: 'apprentice', owned: ['apprentice'], settings: { vfx: 'high', reduceMotion: false } };
}
export function sanitizeProfile(raw) {
  const base = defaultProfile();
  if (!raw || raw.version !== 1) return base;
  const validIds = DEMO_GRANTABLE;
  const owned = [...new Set(['apprentice', ...(Array.isArray(raw.owned) ? raw.owned : [])].filter(x => validIds.has(x)))];
  const num = n => Number.isFinite(n) ? Math.max(0, Math.min(999999, Math.floor(n))) : 0;
  const settings = { vfx: ['low','medium','high'].includes(raw.settings?.vfx) ? raw.settings.vfx : 'high', reduceMotion: raw.settings?.reduceMotion === true };
  return { version: 1, gold: num(raw.gold), totalKills: num(raw.totalKills), runs: num(raw.runs), bestSeconds: num(raw.bestSeconds), skin: owned.includes(raw.skin) ? raw.skin : 'apprentice', owned, settings };
}
export function loadProfile(storage) {
  try { return sanitizeProfile(JSON.parse((storage ?? globalThis.localStorage)?.getItem(SAVE_KEY) || 'null')); } catch { return defaultProfile(); }
}
export function saveProfile(profile, storage) {
  try { (storage ?? globalThis.localStorage)?.setItem(SAVE_KEY, JSON.stringify(sanitizeProfile(profile))); return true; } catch { return false; }
}
export function awardRun(profile, stats) {
  const next = sanitizeProfile(profile);
  next.runs++;
  next.gold = Math.min(999999, next.gold + Math.max(0, Math.floor(stats.gold || 0)));
  next.totalKills = Math.min(999999, next.totalKills + Math.max(0, Math.floor(stats.kills || 0)));
  next.bestSeconds = Math.max(next.bestSeconds, Math.floor(stats.seconds || 0));
  if (next.totalKills >= 30 && !next.owned.includes('moon')) next.owned.push('moon');
  return next;
}
export function unlockGoldCosmetic(profile, id, cost) {
  const next = sanitizeProfile(profile);
  if (id !== 'ember' || cost !== 120 || next.gold < cost || next.owned.includes(id)) return null;
  next.gold -= cost;
  next.owned.push(id);
  return next;
}
