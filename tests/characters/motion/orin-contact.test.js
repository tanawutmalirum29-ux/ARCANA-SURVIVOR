import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeroPose } from '../../../src/characters/motion/index.js';
import { heroActorSvg, renderHeroActor, getCanonicalHeroArt } from '../../../src/characters/visual/hero-art.js';
import { HERO_RIGS, ORIN_REAR_HELM } from '../../../src/characters/visual/rigs.js';

const headings = [
  ['E', 1, 0], ['SE', 1, 1], ['S', 0, 1], ['SW', -1, 1],
  ['W', -1, 0], ['NW', -1, -1], ['N', 0, -1], ['NE', 1, -1],
];
function point(pivot, local, joint) {
  const dx = local.x - pivot.x, dy = local.y - pivot.y;
  return {
    x: pivot.x + joint.x + dx * Math.cos(joint.rotation) - dy * Math.sin(joint.rotation),
    y: pivot.y + joint.y + dx * Math.sin(joint.rotation) + dy * Math.cos(joint.rotation),
  };
}
function gap(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function checkOrin(pose,label){
  const j=pose.joints;
  const swordPalm=point({x:206,y:166},{x:233,y:185},j.rightArm);
  const swordGrip=point({x:239,y:163},{x:239,y:188},j.weapon);
  assert.ok(gap(swordPalm,swordGrip)<.00015,label+' sword floating from hand');
  const glove=point({x:117,y:168},{x:100,y:195},j.leftArm);
  const shieldGrip=point({x:96,y:187},{x:99,y:193},j.shield);
  assert.ok(gap(glove,shieldGrip)<.00015,label+' shield floating from hand');
  const torsoCollar=point({x:161,y:164},{x:160,y:120},j.torso);
  const capeCollar=point({x:160,y:120},{x:160,y:120},j.cape);
  assert.ok(gap(torsoCollar,capeCollar)<.00015,label+' cloak floating at neck');
  assert.ok(Math.hypot(j.capeTail.x-j.cape.x,j.capeTail.y-j.cape.y)<4,
    label+' cloak hem lost shoulder attachment');
  assert.ok(Object.values(j).every(v=>Object.values(v).every(Number.isFinite)),
    label+' nonfinite part rotation/offset');
}
test('Orin sword, shield, collar and trailing cape are contact-locked across 8 headings and phases',()=>{
  for(const [heading,x,y] of headings){
    for(let tick=80;tick<112;tick++){
      const attacks=[
        {lastAttackTick:null,targetPresent:false},
        {lastAttackTick:tick,targetPresent:true},
        {lastAttackTick:tick-4,targetPresent:false},
        {lastAttackTick:null,targetPresent:true,nextAttackTick:tick+6},
      ];
      for(const [i,combat] of attacks.entries()){
        const args={heroId:'guardian',tick,moving:true,moveVector:{x,y},
          aimVector:{x:-x||1,y:-y||-1},attackIntervalTicks:30,...combat};
        const pose=resolveHeroPose(args);
        assert.equal(pose.travel.direction8,heading);
        checkOrin(pose,heading+'/'+tick+'/'+i);
        assert.deepEqual(resolveHeroPose(args),pose,'fixed-tick output must be deterministic');
      }
    }
  }
});
test('Orin stationary attack, injury and reduced motion retain armour grip and signature',()=>{
  for(const [,x,y] of headings){
    for(const reducedMotion of [true,false]){
      for(const state of ['idle','windup','charge','release','recover','hurt']){
        const args={heroId:'guardian',tick:100,moving:false,aimVector:{x,y},
          reducedMotion,attackIntervalTicks:30};
        if(state==='windup'){args.targetPresent=true;args.nextAttackTick=111;}
        if(state==='charge'){args.targetPresent=true;args.nextAttackTick=106;}
        if(state==='release')args.lastAttackTick=100;
        if(state==='recover')args.lastAttackTick=96;
        if(state==='hurt')args.hurtTicks=8;
        const pose=resolveHeroPose(args);
        checkOrin(pose,state+'/'+x+'/'+y+'/'+reducedMotion);
        assert.equal(pose.attackPhase,['hurt','idle'].includes(state)?'none':state);
      }
    }
  }
  assert.equal(getCanonicalHeroArt('guardian').signature,'sword-shield');
  assert.equal(HERO_RIGS.mage.parts.some(p=>p.name==='offhand'),false);
  assert.equal(HERO_RIGS.ranger.parts.some(p=>p.name==='capeTail'),false);
});
test('N/NW/NE rear steel helm occludes face in SVG and cached Canvas',()=>{
  const FRONT_EYES='M145 119h10m14 0h10';
  const REAR_PLATE='M135 109Q138 90 161 82';
  assert.ok(ORIN_REAR_HELM.layers.some(p=>p.d.includes(REAR_PLATE)));
  for(const [heading,x,y] of headings){
    const pose=resolveHeroPose({heroId:'guardian',tick:100,moving:true,
      moveVector:{x,y},aimVector:{x:-x||1,y:-y||-1},lastAttackTick:100});
    const svg=heroActorSvg({heroId:'guardian',pose});
    const start=svg.indexOf('<g data-actor-part="head"'),end=svg.indexOf('</g>',start);
    const head=svg.slice(start,end);
    const order=[...svg.matchAll(/data-actor-part="([^"]+)"/g)].map(m=>m[1]);
    assert.ok(order.includes('capeTail'));
    if(['N','NW','NE'].includes(heading)){
      assert.equal(pose.view.backView,true);
      assert.ok(head.includes(REAR_PLATE),heading+' missing closed rear helmet');
      assert.ok(!head.includes(FRONT_EYES),heading+' faces backwards with visible eyes');
      assert.ok(order.indexOf('torso')<order.indexOf('cape'));
      assert.ok(order.indexOf('cape')<order.indexOf('head'));
      assert.ok(order.indexOf('weapon')<order.indexOf('armRight'));
      assert.ok(order.indexOf('offhand')<order.indexOf('head'));
    }else{
      assert.equal(pose.view.backView,false);
      assert.ok(head.includes(FRONT_EYES),heading+' forward face missing');
    }
    const traced=[];
    const old=globalThis.Path2D;
    globalThis.Path2D=class Path {constructor(d){this.d=d;}};
    const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},
      fill(p){traced.push(p.d);},stroke(p){traced.push(p.d);}};
    try{
      assert.equal(renderHeroActor(ctx,{heroId:'guardian',pose,x:40,y:40,scale:.16}),true);
      assert.equal(traced.some(d=>d.includes(REAR_PLATE)),pose.view.backView);
      assert.equal(traced.some(d=>d.includes(FRONT_EYES)),!pose.view.backView);
    }finally{
      if(old===undefined)delete globalThis.Path2D;
      else globalThis.Path2D=old;
    }
  }
});
test('equipment stays Orin-specific across free/event/premium colour palettes',()=>{
  for(const skin of [null,{primary:'#ffffff',glow:'#ffcc00'},
    {primary:'#ff00bb',trim:'#77ffaa',metal:'#abcabc'}]){
    const svg=heroActorSvg({heroId:'guardian',skin});
    assert.match(svg,/data-signature="sword-shield"/);
    for(const name of ['weapon','offhand','cape','capeTail']){
      assert.match(svg,new RegExp('data-actor-part="'+name+'"'));
    }
    assert.doesNotMatch(svg,/onload=|NaN|Infinity/);
  }
});
