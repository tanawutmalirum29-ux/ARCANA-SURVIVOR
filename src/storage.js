export const COSMETICS = Object.freeze([
  { id: 'apprentice', name: 'ASTRAL APPRENTICE', th: 'นักเวทแห่งดวงดาว', color: '#92c6ff', glow: '#6287ff', rarity: 'FREE', desc: 'สกินเริ่มต้นที่ทุกคนได้รับฟรี' },
  { id: 'ember', name: 'EMBER SOVEREIGN', th: 'จ้าวแห่งเพลิง', color: '#ffb87d', glow: '#ff5a60', rarity: 'GOLD', desc: 'แลก 120 เหรียญทองจากการเล่น' },
  { id: 'moon', name: 'MOONLIGHT ORACLE', th: 'เทพพยากรณ์จันทรา', color: '#eac7ff', glow: '#ba70fd', rarity: 'ACHIEVEMENT', desc: 'สะสมกำจัดศัตรู 30 ตัว' },
]);
export const SAVE_KEY = 'arcana-survivor-v1';
export function defaultProfile() {
  return { version: 1, gold: 0, totalKills: 0, runs: 0, bestSeconds: 0, skin: 'apprentice', owned: ['apprentice'], settings: { vfx: 'high', reduceMotion: false } };
}
export function sanitizeProfile(raw) {
  const base = defaultProfile();
  if (!raw || raw.version !== 1) return base;
  const validIds = new Set(COSMETICS.map(i => i.id));
  const owned = [...new Set(['apprentice', ...(Array.isArray(raw.owned) ? raw.owned : [])].filter(x => validIds.has(x)))];
  const num = n => Number.isFinite(n) ? Math.max(0, Math.min(999999, Math.floor(n))) : 0;
  const settings = { vfx: raw.settings?.vfx === 'low' ? 'low' : 'high', reduceMotion: raw.settings?.reduceMotion === true };
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
