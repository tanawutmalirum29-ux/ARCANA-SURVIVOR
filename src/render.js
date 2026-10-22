import { WORLD } from './engine.js';
import { COSMETICS } from './storage.js';
import { visualBudget } from './visual/presentation.js';
import { paintBossWarning } from './visual/warnings.js';
import {getSkinDefinition} from './characters/skins/index.js';
import {renderHeroActor} from './characters/visual/hero-art.js';
import {resolveHeroPose} from './characters/motion/index.js';

const GOLD = '#ebd8a1';
const PI2 = Math.PI * 2;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function ring(ctx,x,y,r,color,width=2){ctx.beginPath();ctx.arc(x,y,r,0,PI2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function diamond(ctx,x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.72,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.72,y);ctx.closePath();ctx.fill()}
function ellipse(ctx,x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,PI2);ctx.fillStyle=color;ctx.fill()}
function rune(ctx,x,y,r,alpha=1){
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=alpha;ring(ctx,0,0,r,'#816eaf',1);ring(ctx,0,0,r*.75,'#534782',1);
 for(let i=0;i<8;i++){const a=i/8*PI2;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.75,Math.sin(a)*r*.75);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.strokeStyle='#a7a0db';ctx.stroke()}
 ctx.restore();
}
function backdrop(ctx, w,h,cam,s,t){
 const palette={grove:['#102c29','#091c21','#192b39'],citadel:['#351e2b','#1c1427','#38232e']}[s.runConfig?.chapterId]||['#0d1630','#080e23','#16132d'];
 const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,palette[0]);gradient.addColorStop(.6,palette[1]);gradient.addColorStop(1,palette[2]);ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.translate(-cam.x,-cam.y);
 const left=clamp(Math.floor(cam.x/80)*80,0,WORLD.width),top=clamp(Math.floor(cam.y/80)*80,0,WORLD.height);
 ctx.strokeStyle='rgba(110,109,174,.08)';ctx.lineWidth=1;
 for(let x=left;x<Math.min(WORLD.width,cam.x+w+80);x+=80){ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,Math.min(WORLD.height,cam.y+h+80));ctx.stroke()}
 for(let y=top;y<Math.min(WORLD.height,cam.y+h+80);y+=80){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(Math.min(WORLD.width,cam.x+w+80),y);ctx.stroke()}
 const points=[[280,280,120],[720,420,70],[1450,210,115],[1870,730,90],[520,1190,84],[1700,1270,130],[1100,750,185]];
 for(const [x,y,r] of points){if(Math.abs(x-cam.x-w/2)>w/2+r||Math.abs(y-cam.y-h/2)>h/2+r)continue;
   ring(ctx,x,y,r,'rgba(133,116,188,.14)',3);rune(ctx,x,y,r*.64,.24);
   for(let n=0;n<4;n++){const angle=(n/4)*PI2+.78;diamond(ctx,x+Math.cos(angle)*r,y+Math.sin(angle)*r,8,'#242b50')}
 }
 for(let i=0;i<180;i++){
   const x=(i*7079+61)%WORLD.width,y=(i*10909+200)%WORLD.height;
   if(x<cam.x-10||x>cam.x+w+10||y<cam.y-10||y>cam.y+h+10)continue;
   const blink=.12+.17*(1+Math.sin(t*1.6+i*.43))*.5;ctx.fillStyle=`rgba(208,220,255,${blink})`;ctx.fillRect(x,y,1.5,1.5)
 }
 ctx.strokeStyle='rgba(207,174,95,.22)';ctx.lineWidth=6;ctx.strokeRect(0,0,WORLD.width,WORLD.height);
 ctx.restore();
}
function glow(ctx,x,y,color,r=25,intensity=.5){
 if(intensity<=0)return;
 const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.globalAlpha=intensity;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,PI2);ctx.fill();ctx.globalAlpha=1;
}
function playerAvatar(ctx,x,y,profile,s,t,options){
 const skin=COSMETICS.find(x=>x.id===profile.skin)||COSMETICS[0];
 const motion=options.reducedMotion?0:Math.sin(t*4)*3;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=options.reducedMotion?1:(s.player.invuln>0 && s.player.invuln%8<4?.45:1);
 ellipse(ctx,0,15,21,9,'rgba(0,0,0,.42)');glow(ctx,0,0,skin.glow,50,.35*options.glow);
 if(options.particles>0){
   const tier=options.quality==='high'?({COMMON:3,EPIC:5,LEGENDARY:7,MYTHIC:9}[skin.rarity]||3):3;
   for(let a=0;a<tier;a++){const angle=a*PI2/tier+t*(skin.rarity==='MYTHIC'?1.05:.7);
     const r=skin.rarity==='MYTHIC'?35:27;diamond(ctx,Math.cos(angle)*r,Math.sin(angle)*r*.68+motion*.4,skin.rarity==='MYTHIC'?4:3,skin.glow)}
   if(skin.rarity==='LEGENDARY'||skin.rarity==='MYTHIC'){ring(ctx,0,0,34,skin.glow,1.4)}
 }
 ctx.fillStyle=skin.glow;ctx.beginPath();ctx.moveTo(-13,2);ctx.lineTo(-18,24);ctx.lineTo(0,16+motion*.3);ctx.lineTo(18,24);ctx.lineTo(13,2);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(252,232,184,.75)';ctx.lineWidth=1.5;ctx.stroke();
 ellipse(ctx,0,-7+motion*.3,13,14,skin.color);ellipse(ctx,0,-11+motion*.3,11,8,'#28314f');
 diamond(ctx,0,-9+motion*.3,6,GOLD);ring(ctx,0,-13+motion*.3,18,skin.glow,1.6);
 if(s.runConfig){
   const hero=s.runConfig.heroId;
   if(hero==='guardian'){
     ctx.fillStyle='#758fb3';ctx.strokeStyle=GOLD;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-25,-7);ctx.lineTo(-10,-7);ctx.lineTo(-10,7);ctx.lineTo(-17,16);ctx.lineTo(-25,7);ctx.closePath();ctx.fill();ctx.stroke();
     // Older canvases without Path2D still retain Orin's sword silhouette.
     ctx.strokeStyle='#e3eaf3';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(13,17);ctx.lineTo(27,-18);ctx.stroke();
     ctx.strokeStyle=GOLD;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(9,7);ctx.lineTo(19,11);ctx.stroke();
   }else if(hero==='ranger'){
     ctx.strokeStyle='#a8e1b7';ctx.lineWidth=3;ctx.beginPath();ctx.arc(19,1,16,-1.25,1.25);ctx.stroke();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(24,-14);ctx.lineTo(24,16);ctx.stroke();
   }
   if(hero==='mage'){
   const staffColor={piercing_staff:'#a7e8f2',gale_scepter:'#9fe4b8'}[s.runConfig.weaponId]||skin.projectile;
   ctx.strokeStyle=GOLD;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(19,19);ctx.lineTo(25,-16);ctx.stroke();diamond(ctx,25,-18,7,staffColor);
   }
   if(s.player.shield>0)ring(ctx,0,0,31,'#94dafa',2);
 }
 ctx.restore();
}
function enemyAvatar(ctx,e,t,reducedMotion=false){
 ctx.save();ctx.translate(e.x,e.y);const flash=e.flash>0&&!reducedMotion;
 const config={swarmer:['#b86cce','#72429d'],brute:['#ef8577','#993f63'],cultist:['#6fa7d8','#356297'],boss:['#e9c37d','#8f639e']}[e.type];
 const [light,dark]=e.type==='boss'?({grove:['#b8dfaa','#3f8672'],citadel:['#ffcba1','#a95164']}[e.variant]||config):config;
 ellipse(ctx,0,e.radius*.75,e.radius*1.1,e.radius*.4,'#0104177f');
 if(e.type==='boss'){
   const spin=t*.24;ring(ctx,0,0,e.radius+17,light,2);ring(ctx,0,0,e.radius+28,dark,2);
   for(let i=0;i<7;i++){const angle=i*PI2/7+spin;diamond(ctx,Math.cos(angle)*72,Math.sin(angle)*72,8,i%2?'#9c70ed':'#e2b976')}
   diamond(ctx,0,-17,37,flash?'#fff':light);ellipse(ctx,0,9,35,29,dark);diamond(ctx,0,0,21,GOLD);
 }else if(e.type==='brute'){
   ellipse(ctx,0,0,21,20,flash?'#fff':dark);diamond(ctx,-16,-14,11,light);diamond(ctx,16,-14,11,light);diamond(ctx,0,-2,12,light);
 }else if(e.type==='cultist'){
   ellipse(ctx,0,4,15,17,flash?'#fff':dark);diamond(ctx,0,-11,16,light);ellipse(ctx,0,-6,7,3,'#101629');
 }else{
   diamond(ctx,0,0,16,flash?'#fff':light);diamond(ctx,0,0,8,dark);
 }
 if(e.hp<e.maxHp){ctx.fillStyle='#1d233c';ctx.fillRect(-e.radius,-e.radius-15,e.radius*2,4);ctx.fillStyle='#e9a6c1';ctx.fillRect(-e.radius,-e.radius-15,e.radius*2*(e.hp/e.maxHp),4)}
 ctx.restore();
}
export function drawScene(canvas,ctx,s,profile,time=0,visual={}){
 const heroId=visual.appearance?.heroId||s.runConfig?.heroId||'mage';
 const selected=getSkinDefinition(visual.appearance?.skinId);
 const skin=selected?.heroId===heroId?selected:(COSMETICS.find(x=>x.id===profile.skin)||COSMETICS[0]);
 const reduceMotion=Boolean(profile.settings?.reduceMotion || (typeof window.matchMedia==='function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
 const options=visualBudget(profile.settings?.vfx || 'medium',reduceMotion);
 const bounds=canvas.getBoundingClientRect(),w=bounds.width||360,h=bounds.height||640;
 const dpr=Math.min(window.devicePixelRatio||1,options.dprCap);const pw=Math.round(w*dpr),ph=Math.round(h*dpr);
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const cam={x:clamp(s.player.x-w/2,0,Math.max(0,WORLD.width-w)),y:clamp(s.player.y-h/2,0,Math.max(0,WORLD.height-h))};
 backdrop(ctx,w,h,cam,s,options.reducedMotion?0:time);
 ctx.save();ctx.translate(-cam.x,-cam.y);
 if(s.sanctuary){ctx.globalAlpha=.12;ctx.fillStyle='#8fe0c8';ctx.beginPath();ctx.arc(s.sanctuary.x,s.sanctuary.y,s.sanctuary.radius,0,PI2);ctx.fill();ctx.globalAlpha=1;ring(ctx,s.sanctuary.x,s.sanctuary.y,s.sanctuary.radius,'#71c4b2',2)}
 for(const o of s.pickups){glow(ctx,o.x,o.y,'#61dcc9',26,.24*options.glow);diamond(ctx,o.x,o.y,7,'#6de7e0');diamond(ctx,o.x,o.y,3,'#fff9dc')}
 for(const e of s.enemies)enemyAvatar(ctx,e,options.reducedMotion?0:time,options.reducedMotion);
 for(const b of s.shots){glow(ctx,b.x,b.y,skin.glow,options.quality==='high'?27:15,.4*options.glow);ring(ctx,b.x,b.y,b.radius+1,skin.projectile,3);diamond(ctx,b.x,b.y,5,skin.color)}
 for(const b of s.hostileShots){glow(ctx,b.x,b.y,'#ff587e',30,.3*options.glow);ring(ctx,b.x,b.y,b.radius,'#ff9c9f',4)}
 for(const f of s.flashes){
  // Telegraph outlines never fade with graphics quality, skin tier or reduced motion.
  if(f.type==='warning'){paintBossWarning(ctx,f,{quality:options.quality,reducedMotion:options.reducedMotion});continue}
  const alpha=options.reducedMotion?.35:Math.min(.65,f.ttl/18*.42);ctx.globalAlpha=alpha;
  if(f.type==='chain'){ctx.strokeStyle='#85ecff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x2,f.y2);ctx.stroke()}
  else if(f.type==='nova')ring(ctx,f.x,f.y,f.radius*(1-f.ttl/35*.22),'#9adfff',3);
  else {const color={hurt:'#ff7187',critical:'#ffe79a',barrier:'#9ae4ff',healing:'#9ce4ac',hourglass:'#e6cb99',sanctuary:'#83e3c0',sunburst:'#ffd182',revive:'#ffb779'}[f.type]||'#d99dff';ring(ctx,f.x,f.y,Math.max(2,f.radius*(1-f.ttl/60*.6)),color,3)}
  ctx.globalAlpha=1;
 }
 if(s.skills.orbit){for(let i=0;i<3;i++){const a=i*PI2/3+(options.reducedMotion?0:time*2);const r=(70+s.skills.orbit*5)*(s.runConfig?.modifiers.orbitRadius||1);const x=s.player.x+Math.cos(a)*r,y=s.player.y+Math.sin(a)*r;glow(ctx,x,y,'#ff9365',24,.45*options.glow);diamond(ctx,x,y,10,'#ffbe83')}}
 for(const actor of s.supportActors||[]){const color={wisp:'#b5d5ff',sprite:'#b6e6c4',owl:'#ecd9ac'}[actor.id]||'#d9c5f3';glow(ctx,actor.x,actor.y,color,24,.3*options.glow);ellipse(ctx,actor.x,actor.y+6,10,4,'#0005');diamond(ctx,actor.x,actor.y,10,color);diamond(ctx,actor.x,actor.y,4,'#fff9ec')}
 const m=visual.movement||{x:0,y:0};
 const shot=visual.fireEvent;
 const enemy=s.enemies.find(e=>e.hp>0&&Math.hypot(e.x-s.player.x,e.y-s.player.y)<440);
 const pose=resolveHeroPose({heroId,tick:s.tick,moving:Math.hypot(m.x,m.y)>.001,moveVector:m,
  aimVector:shot?{x:shot.aimX,y:shot.aimY}:enemy?{x:enemy.x-s.player.x,y:enemy.y-s.player.y}:m,
  lastAttackTick:shot?.tick??null,attackIntervalTicks:s.player.fireDelay,
  targetPresent:Boolean(enemy),reducedMotion:options.reducedMotion});
 ctx.save();ctx.globalAlpha=options.reducedMotion?1:(s.player.invuln>0&&s.player.invuln%8<4?.45:1);
 const hasRig=renderHeroActor(ctx,{heroId,skin,pose,x:s.player.x,y:s.player.y,scale:.20});
 if(hasRig&&s.player.shield>0)ring(ctx,s.player.x,s.player.y,31,'#94dafa',2);
 ctx.restore();
 if(!hasRig)playerAvatar(ctx,s.player.x,s.player.y,profile,s,time,options);
 ctx.restore();
 const distantBoss=s.enemies.find(enemy=>enemy.type==='boss'&&enemy.hp>0&&(enemy.x<cam.x+20||enemy.x>cam.x+w-20||enemy.y<cam.y+20||enemy.y>cam.y+h-20));
 if(distantBoss){
   const x=clamp(distantBoss.x-cam.x,30,w-30),y=clamp(distantBoss.y-cam.y,125,Math.max(125,h-48));
   const direction=Math.atan2(distantBoss.y-s.player.y,distantBoss.x-s.player.x);
   ctx.save();ctx.translate(x,y);ellipse(ctx,0,0,19,19,'#111a2deb');ring(ctx,0,0,19,'#efd7a3',1.5);
   ctx.rotate(direction);ctx.fillStyle='#f3d89c';ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-6,-7);ctx.lineTo(-2,0);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.rotate(-direction);
   ctx.fillStyle='#fff0ca';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('BOSS',0,-25);ctx.restore();
 }
 const v=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.9);v.addColorStop(0,'transparent');v.addColorStop(1,'rgba(3,6,18,.47)');ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
}
