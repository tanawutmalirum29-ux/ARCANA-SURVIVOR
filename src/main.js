import {createGame,step,chooseUpgrade,formatTime,getReward,UPGRADE_DESCRIPTIONS} from './engine.js';
import {drawScene} from './render.js';
import {COSMETICS,loadProfile,saveProfile,awardRun,unlockGoldCosmetic} from './storage.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false});
let profile=loadProfile(),game=createGame(73001),screen='lobby',paused=false,lastTime=0,accumulator=0,lastHud=0;
const heldKeys=new Set();const touch={x:0,y:0,active:false,pointerId:null};
let toastUntil=0;
const profileSkin=()=>COSMETICS.find(x=>x.id===profile.skin)||COSMETICS[0];
function persist(){if(!saveProfile(profile))notify('ไม่สามารถบันทึกข้อมูลในเบราว์เซอร์นี้ได้')}
function notify(msg){$('toast').textContent=msg;$('toast').classList.remove('hidden');toastUntil=performance.now()+2800}
function panel(inner,extra=''){$('overlay').className=`overlay ${extra}`;$('overlay').innerHTML=inner;$('overlay').classList.remove('hidden')}
function hideOverlay(){$('overlay').classList.add('hidden');$('overlay').innerHTML=''}
function updateHud(){
 const p=game.player;
 $('clock').textContent=formatTime(game.tick);
 $('hp-fill').style.width=`${100*p.hp/p.maxHp}%`; $('hp-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;
 $('exp-fill').style.width=`${100*p.xp/p.nextXp}%`;$('exp-text').textContent=`LV ${p.level}`;
 $('kill-count').textContent=`✧ ${game.kills}`;
 const boss=game.enemies.find(e=>e.type==='boss'&&e.hp>0);
 $('boss-hud').classList.toggle('hidden',!boss);if(boss)$('boss-fill').style.width=`${100*boss.hp/boss.maxHp}%`;
}
function setPlayingUI(active){$('hud').classList.toggle('hidden',!active);$('joystick').classList.toggle('hidden',!active);if(!active)$('boss-hud').classList.add('hidden')}
function showLobby(){
 heldKeys.clear();releaseTouch();screen='lobby';paused=false;setPlayingUI(false);toastUntil=0;$('toast').classList.add('hidden');const skin=profileSkin();
 panel(`<section class="main-card lobby">
 <div class="eyebrow"><span class="starline">✧</span> A WORLD OF ARCANE WONDER <span class="starline">✧</span></div>
 <h1>ARCANA<br><em>SURVIVOR</em></h1>
 <p class="tagline">THE STARFALL AWAITS</p>
 <div class="ornament">◇ ───────── ✦ ───────── ◇</div>
 <div class="hero-preview"><div class="skin-halo" style="--skin-color:${skin.glow}"><div class="hero-portrait" style="--skin-main:${skin.color};--skin-shadow:${skin.glow}"><span class="hero-crown">✦</span></div></div><div class="skin-label">${skin.name}</div></div>
 <div class="lobby-stats"><div><b>${profile.gold}</b><small>GOLD ✦</small></div><div><b>${profile.runs}</b><small>RUNS</small></div><div><b>${profile.totalKills}</b><small>KILLS</small></div></div>
 <button type="button" data-action="start" class="button primary wide">✦ &nbsp; เข้าสู่สนามรบ &nbsp; ✦</button>
 <div class="action-row"><button type="button" data-action="wardrobe" class="button secondary">◇ คลังสกิน</button><button type="button" data-action="settings" class="button secondary">⚙ ตั้งค่า</button></div>
 <p class="legal-note">FREE TO PLAY · OFFLINE DEMO · NO REAL MONEY PURCHASES</p>
 </section>`,'lobby-overlay');
}
function showWardrobe(){screen='wardrobe';setPlayingUI(false);
 const cards=COSMETICS.map(s=>{const owned=profile.owned.includes(s.id),equipped=profile.skin===s.id;
   const buy=s.id==='ember'&&!owned&&profile.gold>=120;
   return `<div class="skin-card ${equipped?'active':''}" style="--skin-color:${s.glow}"><div class="skin-dot" style="background:${s.color}"></div><div class="skin-info"><b>${s.name}</b><small>${s.th} · ${s.rarity} · ${s.source}</small><span>${s.desc}</span></div><button class="button tiny ${equipped?'accent':'secondary'}" type="button" ${!owned&&!buy?'disabled':''} data-action="${owned?'equip':buy?'unlock':'locked'}" data-id="${s.id}">${equipped?'สวมอยู่':owned?'สวมใส่':buy?'120 GOLD':'ล็อก'}</button></div>`;
 }).join('');
 panel(`<section class="main-card menu-card"><div class="eyebrow">COLLECTION</div><h2>WARDROBE</h2><p class="muted">ทุกชุดมีค่าพลังเท่ากัน · รับสกินได้ฟรีจากการเล่น</p><div class="currency-pill">✦ ${profile.gold} GOLD</div><div class="skins">${cards}</div><button class="button secondary wide" data-action="home" type="button">← กลับล็อบบี้</button></section>`,'menu-overlay');
}
function showSettings(from='lobby'){
 screen='settings';window.__returnTo=from;
 panel(`<section class="main-card menu-card"><div class="eyebrow">GAME OPTIONS</div><h2>SETTINGS</h2><div class="setting-row"><div><b>คุณภาพเอฟเฟกต์</b><small>ปรับความสวยให้เหมาะกับอุปกรณ์</small></div><button class="button secondary" type="button" data-action="vfx">${profile.settings.vfx==='high'?'HIGH':'LOW'}</button></div><div class="setting-row"><div><b>ลดการเคลื่อนไหว</b><small>ปิดการขยับตกแต่งและแสงมากเกินไป</small></div><button class="button secondary" type="button" data-action="motion">${profile.settings.reduceMotion?'ON':'OFF'}</button></div><div class="tip">เดินด้วย WASD / ลูกศร หรือจอยสัมผัส<br>กด Esc เพื่อหยุดเกม · ระบบบันทึกในเครื่องนี้</div><button class="button primary wide" type="button" data-action="back">เสร็จสิ้น</button></section>`,'menu-overlay');
}
function startRun(){
 game=createGame(73001+profile.runs*79);screen='play';paused=false;accumulator=0;heldKeys.clear();touch.x=touch.y=0;touch.active=false;
 hideOverlay();setPlayingUI(true);updateHud();notify('เอาชีวิตรอดจนบอสปรากฏตัวที่ 01:10');
}
function showUpgrade(){heldKeys.clear();releaseTouch();screen='upgrade';const cards=game.upgrades.map(k=>{const [name,description]=UPGRADE_DESCRIPTIONS[k];return `<button class="upgrade-option" type="button" data-action="upgrade" data-id="${k}"><span class="upgrade-sigil">✧</span><span><b>${name}</b><small>${description}</small></span><span class="chevron">›</span></button>`}).join('');
 panel(`<section class="main-card menu-card upgrade-card"><div class="eyebrow">LEVEL UP — LV ${game.player.level}</div><h2>CHOOSE YOUR POWER</h2><p class="muted">เลือกพรเวทมนตร์ 1 อย่างเพื่อสู้ต่อ</p><div class="upgrade-list">${cards}</div></section>`,'upgrade-overlay');
}
function finishRun(){
 if(screen==='result')return;heldKeys.clear();releaseTouch();screen='result';setPlayingUI(false);
 const reward=getReward(game);profile=awardRun(profile,{gold:reward,kills:game.kills,seconds:game.tick/60});persist();const won=game.phase==='won';
 panel(`<section class="main-card menu-card result-card"><div class="eyebrow">${won?'THE STARS ARE YOURS':'THE FALLEN SHALL RISE'}</div><h2>${won?'VICTORY':'DEFEAT'}</h2><div class="result-icon">${won?'✦':'◇'}</div><p class="muted">${won?'คุณเอาชนะผู้พิทักษ์แห่งดาวตกได้แล้ว':'การเดินทางยังไม่สิ้นสุด ลองใหม่อีกครั้ง'}</p><div class="result-stats"><div><small>TIME</small><b>${formatTime(game.tick)}</b></div><div><small>DEFEATED</small><b>${game.kills}</b></div><div><small>REWARD</small><b>+${reward} ✦</b></div></div><button class="button primary wide" type="button" data-action="start">เล่นอีกครั้ง</button><button class="button secondary wide" type="button" data-action="home">กลับล็อบบี้</button></section>`,'menu-overlay');
}
function showPause(){if(screen!=='play')return;heldKeys.clear();releaseTouch();paused=true;screen='pause';
 panel(`<section class="main-card menu-card pause-card"><div class="eyebrow">TIME FROZEN</div><h2>PAUSED</h2><p class="muted">เวลาหยุดระหว่างพัก</p><button class="button primary wide" type="button" data-action="resume">เล่นต่อ</button><button class="button secondary wide" type="button" data-action="settings">ตั้งค่า</button><button class="button secondary wide" type="button" data-action="home">ออกสู่ล็อบบี้</button></section>`,'menu-overlay');
}
function resume(){screen='play';paused=false;accumulator=0;lastTime=0;hideOverlay()}
function handleAction(action,id){
 if(action==='home')return showLobby();
 if(action==='start')return startRun();
 if(action==='wardrobe')return showWardrobe();
 if(action==='settings')return showSettings(screen==='play'?'pause':screen);
 if(action==='back')return window.__returnTo==='pause'?showPauseFromSettings():showLobby();
 if(action==='vfx'){profile.settings.vfx=profile.settings.vfx==='high'?'low':'high';persist();return showSettings(window.__returnTo)}
 if(action==='motion'){profile.settings.reduceMotion=!profile.settings.reduceMotion;persist();return showSettings(window.__returnTo)}
 if(action==='pause')return showPause();
 if(action==='resume')return resume();
 if(action==='upgrade') {if(chooseUpgrade(game,id)){screen='play';hideOverlay();updateHud()}return;}
 if(action==='equip'&&profile.owned.includes(id)){profile.skin=id;persist();return showWardrobe()}
 if(action==='unlock'){
   const next=unlockGoldCosmetic(profile,id,120);
   if(next){profile=next;persist();notify('ปลดล็อกสกินสำเร็จ');showWardrobe()}
   return;
 }
}
function showPauseFromSettings(){screen='play';showPause()}
$('overlay').addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(button&&!button.disabled)handleAction(button.dataset.action,button.dataset.id);
});
$('pause-btn').addEventListener('click',showPause);
const movingKeys={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
window.addEventListener('keydown',e=>{
 if(Object.hasOwn(movingKeys,e.code)){heldKeys.add(e.code);e.preventDefault()}
 if(e.code==='Escape'&&!e.repeat){if(screen==='play')showPause();else if(screen==='pause')resume()}
});
window.addEventListener('keyup',e=>heldKeys.delete(e.code));
window.addEventListener('blur',()=>{heldKeys.clear();releaseTouch();if(screen==='play')showPause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='play')showPause()});
const joystick=$('joystick'),knob=$('knob');
function moveTouch(e){
 if(touch.pointerId!==e.pointerId)return;
 const rect=joystick.getBoundingClientRect();const centerX=rect.left+rect.width/2,centerY=rect.top+rect.height/2;
 const dx=e.clientX-centerX,dy=e.clientY-centerY;const magnitude=Math.hypot(dx,dy)||1,range=rect.width*.32;
 const scale=Math.min(1,range/magnitude),mx=dx*scale,my=dy*scale;
 touch.x=mx/range;touch.y=my/range;knob.style.transform=`translate(${mx}px,${my}px)`;
}
function releaseTouch(e){if(e&&touch.pointerId!==e.pointerId)return;touch.active=false;touch.pointerId=null;touch.x=0;touch.y=0;knob.style.transform='translate(0,0)'}
joystick.addEventListener('pointerdown',e=>{if(screen!=='play'||touch.active)return;e.preventDefault();touch.pointerId=e.pointerId;touch.active=true;joystick.setPointerCapture(e.pointerId);moveTouch(e)});
joystick.addEventListener('pointermove',e=>{if(touch.active)moveTouch(e)});
joystick.addEventListener('pointerup',releaseTouch);joystick.addEventListener('pointercancel',releaseTouch);joystick.addEventListener('lostpointercapture',releaseTouch);
function inputVector(){let x=touch.x,y=touch.y;for(const key of heldKeys){const [vx,vy]=movingKeys[key];x+=vx;y+=vy}return {x,y}}
function frame(ts){
 const delta=lastTime?Math.min(.05,(ts-lastTime)/1000):0;lastTime=ts;
 if(screen==='play'&&!paused){
   accumulator+=delta;
   for(let i=0;i<5&&accumulator>=1/60;i++){
     step(game,inputVector());accumulator-=1/60;
     if(game.phase!=='running'){
       if(game.phase==='upgrade')showUpgrade();else finishRun();accumulator=0;break;
     }
   }
   if(ts-lastHud>90){updateHud();lastHud=ts;}
 }
 drawScene(canvas,ctx,game,profile,ts/1000);
 if(toastUntil&&ts>toastUntil){$('toast').classList.add('hidden');toastUntil=0}
 requestAnimationFrame(frame);
}
showLobby();requestAnimationFrame(frame);
