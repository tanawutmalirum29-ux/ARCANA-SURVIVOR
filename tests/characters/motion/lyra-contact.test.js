import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHeroPose} from '../../../src/characters/motion/index.js';
import {HERO_RIGS,LYRA_REAR_HOOD} from '../../../src/characters/visual/rigs.js';
import {heroActorSvg,renderHeroActor,getCanonicalHeroArt} from '../../../src/characters/visual/hero-art.js';
const headings=[
 ['E',1,0],['SE',1,1],['S',0,1],['SW',-1,1],
 ['W',-1,0],['NW',-1,-1],['N',0,-1],['NE',1,-1],
];
const point=(pivot,local,joint)=>{
 const dx=local.x-pivot.x,dy=local.y-pivot.y;
 return {x:pivot.x+joint.x+dx*Math.cos(joint.rotation)-dy*Math.sin(joint.rotation),
   y:pivot.y+joint.y+dx*Math.sin(joint.rotation)+dy*Math.cos(joint.rotation)};
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function contacts(pose,label){
 const j=pose.joints;
 const hand=point({x:205,y:161},{x:231,y:159},j.rightArm);
 const bow=point({x:234,y:156},{x:234,y:156},j.weapon);
 assert.ok(distance(hand,bow)<.00015,label+' right palm slipped bow grip');
 const collar=point({x:162,y:173},{x:160,y:136},j.torso);
 const cape=point({x:160,y:136},{x:160,y:136},j.cape);
 assert.ok(distance(collar,cape)<.00015,label+' floating hood collar');
 const quiverShoulder=point({x:162,y:173},{x:192,y:143},j.torso);
 const quiver=point({x:192,y:143},{x:192,y:143},j.quiver);
 assert.ok(distance(quiverShoulder,quiver)<.00015,label+' quiver detached from shoulder');
 const tail=point({x:160,y:136},{x:160,y:136},j.capeTail);
 assert.ok(distance(cape,tail)<3.5,label+' trailing cloak detached');
 assert.ok(Object.values(j).every(v=>Object.values(v).every(Number.isFinite)),
  label+' nonfinite motion');
}
test('Lyra bow grip, hood collar, quiver and trailing cloak lock across 8 walk headings and real shot phases',()=>{
 for(const [name,x,y] of headings)for(let tick=70;tick<138;tick++){
  const variations=[
   {lastAttackTick:null,targetPresent:false},
   {lastAttackTick:tick,targetPresent:true},
   {lastAttackTick:tick-4,targetPresent:false},
   {lastAttackTick:null,targetPresent:true,nextAttackTick:tick+6},
  ];
  for(const [i,attack] of variations.entries()){
   const input={heroId:'ranger',tick,moving:true,moveVector:{x,y},
    aimVector:{x:-x||1,y:-y||-1},attackIntervalTicks:30,...attack};
   const pose=resolveHeroPose(input);
   assert.equal(pose.travel.direction8,name);
   contacts(pose,name+'/'+tick+'/'+i);
   assert.deepEqual(pose,resolveHeroPose(input),'fixed-tick motion not deterministic');
  }
 }
});
test('Lyra idle, release, charge, hurt and reduced motion never break physical grips',()=>{
 for(const [name,x,y] of headings)for(const reducedMotion of [false,true]){
  for(const phase of ['idle','windup','charge','release','recover','hurt']){
   const args={heroId:'ranger',tick:110,moving:false,aimVector:{x,y},
    attackIntervalTicks:30,reducedMotion};
   if(phase==='windup'){args.targetPresent=true;args.nextAttackTick=121;}
   if(phase==='charge'){args.targetPresent=true;args.nextAttackTick=116;}
   if(phase==='release')args.lastAttackTick=110;
   if(phase==='recover')args.lastAttackTick=106;
   if(phase==='hurt')args.hurtTicks=7;
   const pose=resolveHeroPose(args);
   contacts(pose,name+'/'+phase);
   assert.equal(pose.attackPhase,['idle','hurt'].includes(phase)?'none':phase);
   assert.equal(pose.fx.arrowVisible,['windup','charge'].includes(phase));
   if(phase==='charge')assert.ok(pose.fx.bowDraw>.6);
   if(phase==='release')assert.equal(pose.fx.bowDraw,0);
  }
 }
 assert.equal(getCanonicalHeroArt('ranger').signature,'bow');
 assert.equal(HERO_RIGS.guardian.parts.some(p=>p.name==='quiver'),false);
 assert.equal(HERO_RIGS.mage.parts.some(p=>p.name==='quiver'),false);
});
test('Lyra N/NW/NE closed rear hood, front eyes, visible quiver and Canvas parity',()=>{
 const FRONT_EYES='M142 119 153 121M168 121 179 119';
 const REAR_PANEL='M127 111Q137 85 161 75';
 assert.ok(LYRA_REAR_HOOD.layers.some(l=>l.d.includes(REAR_PANEL)));
 const original=globalThis.Path2D;
 globalThis.Path2D=class FakePath2D {constructor(d){this.d=d;}};
 const rendered=[];
 const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},
  fill(path){rendered.push(path.d);},stroke(path){rendered.push(path.d);}};
 try{
  for(const [name,x,y] of headings)for(const attack of [false,true]){
   const pose=resolveHeroPose({heroId:'ranger',tick:110,moving:true,
    moveVector:{x,y},aimVector:{x:-x||1,y:-y||-1},
    ...(attack?{lastAttackTick:110}:{})});
   const svg=heroActorSvg({heroId:'ranger',pose});
   const first=svg.indexOf('<g data-actor-part="head"');
   const last=svg.indexOf('</g>',first);
   const hood=svg.slice(first,last);
   const order=[...svg.matchAll(/data-actor-part="([^"]+)"/g)].map(m=>m[1]);
   assert.ok(order.includes('quiver')&&order.includes('capeTail'));
   assert.ok(order.indexOf('weapon')<order.indexOf('armRight'),'bow behind gripping palm');
   assert.ok(order.indexOf('cape')<order.indexOf('head'),'hood collar below hood');
   rendered.length=0;
   assert.equal(renderHeroActor(ctx,{heroId:'ranger',pose,x:40,y:40,scale:.16}),true);
   if(['N','NW','NE'].includes(name)){
    assert.equal(pose.view.backView,true);
    assert.ok(hood.includes(REAR_PANEL),name+' rear cloth missing');
    assert.ok(!hood.includes(FRONT_EYES),name+' glowing forward eyes in rear view');
    assert.ok(order.indexOf('cape')<order.indexOf('quiver'),name+' rear quiver hidden');
    assert.ok(rendered.some(d=>d.includes(REAR_PANEL)),name+' rear Canvas parity missing');
    assert.ok(!rendered.some(d=>d.includes(FRONT_EYES)),name+' rear Canvas shows front eyes');
   }else{
    assert.equal(pose.view.backView,false);
    assert.ok(hood.includes(FRONT_EYES),name+' front eyes missing');
    assert.ok(!hood.includes(REAR_PANEL));
    assert.ok(rendered.some(d=>d.includes(FRONT_EYES)),name+' front Canvas eye absent');
   }
   assert.doesNotMatch(svg,/NaN|Infinity/);
  }
 }finally{if(original===undefined)delete globalThis.Path2D;else globalThis.Path2D=original;}
});
test('Lyra canonical bow, quiver, hood and cloak survive owned and preview colour palettes',()=>{
 for(const skin of [null,{primary:'#fedcba',glow:'#00ffdd'},
  {primary:'#ffaabb',trim:'#baffaa',metal:'#defabc',leather:'#6b4250'}]){
  const svg=heroActorSvg({heroId:'ranger',skin});
  assert.match(svg,/data-signature="bow"/);
  for(const part of ['cape','capeTail','head','quiver','weapon','arrow']){
   assert.match(svg,new RegExp('data-actor-part="'+part+'"'));
  }
  assert.doesNotMatch(svg,/onload|NaN|Infinity/);
 }
});

