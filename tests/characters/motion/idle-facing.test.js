import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHeroFacing} from '../../../src/characters/motion/facing.js';
import {resolveHeroPose} from '../../../src/characters/motion/index.js';
import {heroActorSvg} from '../../../src/characters/visual/hero-art.js';

const heading=[
 ['E',1,0],['SE',1,1],['S',0,1],['SW',-1,1],
 ['W',-1,0],['NW',-1,-1],['N',0,-1],['NE',1,-1],
];
const rearFace={
 mage:'m145 118 11 2m10 0 11-2',
 guardian:'M145 119h10m14 0h10',
 ranger:'M142 119 153 121M168 121 179 119',
};
function make(heroId,opts={}){
 return resolveHeroFacing({
  heroId,tick:100,player:{x:300,y:400},enemies:[],
  movement:{x:0,y:0},configured:true,...opts
 });
}
function pose(heroId,f,tick=100){
 return resolveHeroPose({heroId,tick,moving:f.moving,
  moveVector:{x:0,y:0},facingVector:f.facingVector,aimVector:f.aimVector,
  targetPresent:f.targetPresent,attackIntervalTicks:30});
}
for(const heroId of ['mage','guardian','ranger']) {
 test(heroId+': all 8 standing directions follow verified closest-target auto-aim in idle, with correct SVG back face',()=>{
  for(const [direction,x,y] of heading) {
   const f=make(heroId,{enemies:[{x:300+x*65,y:400+y*65,hp:500}]});
   assert.equal(f.moving,false);
   assert.equal(f.targetPresent,true);
   const p=pose(heroId,f);
   assert.equal(p.locomotion,'idle');
   assert.equal(p.view.direction8,direction,heroId+' idle target '+direction);
   const back=['NW','N','NE'].includes(direction);
   assert.equal(p.view.backView,back,heroId+' '+direction);
   const svg=heroActorSvg({heroId,pose:p});
   if(back) assert.ok(!svg.includes(rearFace[heroId]),heroId+' leaked front eyes when idle '+direction);
  }
 });
 test(heroId+': fresh engine attack aim beats previous walk direction and an outdated enemy target',()=>{
  const f=make(heroId,{
   lastFacing:{x:-1,y:0},enemies:[{x:360,y:400,hp:50}],
   fireEvent:{tick:100,shotId:13,aimX:0,aimY:-1}
  });
  assert.equal(pose(heroId,f).view.direction8,'N');
  const after=make(heroId,{tick:101,
   lastFacing:f.facingVector,enemies:[{x:360,y:400,hp:50}],
   fireEvent:{tick:100,shotId:13,aimX:0,aimY:-1}
  });
  assert.equal(pose(heroId,after,101).view.direction8,'E','next living target takes priority after shot');
 });
 test(heroId+': no target retains last real shot facing; zero-input no shot keeps last visible heading',()=>{
  const shot=make(heroId,{enemies:[],
   fireEvent:{tick:85,shotId:17,aimX:-1,aimY:-1}});
  assert.equal(pose(heroId,shot).view.direction8,'NW');
  const resting=make(heroId,{lastFacing:{x:0,y:1}});
  assert.equal(pose(heroId,resting).view.direction8,'S');
  const pristine=make(heroId);
  assert.equal(pristine.facingVector,null);
  assert.equal(pose(heroId,pristine).view.backView,false);
 });
 test(heroId+': while WALKING face movement even if weapon attacks behind',()=>{
  const f=make(heroId,{movement:{x:1,y:0},enemies:[{x:230,y:400,hp:500}],
   fireEvent:{tick:100,shotId:15,aimX:-1,aimY:0}});
  const p=resolveHeroPose({heroId,tick:100,moving:f.moving,
   moveVector:{x:1,y:0},facingVector:f.facingVector,aimVector:f.aimVector,
   lastAttackTick:100,targetPresent:f.targetPresent});
  assert.equal(p.view.direction8,'E');
  assert.equal(p.travel.direction8,'E');
  assert.equal(p.facing.direction8,'W','weapon still aims at actual enemy');
  assert.equal(p.locomotion,'walk');
 });
}
test('Orin does not point at out-of-reach targets; bow/staff face identical ranged targets',()=>{
 const enemy={x:500,y:400,hp:30};
 const guardian=make('guardian',{enemies:[enemy],lastFacing:{x:0,y:1}});
 assert.equal(guardian.targetPresent,false);
 assert.equal(pose('guardian',guardian).view.direction8,'S');
 for(const heroId of ['mage','ranger']) {
  const f=make(heroId,{enemies:[enemy],lastFacing:{x:0,y:1}});
  assert.equal(f.targetPresent,true);
  assert.equal(pose(heroId,f).view.direction8,'E');
 }
});
test('render aim selects nearest living enemy, not whichever enemy appears first in the array',()=>{
 const f=make('ranger',{enemies:[
  {x:300,y:380,hp:0},{x:300,y:490,hp:100},{x:280,y:400,hp:30}
 ]});
 assert.equal(pose('ranger',f).view.direction8,'W');
});
test('invalid inputs do not create NaN, false targets or fabricated shot direction',()=>{
 const f=make('mage',{movement:{x:Infinity,y:NaN},
  enemies:[{x:NaN,y:5,hp:100},{x:10,y:0,hp:0}],
  fireEvent:{tick:101,aimX:Infinity,aimY:NaN}});
 assert.equal(f.moving,false);assert.equal(f.targetPresent,false);
 assert.deepEqual(f.aimVector,{x:0,y:-1});
 assert.equal(f.facingVector,null);
});
