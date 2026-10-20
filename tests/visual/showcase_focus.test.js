import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSkinShowcase } from '../../src/visual/showcase.js';

// Deliberately reconstructs elements whenever host.innerHTML changes to
// reproduce the browser focus/scroll lifecycle (a plain string mock cannot).
function interactiveHost() {
  const ownerDocument = { activeElement: null };
  const listeners = new Map();
  const cards = new Map();
  const host = {
    scrollTop: 0, scrollLeft: 0, writes: 0,
    buttons: [],
    contains: () => true,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    querySelector(selector) { return cards.get(selector) || null; },
    querySelectorAll(selector) { return selector === 'button' ? this.buttons : []; },
    dispatch(button) { listeners.get('click')?.({ target: { closest: () => button } }); },
    find(attr, value) {
      return this.buttons.find(button => button.hasAttribute(attr) &&
        (value === undefined || button.getAttribute(attr) === value));
    },
    get mounted() { return listeners.has('click'); },
    set innerHTML(markup) {
      this.html = markup;
      this.writes++;
      // Simulate removing the focused DOM node (the source of the QA bug).
      ownerDocument.activeElement = null;
      const card = {
        scrollTop: 0, scrollLeft: 0,
        getBoundingClientRect: () => ({top: 100, bottom: 220}),
      };
      cards.set('.vfx-showcase', card);
      cards.set('.vfx-options-panel', {scrollTop: 0, scrollLeft: 0});
      cards.set('.vfx-catalog', {scrollTop: 0, scrollLeft: 0});
      const regex = /data-vfx-(skin|quality)="([^"]+)"|data-vfx-motion(?:[ >])/g;
      let match;
      this.buttons = [];
      while ((match = regex.exec(markup))) {
        const attr = match[1] ? 'data-vfx-' + match[1] : 'data-vfx-motion';
        const val = match[2] || '';
        const ordinal = this.buttons.length;
        const attrs = { [attr]: val };
        this.buttons.push({
          ownerDocument,
          hasAttribute(name) { return Object.hasOwn(attrs, name); },
          getAttribute(name) { return attrs[name] ?? null; },
          focus(options) {
            assert.equal(options?.preventScroll, true);
            ownerDocument.activeElement = this;
          },
          getBoundingClientRect() {
            // The modal may scroll far enough for the last collection item.
            const top = 130 + ordinal * 30 - card.scrollTop;
            return { top, bottom: top + 40 };
          },
        });
      }
    },
    get innerHTML() { return this.html; },
    get activeElement() { return ownerDocument.activeElement; },
    get card() { return cards.get('.vfx-showcase'); },
  };
  return host;
}

test('keyboard-focused bottom skin survives rebuilt modal without losing scroll', () => {
  const host = interactiveHost();
  const controller = mountSkinShowcase({
    host, profile: {skin:'apprentice',owned:['apprentice'],settings:{vfx:'low',reduceMotion:true}},
  });
  host.card.scrollTop = 280;
  host.scrollTop = 17;
  const button = host.find('data-vfx-skin','celestial');
  assert.ok(button);
  button.focus({preventScroll:true}); // Keyboard Tab focus before Enter/Space click
  const oldWrites = host.writes;
  host.dispatch(button);
  assert.equal(host.writes, oldWrites + 1);
  assert.equal(controller.getSelection(), 'celestial');
  assert.equal(host.card.scrollTop, 280);
  assert.equal(host.scrollTop, 17);
  assert.notEqual(host.activeElement, button);
  assert.equal(host.activeElement?.getAttribute('data-vfx-skin'), 'celestial');
  controller.dispose();
});

test('LOW/MEDIUM/HIGH and reduced-motion changes retain focus/scroll and callback isolation', () => {
  const host = interactiveHost();
  const changes = [];
  const profile = {skin:'apprentice',owned:['apprentice'],settings:{vfx:'high',reduceMotion:false}};
  const before = JSON.stringify(profile);
  const controller = mountSkinShowcase({host,profile,onSettingsChange: settings=>changes.push(settings)});
  host.card.scrollTop = 0;
  const quality = host.find('data-vfx-quality','medium');
  quality.focus({preventScroll:true});
  host.dispatch(quality);
  assert.equal(host.activeElement?.getAttribute('data-vfx-quality'),'medium');
  assert.equal(controller.getQuality(),'medium');
  assert.equal(host.card.scrollTop,0);
  const motion = host.find('data-vfx-motion');
  motion.focus({preventScroll:true});
  host.dispatch(motion);
  assert.equal(host.activeElement?.hasAttribute('data-vfx-motion'),true);
  assert.equal(host.card.scrollTop,0);
  assert.deepEqual(changes,[
    {vfx:'medium',reduceMotion:false},
    {vfx:'medium',reduceMotion:true},
  ]);
  assert.equal(JSON.stringify(profile),before);
  controller.dispose();
  assert.equal(host.mounted,false);
});

test('pointer selection retains internal scroll without forcing keyboard focus', () => {
  const host = interactiveHost();
  const controller = mountSkinShowcase({host,profile:{skin:'apprentice',owned:['apprentice'],settings:{vfx:'low',reduceMotion:true}}});
  host.card.scrollTop = 240;
  host.dispatch(host.find('data-vfx-skin','crimson'));
  assert.equal(host.activeElement,null);
  assert.equal(host.card.scrollTop,240);
  assert.equal(controller.getSelection(),'crimson');
  controller.dispose();
});

test('focus on selected bottom item is minimally revealed when layout changes', () => {
  const host = interactiveHost();
  const controller = mountSkinShowcase({host,profile:{skin:'apprentice',owned:['apprentice'],settings:{vfx:'low',reduceMotion:true}}});
  host.card.scrollTop = 15; // Currently focused lower item would be below visible region.
  const button = host.find('data-vfx-skin','celestial');
  button.focus({preventScroll:true});
  host.dispatch(button);
  assert.equal(host.activeElement?.getAttribute('data-vfx-skin'),'celestial');
  assert.ok(host.card.scrollTop > 15);
  controller.dispose();
});
