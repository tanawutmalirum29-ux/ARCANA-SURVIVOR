import { WORLD } from './engine.js';
import { COSMETICS } from './storage.js';

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
 const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,'#0d1630');gradient.addColorStop(.6,'#080e23');gradient.addColorStop(1,'#16132d');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
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
 const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.globalAlpha=intensity;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,PI2);ctx.fill();ctx.globalAlpha=1;
}
function playerAvatar(ctx,x,y,profile,s,t){
 const skin=COSMETICS.find(x=>x.id===profile.skin)||COSMETICS[0];
 const motion=profile.settings.reduceMotion?0:Math.sin(t*4)*3;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=s.player.invuln>0 && s.player.invuln%8<4?.45:1;
 ellipse(ctx,0,15,21,9,'rgba(0,0,0,.42)');glow(ctx,0,0,skin.glow,50,profile.settings.vfx==='low'?.18:.35);
 if(profile.settings.vfx==='high'){
   for(let a=0;a<5;a++){const angle=a*PI2/5+t*.7;diamond(ctx,Math.cos(angle)*27,Math.sin(angle)*18+motion*.4,3,skin.glow)}
 }
 ctx.fillStyle=skin.glow;ctx.beginPath();ctx.moveTo(-13,2);ctx.lineTo(-18,24);ctx.lineTo(0,16+motion*.3);ctx.lineTo(18,24);ctx.lineTo(13,2);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(252,232,184,.75)';ctx.lineWidth=1.5;ctx.stroke();
 ellipse(ctx,0,-7+motion*.3,13,14,skin.color);ellipse(ctx,0,-11+motion*.3,11,8,'#28314f');
 diamond(ctx,0,-9+motion*.3,6,GOLD);ring(ctx,0,-13+motion*.3,18,skin.glow,1.6);
 ctx.restore();
}
function enemyAvatar(ctx,e,t){
 ctx.save();ctx.translate(e.x,e.y);const flash=e.flash>0;
 const config={swarmer:['#b86cce','#72429d'],brute:['#ef8577','#993f63'],cultist:['#6fa7d8','#356297'],boss:['#e9c37d','#8f639e']}[e.type];
 const [light,dark]=config;
 ellipse(ctx,0,e.radius*.75,e.radius*1.1,e.radius*.4,'#0104177f');
 if(e.type==='boss'){
   const spin=t*.24;ring(ctx,0,0,e.radius+17,'#d4a967',2);ring(ctx,0,0,e.radius+28,'#8b5898',2);
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
export function drawScene(canvas,ctx,s,profile,time=0){
 const bounds=canvas.getBoundingClientRect(),w=bounds.width||360,h=bounds.height||640;
 const dpr=Math.min(window.devicePixelRatio||1,2);const pw=Math.round(w*dpr),ph=Math.round(h*dpr);
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const cam={x:clamp(s.player.x-w/2,0,Math.max(0,WORLD.width-w)),y:clamp(s.player.y-h/2,0,Math.max(0,WORLD.height-h))};
 backdrop(ctx,w,h,cam,s,time);
 ctx.save();ctx.translate(-cam.x,-cam.y);
 for(const o of s.pickups){glow(ctx,o.x,o.y,'#61dcc9',26,.24);diamond(ctx,o.x,o.y,7,'#6de7e0');diamond(ctx,o.x,o.y,3,'#fff9dc')}
 for(const e of s.enemies)enemyAvatar(ctx,e,time);
 for(const b of s.shots){glow(ctx,b.x,b.y,'#88ceff',23,.45);ring(ctx,b.x,b.y,b.radius+1,'#d0edff',3);diamond(ctx,b.x,b.y,5,'#fff4da')}
 for(const b of s.hostileShots){glow(ctx,b.x,b.y,'#ff587e',30,.3);ring(ctx,b.x,b.y,b.radius,'#ff9c9f',4)}
 for(const f of s.flashes){
  const alpha=Math.min(.65,f.ttl/18*.42);ctx.globalAlpha=alpha;
  if(f.type==='chain'){ctx.strokeStyle='#85ecff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x2,f.y2);ctx.stroke()}
  else if(f.type==='nova'||f.type==='warning') {ring(ctx,f.x,f.y,f.radius*(1-f.ttl/35*.22),f.type==='nova'?'#9adfff':'#ff777a',f.type==='warning'?5:3)}
  else ring(ctx,f.x,f.y,f.radius*(1-f.ttl/35*.6),f.type==='hurt'?'#ff7187':'#d99dff',3);
  ctx.globalAlpha=1;
 }
 if(s.skills.orbit){for(let i=0;i<3;i++){const a=i*PI2/3+time*2;const r=70+s.skills.orbit*5;const x=s.player.x+Math.cos(a)*r,y=s.player.y+Math.sin(a)*r;glow(ctx,x,y,'#ff9365',24,.45);diamond(ctx,x,y,10,'#ffbe83')}}
 playerAvatar(ctx,s.player.x,s.player.y,profile,s,time);
 ctx.restore();
 const v=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.2,w/2,h/2,Math.max(w,h)*.9);v.addColorStop(0,'transparent');v.addColorStop(1,'rgba(3,6,18,.47)');ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
}
