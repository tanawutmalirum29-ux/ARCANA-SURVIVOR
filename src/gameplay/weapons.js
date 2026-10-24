// Deterministic single source of truth for character combat equipment.
// Unknown and legacy weapons never become cross-class power upgrades.
export const HERO_WEAPON_CLASSES=Object.freeze({mage:'staff',guardian:'sword',ranger:'bow'});
export const WEAPON_CLASS_BY_ID=Object.freeze({
  star_wand:'staff',piercing_staff:'staff',gale_scepter:'staff',
  sentinel_sword:'sword',moonsteel_blade:'sword',swift_saber:'sword',
  oak_bow:'bow',thorn_bow:'bow',storm_bow:'bow',
});
export const heroWeaponClass = heroId => HERO_WEAPON_CLASSES[heroId] || null;
export const weaponClass = weaponId => typeof weaponId === 'string' &&
  Object.hasOwn(WEAPON_CLASS_BY_ID,weaponId) ? WEAPON_CLASS_BY_ID[weaponId] : null;
export const weaponCompatible = (heroId,weaponId) =>
  weaponId === null || (heroWeaponClass(heroId)!==null && weaponClass(weaponId)===heroWeaponClass(heroId));
