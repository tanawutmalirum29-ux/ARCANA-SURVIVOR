// Pure presentation-only skin catalog. Never grant cosmetics from this catalog.
export const HERO_IDS = Object.freeze(['mage', 'guardian', 'ranger']);
export const SKIN_VARIANTS = Object.freeze(['base', 'ember', 'moon', 'lantern', 'verdant', 'aurora', 'crimson', 'celestial']);
const BASE = Object.freeze({
  mage: { primary: '#99c9ff', color: '#99c9ff', glow: '#6287ff', projectile: '#d4efff', shadow: '#23305d', trim: '#f1deb7', metal: '#d8e6ff' },
  guardian: { primary: '#a0d9b1', color: '#a0d9b1', glow: '#59c795', projectile: '#b9f7ce', shadow: '#1d4739', trim: '#f3d6a5', metal: '#d9f3e5' },
  ranger: { primary: '#ebb991', color: '#ebb991', glow: '#df9666', projectile: '#ffe0b5', shadow: '#563526', trim: '#f1d29a', metal: '#e9e3ca' },
});
const VARIANT = Object.freeze({
  ember: { primary: '#ffb87d', color: '#ffb87d', glow: '#ff5a60', projectile: '#ffe0a3', shadow: '#6d2529', trim: '#ffe1b0', metal: '#ffb9a4' },
  moon: { primary: '#eac7ff', color: '#eac7ff', glow: '#ba70fd', projectile: '#f0e7ff', shadow: '#43265f', trim: '#f9e5ff', metal: '#eadcff' },
  lantern: { primary: '#ffd6a4', color: '#ffd6a4', glow: '#f6ae58', projectile: '#ffecbd' },
  verdant: { primary: '#bbf0be', color: '#bbf0be', glow: '#52cc8c', projectile: '#d6ffe8' },
  aurora: { primary: '#a3f9ff', color: '#a3f9ff', glow: '#67b6fc', projectile: '#e4f7ff' },
  crimson: { primary: '#ff9dbd', color: '#ff9dbd', glow: '#e53a69', projectile: '#ffb6bc' },
  celestial: { primary: '#fff0b3', color: '#fff0b3', glow: '#d0a4ff', projectile: '#ffefc3' },
});
const MODE = Object.freeze({ base: 'base', ember: 'earnedGold', moon: 'achievement',
  lantern: 'preview', verdant: 'preview', aurora: 'preview', crimson: 'preview', celestial: 'preview' });
export const SKIN_CATALOG = Object.freeze(HERO_IDS.flatMap(heroId =>
  SKIN_VARIANTS.map(variant => Object.freeze({
    id: `${heroId}:${variant}`, heroId, variant, unlockMode: MODE[variant],
    ...BASE[heroId], ...(VARIANT[variant] || {}),
  }))
));
const BY_ID = new Map(SKIN_CATALOG.map(skin => [skin.id, skin]));
export const baseSkinId = heroId => HERO_IDS.includes(heroId) ? `${heroId}:base` : null;
export const getSkinDefinition = skinId => BY_ID.get(skinId) || null;
export function listSkinsForHero(heroId) {
  return HERO_IDS.includes(heroId) ? Object.freeze(SKIN_CATALOG.filter(skin => skin.heroId === heroId)) : Object.freeze([]);
}
export function wardrobeFromLegacy(profile) {
  const result = {};
  for (const heroId of HERO_IDS) {
    const owned = [baseSkinId(heroId)];
    for (const variant of ['ember', 'moon']) if (profile.owned.includes(variant)) owned.push(`${heroId}:${variant}`);
    result[heroId] = { owned, equipped: `${heroId}:${profile.skin === 'apprentice' ? 'base' : profile.skin}` };
  }
  return result;
}
// Read-only view fallback; persistence must validate the entire save strictly.
export function getEquippedSkin(campaign, heroId) {
  if (!HERO_IDS.includes(heroId)) return null;
  const item = campaign?.progression?.wardrobe?.[heroId];
  const candidate = item?.equipped;
  const skin = getSkinDefinition(candidate);
  return skin?.heroId === heroId && Array.isArray(item?.owned) && item.owned.includes(candidate)
    && skin.unlockMode !== 'preview' ? candidate : baseSkinId(heroId);
}
export function validateWardrobe(wardrobe) {
  if (!wardrobe || typeof wardrobe !== 'object' || Array.isArray(wardrobe)
      || Object.keys(wardrobe).length !== HERO_IDS.length) return false;
  return HERO_IDS.every(heroId => {
    const slot = wardrobe[heroId];
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)
        || Object.keys(slot).length !== 2 || !Object.hasOwn(slot, 'owned') || !Object.hasOwn(slot, 'equipped')
        || !Array.isArray(slot.owned) || new Set(slot.owned).size !== slot.owned.length
        || !slot.owned.includes(baseSkinId(heroId)) || !slot.owned.includes(slot.equipped)) return false;
    return slot.owned.every(id => {
      const skin = getSkinDefinition(id);
      return skin?.heroId === heroId && skin.unlockMode !== 'preview';
    });
  });
}
export function validateAppearance(appearance, heroId, wardrobe) {
  if (!appearance || typeof appearance !== 'object' || Array.isArray(appearance)
      || Object.keys(appearance).length !== 2 || appearance.heroId !== heroId
      || !Object.hasOwn(appearance, 'skinId')) return false;
  const skin = getSkinDefinition(appearance.skinId);
  return skin?.heroId === heroId && skin.unlockMode !== 'preview'
    && wardrobe?.[heroId]?.owned?.includes(appearance.skinId) === true;
}