test('Lyra never draws front facial paths in shallow N/NW/NE, idle hold or combat phases',()=>{
 const head=HERO_RIGS.ranger.parts.find(part=>part.name==='head');
 const facePaths=head.layers.slice(1,5).map(layer=>layer.d);
 const headings=[
  ['NW',-1,-.5],['N',0,-1],['NE',1,-.5],
 ];
 const oldPath=globalThis.Path2D;
 globalThis.Path2D=class QAPath {constructor(d){this.d=d;}};
 const paths=[];
 const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},
   fill(p){paths.push(p.d)},stroke(p){paths.push(p.d)}};
 try{
  for(const [name,x,y] of headings){
   const phases=['idle','walk','windup','charge','release','recover'];
   for(const phase of phases)for(const tick of [0,3,8,15,23,50,96]){
    const args={heroId:'ranger',tick,moving:phase!=='idle',
      moveVector:{x,y},facingVector:{x,y},
      aimVector:{x:0,y:1},attackIntervalTicks:30};
    if(phase==='windup'||phase==='charge'){
     args.targetPresent=true;
     args.nextAttackTick=tick+(phase==='windup'?11:6);
    }
    if(phase==='release')args.lastAttackTick=tick;
    if(phase==='recover')args.lastAttackTick=Math.max(0,tick-4);
    const pose=resolveHeroPose(args);
    assert.equal(pose.view.direction8,name,name+'/'+phase+'/'+tick);
    assert.equal(pose.view.backView,true,name+'/'+phase+'/'+tick);
    const svg=heroActorSvg({heroId:'ranger',pose});
    assert.match(svg,/data-actor-part="head"/);
    for(const d of facePaths)assert.ok(!svg.includes('d="'+d+'"'),
      name+'/'+phase+'/'+tick+' emitted front face path');
    paths.length=0;
    assert.ok(renderHeroActor(ctx,{heroId:'ranger',pose,x:40,y:40,scale:.2}));
    for(const d of facePaths)assert.ok(!paths.includes(d),
      name+'/'+phase+'/'+tick+' emitted front Canvas path');
   }
   // The head selection must also fail closed for an old motion caller
   // which still reports backView=false during a shallow diagonal walk.
   const pose=resolveHeroPose({heroId:'ranger',tick:13,moving:true,
     moveVector:{x,y},facingVector:{x,y}});
   pose.view.backView=false;
   const svg=heroActorSvg({heroId:'ranger',pose});
   for(const d of facePaths)assert.ok(!svg.includes('d="'+d+'"'));
  }
  const south=resolveHeroPose({heroId:'ranger',tick:12,moving:true,
    moveVector:{x:0,y:1},facingVector:{x:0,y:1}});
  assert.equal(south.view.backView,false);
  const svg=heroActorSvg({heroId:'ranger',pose:south});
  assert.ok(svg.includes('d="'+facePaths[0]+'"'),'south-facing front face disappeared');
 }finally{
  if(oldPath===undefined)delete globalThis.Path2D;
  else globalThis.Path2D=oldPath;
 }
});
