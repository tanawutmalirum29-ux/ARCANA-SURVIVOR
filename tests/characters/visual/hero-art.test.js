import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HERO_IDS, HERO_ART_VIEWBOX, HERO_ART_PARTS,
  getCanonicalHeroArt, resolveHeroPalette,
  heroActorSvg, renderHeroActor,
} from '../../../src/characters/visual/hero-art.js';

test('base heroes retain distinct canonical actors, clothing and signature weapons', () => {
  assert.deepEqual(HERO_IDS, ['mage', 'guardian', 'ranger']);
  assert.deepEqual(Object.keys(HERO_ART_VIEWBOX), ['width', 'height', 'anchorX', 'anchorY']);
  const signatures = ['staff', 'sword-shield', 'bow'];
  const ids = new Set();
  for (const [index, id] of HERO_IDS.entries()) {
    const actor = getCanonicalHeroArt(id);
    assert.equal(actor.id, id);
    assert.equal(actor.signature, signatures[index]);
    assert.ok(Object.isFrozen(actor));
    assert.ok(Object.isFrozen(actor.parts));
    for (const part of actor.parts) {
      assert.ok(HERO_ART_PARTS.includes(part.name), part.name);
      assert.ok(Object.isFrozen(part.layers));
      assert.ok(part.layers.every(layer => layer.d.length > 5));
    }
    const allPaths = actor.parts.flatMap(part => part.layers.map(layer => layer.d)).join('|');
    assert.ok(!ids.has(allPaths), id + ' must not use a recolored generic body');
    ids.add(allPaths);
    for (const key of ['cape','legLeft','legRight','torso','armLeft','armRight','head','weapon']) {
      assert.ok(actor.parts.some(part => part.name === key), id + ' missing ' + key);
    }
  }
  assert.ok(getCanonicalHeroArt('guardian').parts.some(part => part.name === 'offhand'));
  assert.ok(getCanonicalHeroArt('ranger').parts.some(part => part.name === 'arrow'));
});

test('unknown or dangerous ids have safe immutable mage fallback', () => {
  for (const id of [null,'','missing','__proto__','constructor','toString',0]) {
    assert.equal(getCanonicalHeroArt(id), getCanonicalHeroArt('mage'));
    assert.match(heroActorSvg({heroId:id}), /data-hero="mage"/);
  }
});

test('SVG is an actor only, excludes lobby runes, and preserves readable unique weapons', () => {
  for (const id of HERO_IDS) {
    const svg=heroActorSvg({heroId:id});
    assert.ok(svg.startsWith('<svg'));
    assert.match(svg, /viewBox="0 0 320 350"/);
    assert.match(svg, /class="canonical-hero-actor"/);
    assert.match(svg, /data-actor-part="weapon"/);
    assert.doesNotMatch(svg, /lb-art-rune|lb-art-float|filter=|<ellipse|<circle/);
    assert.match(svg, new RegExp('data-signature="' + getCanonicalHeroArt(id).signature + '"'));
    const a=getCanonicalHeroArt(id);
    assert.equal((svg.match(/data-actor-part=/g)||[]).length, a.parts.length);
  }
  assert.match(heroActorSvg({heroId:'guardian'}), /data-actor-part="offhand"/);
  assert.match(heroActorSvg({heroId:'ranger'}), /data-actor-part="arrow"/);
});

test('palette skin overrides only affect materials, not rig identity or geometry', () => {
  for (const id of HERO_IDS) {
    const original=getCanonicalHeroArt(id);
    const base=heroActorSvg({heroId:id});
    const skin=heroActorSvg({heroId:id,skin:{color:'#ff00ff',trim:'#ffffff'}});
    assert.notEqual(base,skin);
    assert.match(skin, /#ff00ff/);
    assert.equal(getCanonicalHeroArt(id),original);
    assert.equal((base.match(/<path /g)||[]).length,(skin.match(/<path /g)||[]).length);
  }
  const unsafe=heroActorSvg({skin:{color:'red" onload="alert(1)',glow:'<script>'}});
  assert.doesNotMatch(unsafe,/onload|script/i);
  assert.equal(resolveHeroPalette('mage',{color:'#123456'}).primary,'#123456');
  assert.equal(resolveHeroPalette('mage',null,{glow:'#abc123'}).weaponGlow,'#abc123');
  assert.equal(resolveHeroPalette('mage',null,{glow:'#aaaaaa'}).weaponGlow,'#aaaaaa');
});

test('pose transforms named joints in radians while rejecting invalid numeric values', () => {
  const pose={bob:5,parts:{armRight:{rotation:Math.PI/2,dx:7,dy:2},weapon:{rotation:-.4}}};
  const svg=heroActorSvg({heroId:'guardian',pose});
  assert.match(svg,/translate\(0 5\)/);
  assert.match(svg,/rotate\(90\)/);
  assert.match(svg,/data-actor-part="weapon" transform=/);
  const invalid=heroActorSvg({pose:{bob:Infinity,head:{rotation:NaN,dx:Infinity,dy:-Infinity}}});
  assert.doesNotMatch(invalid,/NaN|Infinity/);
  assert.match(invalid,/data-actor-part="head"/);
});

test('Canvas reuses compiled geometry between frames and respects compact CSS scale', () => {
  const old=globalThis.Path2D;
  let created=0,filled=0,stroked=0,scales=[];
  globalThis.Path2D=class FakePath2D {constructor(d){assert.equal(typeof d,'string');created++;}};
  const ctx={save(){},restore(){},translate(){},rotate(){},scale(s){scales.push(s);},
    fill(p){assert.ok(p instanceof globalThis.Path2D);filled++;},
    stroke(p){assert.ok(p instanceof globalThis.Path2D);stroked++;}};
  try {
    assert.equal(renderHeroActor(ctx,{heroId:'mage',scale:.16}),true);
    const first=created;
    assert.ok(first>10);
    assert.equal(renderHeroActor(ctx,{heroId:'mage',scale:.16,pose:{head:{rotation:.2}}}),true);
    assert.equal(created,first,'Path2D must not recompile on every animation frame');
    assert.equal(scales[0],.16);
    for (const id of ['guardian','ranger']) assert.equal(renderHeroActor(ctx,{heroId:id,scale:.16}),true);
    assert.ok(filled>0 && stroked>0);
  } finally {
    if (old === undefined) delete globalThis.Path2D;
    else globalThis.Path2D=old;
  }
});

test('no Canvas Path2D is a safe, non-throwing SVG fallback signal', () => {
  const old=globalThis.Path2D;
  try {
    delete globalThis.Path2D;
    assert.equal(renderHeroActor({save(){}},{heroId:'mage'}),false);
    assert.ok(heroActorSvg({heroId:'mage'}).includes('<svg'));
  } finally {
    if (old!==undefined) globalThis.Path2D=old;
  }
});
