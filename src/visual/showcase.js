import { COSMETICS } from '../storage.js';
import { createFrameProfiler, getSkinGallery, getSkinPreview, normalizeQuality, visualBudget } from './presentation.js';
import { paintSkinPreview } from './paint.js';
import {renderHeroActor} from '../characters/visual/hero-art.js';
import {resolveHeroPose} from '../characters/motion/index.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

export function showcaseMarkup({ profile = {}, selectedId = 'apprentice', quality = 'medium', reducedMotion = false, catalog = COSMETICS } = {}) {
  const entries = getSkinGallery(profile, catalog);
  if (!entries.length) return '';
  const skin = getSkinPreview(selectedId, profile, catalog);
  const q = normalizeQuality(quality);
  const status = skin.equipped ? 'EQUIPPED' : skin.owned ? 'OWNED' : 'LOCKED · PREVIEW ONLY';
  const options = ['low', 'medium', 'high'].map(option =>
    `<button type="button" class="vfx-chip ${q === option ? 'selected' : ''}" data-vfx-quality="${option}" aria-pressed="${q === option}">${option.toUpperCase()}</button>`).join('');
  const cards = entries.map(entry =>
    `<button type="button" class="vfx-catalog-item ${skin.id === entry.id ? 'selected' : ''}"
      data-vfx-skin="${escapeHTML(entry.id)}" aria-pressed="${skin.id === entry.id}"
      style="--vfx-color:${escapeHTML(entry.glow)}">
       <span class="vfx-swatch" aria-hidden="true">✦</span>
       <span class="vfx-entry-text"><b>${escapeHTML(entry.name)}</b><small>${escapeHTML(entry.source)} · ${entry.owned ? 'OWNED' : 'LOCKED'}</small></span>
       <span aria-hidden="true">›</span>
     </button>`).join('');

  return `<section class="main-card vfx-showcase" aria-label="Skin showcase">
    <header class="vfx-showcase-head">
      <div><div class="eyebrow">ARCANE ATELIER · 8 SKINS</div><h2>SKIN SHOWCASE</h2></div>
      <button type="button" class="button secondary vfx-close" data-vfx-close aria-label="Back to wardrobe">← BACK</button>
    </header>
    <div class="vfx-showcase-grid">
      <div class="vfx-preview-panel" style="--vfx-color:${escapeHTML(skin.glow)}">
        <div class="vfx-title"><span>${escapeHTML(skin.rarity)}</span><strong>${escapeHTML(status)}</strong></div>
        <canvas class="vfx-showcase-canvas" width="340" height="310" role="img" aria-label="Animated cosmetic preview of ${escapeHTML(skin.name)}"></canvas>
        <h3>${escapeHTML(skin.name)}</h3>
        <p class="vfx-subtitle">${escapeHTML(skin.subtitle)}</p>
        <p class="vfx-acquire"><b>HOW TO GET · ${escapeHTML(skin.source)}</b><span>${escapeHTML(skin.availability)} — ${escapeHTML(skin.sourceDetail)}</span></p>
        <p class="vfx-warning">${skin.premiumPreview ? 'PREMIUM CONCEPT — NOT FOR SALE · NO CHECKOUT' : 'COSMETIC ONLY · NO STAT ADVANTAGE'}</p>
        ${skin.canEquip ? `<button class="button primary wide" type="button" data-vfx-equip="${escapeHTML(skin.id)}">EQUIP OWNED SKIN</button>` :
          `<div class="vfx-lock-state" aria-live="polite">${skin.equipped ? 'CURRENTLY EQUIPPED' : skin.owned ? 'ALREADY OWNED' : 'PREVIEW DOES NOT UNLOCK OR EQUIP'}</div>`}
      </div>
      <div class="vfx-options-panel">
        <div class="vfx-setting-title">VISUAL QUALITY</div>
        <div class="vfx-choice-group" role="group" aria-label="Effect quality">${options}</div>
        <button type="button" class="vfx-motion-control" data-vfx-motion aria-pressed="${!!reducedMotion}">
          Reduced motion / flash <b>${reducedMotion ? 'ON' : 'OFF'}</b>
        </button>
        <div class="vfx-performance" data-vfx-performance aria-live="off">Effect preview · procedural fallback</div>
        <div class="vfx-setting-title">COLLECTION · ${entries.filter(e => e.owned).length} / ${entries.length} OWNED</div>
        <div class="vfx-catalog" role="group" aria-label="Choose any skin to preview">${cards}</div>
      </div>
    </div>
  </section>`;
}

/**
 * Standalone, cosmetic-only UI. Caller owns profile persistence and entitlement checks.
 * Returns a teardown callback; no writes to profile, storage or combat state.
 */
