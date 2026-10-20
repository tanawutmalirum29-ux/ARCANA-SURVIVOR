import { COSMETICS } from '../storage.js';

export const QUALITY_LEVELS = Object.freeze(['low', 'medium', 'high']);
const ROUTES = Object.freeze({
  FREE: { label: 'FREE', availability: 'Available', detail: 'Included for every player.' },
  GOLD: { label: 'GOLD', availability: 'Earn in demo', detail: 'Unlock with 120 earned GOLD in the wardrobe.' },
  ACHIEVEMENT: { label: 'ACHIEVEMENT', availability: 'Earn in demo', detail: 'Defeat 30 enemies in total.' },
  EVENT: { label: 'EVENT', availability: 'Not active', detail: 'Event reward; event is not running.' },
  'SEASON FREE': { label: 'SEASON FREE', availability: 'Coming later', detail: 'Free season track; season is not active.' },
  CRAFT: { label: 'CRAFT', availability: 'Coming later', detail: 'Crafting is not available in this demo.' },
  'PREMIUM PREVIEW': { label: 'PREMIUM PREVIEW', availability: 'Preview only', detail: 'No purchases or paid unlocks are enabled.' },
  'SEASON PREMIUM PREVIEW': { label: 'SEASON PREMIUM PREVIEW', availability: 'Preview only', detail: 'No premium pass or checkout is enabled.' },
});

export function normalizeQuality(value) {
  return QUALITY_LEVELS.includes(value) ? value : 'low';
}

export function visualBudget(quality, reducedMotion = false) {
  const q = normalizeQuality(quality);
  const budgets = {
    low: { dprCap: 1, particles: 0, glow: 0, trails: 0 },
    medium: { dprCap: 1.5, particles: 8, glow: 0.45, trails: 2 },
    high: { dprCap: 2, particles: 20, glow: 1, trails: 5 },
  };
  return Object.freeze({
    ...budgets[q],
    quality: q,
    reducedMotion: Boolean(reducedMotion),
    particles: reducedMotion ? 0 : budgets[q].particles,
    trails: reducedMotion ? 0 : budgets[q].trails,
  });
}

export function getSkinPreview(skinId, profile = {}, catalog = COSMETICS) {
  const skin = catalog.find(item => item.id === skinId) || catalog[0];
  if (!skin) return null;
  // Offline demo never treats a premium preview as an owned entitlement,
  // even if an unsanitized caller supplies a forged profile.
  const previewOnly = skin.source.includes('PREMIUM');
  const owned = !previewOnly && Array.isArray(profile?.owned) && profile.owned.includes(skin.id);
  const equipped = owned && profile.skin === skin.id;
  const route = ROUTES[skin.source] || { label: 'UNKNOWN', availability: 'Unavailable', detail: 'No unlock path is configured.' };
  // Only cosmetic fields are exposed. Preview does not mutate profile or save entitlements.
  return Object.freeze({
    id: skin.id, name: skin.name, subtitle: skin.th, rarity: skin.rarity,
    color: skin.color, glow: skin.glow, projectile: skin.projectile, theme: skin.vfx,
    source: route.label, availability: route.availability, sourceDetail: route.detail,
    description: skin.desc, owned, equipped, canEquip: owned && !equipped,
    premiumPreview: previewOnly,
  });
}

export function getSkinGallery(profile, catalog = COSMETICS) {
  return catalog.map(skin => getSkinPreview(skin.id, profile, catalog));
}

export function createFrameProfiler(maxSamples = 120) {
  const cap = Number.isSafeInteger(maxSamples) && maxSamples > 0 ? Math.min(maxSamples, 600) : 120;
  const samples = new Float64Array(cap);
  let count = 0, cursor = 0;
  return Object.freeze({
    add(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
      samples[cursor] = milliseconds;
      cursor = (cursor + 1) % cap;
      count = Math.min(count + 1, cap);
    },
    snapshot() {
      if (!count) return { count: 0, p95: null };
      const values = Array.from(samples.subarray(0, count)).sort((a, b) => a - b);
      return { count, p95: values[Math.ceil(count * 0.95) - 1] };
    },
  });
}