export function mountSkinShowcase({
  host, profile = {}, catalog = COSMETICS, initialSkinId,
  quality = profile?.settings?.vfx || 'medium',
  reducedMotion = profile?.settings?.reduceMotion === true,
  onClose = () => {}, onEquip = () => {}, onSettingsChange = () => {},
} = {}) {
  if (!host || typeof host.addEventListener !== 'function') throw new TypeError('host element is required');
  let selectedId = initialSkinId || profile.skin || catalog[0]?.id;
  let currentQuality = normalizeQuality(quality);
  let reduce = Boolean(reducedMotion);
  let disposed = false, raf = 0, frame = 0;
  const profiler = createFrameProfiler(120);
  const cancel = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  function draw(now = 0) {
    if (disposed) return;
    const canvas = host.querySelector('.vfx-showcase-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || 340), height = Math.max(1, rect.height || 310);
    const dpr = Math.min(globalThis.devicePixelRatio || 1, visualBudget(currentQuality, reduce).dprCap);
    const pw = Math.round(width * dpr), ph = Math.round(height * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const skin = getSkinPreview(selectedId, profile, catalog);
    const began = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const heroId=catalog.find(entry=>entry.id===selectedId)?.heroId;
    if(heroId&&typeof Path2D==='function'){
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle='#131c2e';ctx.fillRect(0,0,width,height);
      const pose=resolveHeroPose({heroId,tick:reduce?0:Math.floor(now/1000*60),moving:false,reducedMotion:reduce});
      const art=catalog.find(entry=>entry.id===selectedId);
      renderHeroActor(ctx,{heroId,skin:art,pose,x:width/2,y:height*.58,scale:Math.min(width/340,height/310)*.7});
    } else paintSkinPreview(ctx, skin, { width, height, time: now / 1000, quality: currentQuality, reducedMotion: reduce });
    profiler.add(performance.now() - began);
    frame++;
    if (frame % 60 === 0) {
      const node = host.querySelector('[data-vfx-performance]');
      if (node) node.textContent = `Canvas draw p95 ${profiler.snapshot().p95?.toFixed(1) ?? '—'} ms · ${currentQuality.toUpperCase()} · device benchmark not verified`;
    }
    if (!reduce && !disposed) raf = requestAnimationFrame(draw);
  }
  // Rerendering a preview replaces its buttons; restore keyboard focus and the
  // scrollable card's position so bottom-of-gallery choices remain accessible.
  // Only the visual subtree is touched; neither inventory nor profile is edited.
  function render(origin = null) {
    if (disposed) return;
    const scrollTargets = ['.vfx-showcase', '.vfx-options-panel', '.vfx-catalog'];
    const snapshots = scrollTargets.map(selector => {
      const element = host.querySelector(selector);
      return element ? { selector, top: element.scrollTop, left: element.scrollLeft } : null;
    }).filter(Boolean);
    const hostScroll = { top: host.scrollTop, left: host.scrollLeft };
    const wasFocused = Boolean(origin && origin.ownerDocument?.activeElement === origin);
    const focusAttrs = ['data-vfx-skin', 'data-vfx-quality', 'data-vfx-motion'];
    const focusAttr = wasFocused ? focusAttrs.find(attr => origin.hasAttribute(attr)) : null;
    const focusValue = focusAttr ? origin.getAttribute(focusAttr) : null;

    cancel();
    host.innerHTML = showcaseMarkup({ profile, catalog, selectedId, quality: currentQuality, reducedMotion: reduce });
    for (const snapshot of snapshots) {
      const element = host.querySelector(snapshot.selector);
      if (element) { element.scrollTop = snapshot.top; element.scrollLeft = snapshot.left; }
    }
    if (Number.isFinite(hostScroll.top)) host.scrollTop = hostScroll.top;
    if (Number.isFinite(hostScroll.left)) host.scrollLeft = hostScroll.left;

    if (focusAttr && typeof host.querySelectorAll === 'function') {
      const successor = Array.from(host.querySelectorAll('button'))
        .find(button => button.hasAttribute(focusAttr) && button.getAttribute(focusAttr) === focusValue);
      if (successor && typeof successor.focus === 'function') {
        successor.focus({ preventScroll: true });
        // Compensate only when the new layout makes the focused control hidden.
        // Unlike scrollIntoView, this will not scroll the page behind the modal.
        const card = host.querySelector('.vfx-showcase');
        if (card && typeof card.getBoundingClientRect === 'function' &&
            typeof successor.getBoundingClientRect === 'function') {
          const outer = card.getBoundingClientRect();
          const inner = successor.getBoundingClientRect();
          if (inner.top < outer.top) card.scrollTop += inner.top - outer.top - 4;
          else if (inner.bottom > outer.bottom) card.scrollTop += inner.bottom - outer.bottom + 4;
        }
      }
    }
    draw(performance.now());
  }
  function click(event) {
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    if (button.hasAttribute('data-vfx-close')) { dispose(); onClose(); return; }
    if (button.hasAttribute('data-vfx-skin')) {
      selectedId = button.getAttribute('data-vfx-skin');
      render(button); return;
    }
    if (button.hasAttribute('data-vfx-quality')) {
      currentQuality = normalizeQuality(button.getAttribute('data-vfx-quality'));
      onSettingsChange({ vfx: currentQuality, reduceMotion: reduce });
      render(button); return;
    }
    if (button.hasAttribute('data-vfx-motion')) {
      reduce = !reduce;
      onSettingsChange({ vfx: currentQuality, reduceMotion: reduce });
      render(button); return;
    }
    if (button.hasAttribute('data-vfx-equip')) {
      const id = button.getAttribute('data-vfx-equip');
      const item = getSkinPreview(id, profile, catalog);
      if (item?.canEquip) onEquip(id); // The caller must still revalidate ownership.
    }
  }
  function dispose() {
    disposed = true; cancel(); host.removeEventListener('click', click);
  }
  host.addEventListener('click', click);
  render();
  return Object.freeze({ dispose, getSelection: () => selectedId, getQuality: () => currentQuality });
}
