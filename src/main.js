import {createGame,step,chooseUpgrade,formatTime,getUpgradeDescription,getLastPlayerFireEvent} from './engine.js';
import {drawScene} from './render.js';
import {resolveReducedMotion} from './visual/presentation.js';
import {resolveReducedMotion} from './visual/presentation.js';
import {mountSkinShowcase} from './visual/showcase.js';
import {createGameAudio,captureAudioState,getStepSounds} from './audio.js';
import {COSMETICS,defaultProfile} from './storage.js';
import {createCampaignStore} from './campaignStore.js';
import {createCampaignClient} from './campaignClient.js';
import {CHAPTERS,MODES,ERROR_MESSAGES} from './progression/index.js';
import {mountLobby} from './ui/lobby.js';
import {HERO_IDS,listSkinsForHero,getEquippedSkin} from './characters/skins/index.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false});
const osPrefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const motionReduced=()=>resolveReducedMotion(profile.settings,osPrefersReducedMotion());
let profile=defaultProfile(),campaign=null,game=createGame(73001),screen='loading',paused=false,lastTime=0,accumulator=0,lastHud=0;
const heldKeys=new Set();const touch={x:0,y:0,active:false,pointerId:null,originX:0,originY:0};
let toastUntil=0;
let showcaseController=null,lobbyController=null,lobbyView=null,currentRunId=null,pendingFinish=null,starting=false,finishing=false;
let wardrobeHeroId=null,runAppearance=null,runMovement={x:0,y:0};
const campaignStore=createCampaignStore();
let channel=null;
try {if(typeof BroadcastChannel==='function')channel=new BroadcastChannel('arcana-campaign-updated');}catch{}
const campaignClient=createCampaignClient({
 store:campaignStore,
 onChange:next=>{campaign=next;profile=next.profile;lobbyController?.update(next)},
 onCommit:()=>{try{channel?.postMessage('updated')}catch{}},
});
if(channel)channel.onmessage=()=>campaignClient.load();
window.addEventListener('focus',()=>{if(campaign)campaignClient.load()});
function disposeLobby(){if(lobbyController){lobbyView=lobbyController.getViewState();lobbyController.dispose();lobbyController=null;}}
function storageMessage(code){
 if(code==='STALE_STATE')return 'ข้อมูลเปลี่ยนจากอีกแท็บแล้ว กรุณาตรวจยอดและลองอีกครั้ง';
 if(['LEGACY_CORRUPT','CORRUPT_SAVE','LEGACY_UNSUPPORTED','UNSUPPORTED_SAVE'].includes(code))return 'อ่านเซฟนี้ไม่ได้ ข้อมูลเดิมยังอยู่ กรุณาใช้เวอร์ชันที่รองรับเซฟนี้';
 return ERROR_MESSAGES[code]||'ไม่สามารถบันทึกข้อมูลในเบราว์เซอร์นี้ได้ กรุณาลองอีกครั้ง';
}
async function commitCommand(command){
 const result=await campaignClient.dispatch(command);
 if(!result.ok)notify(storageMessage(result.code));
 return result;
}
function disposeShowcase(){if(showcaseController){showcaseController.dispose();showcaseController=null;}}
const sound=createGameAudio();
function notify(msg){$('toast').textContent=msg;$('toast').classList.remove('hidden');toastUntil=performance.now()+2800}
function panel(inner,extra=''){disposeLobby();disposeShowcase();$('toast').classList.add('hidden');toastUntil=0;$('overlay').className=`overlay ${extra}`;$('overlay').innerHTML=inner;$('overlay').classList.remove('hidden')}
function hideOverlay(){disposeLobby();disposeShowcase();$('overlay').classList.add('hidden');$('overlay').innerHTML=''}
function updateHud(){
 const p=game.player;
 $('clock').textContent=formatTime(game.tick);
 $('hp-fill').style.width=`${100*p.hp/p.maxHp}%`; $('hp-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;
 $('exp-fill').style.width=`${100*p.xp/p.nextXp}%`;$('exp-text').textContent=`LV ${p.level}`;
 $('kill-count').textContent=`✧ ${game.kills}`;
 if(game.runConfig)$('run-objective').textContent=game.timeLimitTicks?`เอาชีวิตรอด · เหลือ ${formatTime(Math.max(0,game.timeLimitTicks-game.tick))}`:game.targetBosses>1?`บอส ${game.bossesDefeated}/${game.targetBosses} · ด่าน ${game.stage}`:game.runConfig.mode==='endless'?`ด่าน ${game.stage} · บอสที่ปราบ ${game.bossesDefeated}`:game.bossSpawned?'ปราบบอสเพื่อผ่านบท':`บอสใน ${formatTime(Math.max(0,game.bossAtTicks-game.tick))}`;
 const boss=game.enemies.find(e=>e.type==='boss'&&e.hp>0);
 $('boss-hud').classList.toggle('hidden',!boss);if(boss){$('boss-fill').style.width=`${100*boss.hp/boss.maxHp}%`;$('boss-hud').querySelector('.boss-name').textContent=boss.name||'STARFALL WARDEN'}
}
function setPlayingUI(active){$('hud').classList.toggle('hidden',!active);$('joystick').classList.toggle('hidden',!active);if(!active)$('boss-hud').classList.add('hidden')}
function showLobby(){
 if(!campaign)return boot();
 heldKeys.clear();releaseTouch();screen='lobby';paused=false;setPlayingUI(false);
 wardrobeHeroId=campaign.progression.heroId;
 panel('','lobby-overlay lobby-host');
 lobbyController=mountLobby($('overlay'),{
  campaign,viewState:lobbyView,onCommand:commitCommand,onStart:startRun,
  onWardrobe:showWardrobe,onSettings:()=>showSettings('lobby'),onPreviewSkin:showSkinShowcase,
 });
}
function showWardrobe(){
 screen='wardrobe';setPlayingUI(false);
 const heroId=wardrobeHeroId||campaign.progression.heroId;
 const slot=campaign.progression.wardrobe?.[heroId];
 const equipped=getEquippedSkin(campaign,heroId);
 const cards=listSkinsForHero(heroId).map(s=>{
   const legacy=COSMETICS.find(c=>c.id===(s.variant==='base'?'apprentice':s.variant));
   const owned=slot?.owned?.includes(s.id)===true;
   const wearing=equipped===s.id;
   const buy=s.variant==='ember'&&!owned&&profile.gold>=120&&!profile.owned.includes('ember');
   return `<div class="skin-card ${wearing?'active':''}" style="--skin-color:${s.glow}"><div class="skin-dot" style="background:${s.color}"></div><div class="skin-info"><b>${legacy?.name||s.variant}</b><small>${legacy?.th||s.variant} · ${legacy?.rarity||'COMMON'} · ${legacy?.source||'FREE'}</small><span>${legacy?.desc||''}</span></div><button class="button tiny secondary" type="button" data-action="preview" data-id="${s.id}">PREVIEW</button><button class="button tiny ${wearing?'accent':'secondary'}" type="button" ${!owned&&!buy?'disabled':''} data-action="${owned?'equip':buy?'unlock':'locked'}" data-id="${s.id}">${wearing?'สวมอยู่':owned?'สวมใส่':buy?'120 GOLD':'ล็อก'}</button></div>`;
 }).join('');
 const tabs=HERO_IDS.map(id=>{
   const enabled=campaign.progression.heroes[id]?.level>0;
   const label={mage:'ASTRA · MAGE',guardian:'ORIN · GUARDIAN',ranger:'LYRA · RANGER'}[id];
   return `<button type="button" class="button tiny ${id===heroId?'accent':'secondary'}" data-action="wardrobe-hero" data-id="${id}" ${enabled?'':'disabled'} aria-pressed="${id===heroId}">${label}</button>`;
 }).join('');
 panel(`<section class="main-card menu-card"><div class="eyebrow">COLLECTION · ${heroId.toUpperCase()}</div><h2>WARDROBE</h2><p class="muted">ชุดแยกตามนักรบ · ไม่มีผลต่อค่าพลัง</p><div class="skins-hero-tabs" role="group" aria-label="Choose hero">${tabs}</div><div class="currency-pill">✦ ${profile.gold} GOLD</div><div class="skins">${cards}</div><button class="button secondary wide" data-action="home" type="button">← กลับล็อบบี้</button></section>`,'menu-overlay');
}
function showSkinShowcase(id){
 const heroId=id?.split(':')[0]||wardrobeHeroId||campaign.progression.heroId;
 if(!HERO_IDS.includes(heroId)||!listSkinsForHero(heroId).some(s=>s.id===id))return;
 heldKeys.clear();releaseTouch();screen='showcase';setPlayingUI(false);disposeLobby();disposeShowcase();
 wardrobeHeroId=heroId;
 const slot=campaign.progression.wardrobe[heroId];
 const catalog=listSkinsForHero(heroId).map(s=>{
   const old=COSMETICS.find(c=>c.id===(s.variant==='base'?'apprentice':s.variant));
   return {...old,...s,name:old?.name||s.variant,th:old?.th||s.variant,
      rarity:old?.rarity||'COMMON',source:old?.source||'FREE',
      vfx:old?.vfx||'arcane',desc:old?.desc||'',color:s.color,glow:s.glow,projectile:s.projectile};
 });
 const safe={...structuredClone(profile),skin:getEquippedSkin(campaign,heroId),owned:[...slot.owned]};
 const host=$('overlay');host.className='overlay menu-overlay';host.classList.remove('hidden');
 showcaseController=mountSkinShowcase({
   host,profile:safe,catalog,initialSkinId:id,quality:safe.settings.vfx,
   reducedMotion:resolveReducedMotion(safe.settings),
   onClose:()=>{disposeShowcase();showWardrobe()},
   onEquip:async nextId=>{
     const result=await commitCommand({type:'EQUIP_COSMETIC',heroId,cosmeticId:nextId});
     if(result.ok){sound.play('equip');disposeShowcase();showWardrobe();}
   },
   onSettingsChange:async settings=>{
     const selected=showcaseController?.getSelection();
     const result=await commitCommand({type:'PROFILE_SETTINGS',settings});
     if(!result.ok&&screen==='showcase')showSkinShowcase(selected||id);
   }
 });
}
function showSettings(from='lobby'){
 screen='settings';window.__returnTo=from;
 panel(`<section class="main-card menu-card"><div class="eyebrow">GAME OPTIONS</div><h2>SETTINGS</h2><div class="setting-row"><div><b>คุณภาพเอฟเฟกต์</b><small>ปรับความสวยให้เหมาะกับอุปกรณ์</small></div><button class="button secondary" type="button" data-action="vfx">${profile.settings.vfx.toUpperCase()}</button></div><div class="setting-row"><div><b>ลดการเคลื่อนไหว</b><small>ปิดการขยับตกแต่งและแสงมากเกินไป</small></div><button class="button secondary" type="button" data-action="motion">${motionReduced()?'ON':'OFF'}</button></div><div class="setting-row"><div><b>เสียงเวทมนตร์และเพลง</b><small>สังเคราะห์ในเครื่อง · เล่นออฟไลน์</small></div><button class="button secondary" type="button" data-action="sound">${sound.isEnabled()?'SOUND ON':'SOUND OFF'}</button></div><div class="setting-row"><div><b>เพลงล็อบบี้ตามเทศกาล</b><small>เปลี่ยนอัตโนมัติตามวันที่หรือเลือกธีมเองได้</small></div><button class="button secondary" type="button" data-action="music-settings">${sound.musicChoices().find(c=>c.id===sound.getMusicChoice())?.label} ↻</button></div><div class="tip">เดินด้วย WASD / ลูกศร หรือจอยสัมผัส<br>กด Esc เพื่อหยุดเกม · ระบบบันทึกในเครื่องนี้</div><button class="button primary wide" type="button" data-action="back">เสร็จสิ้น</button></section>`,'menu-overlay');
}
async function startRun(){
 if(starting||finishing||pendingFinish)return;
 starting=true;
 try {
  const loaded=await campaignClient.load();
  if(!loaded.ok){notify(storageMessage(loaded.code));return}
  let active=campaign.progression.activeRun;
  if(!active){
   const result=await commitCommand({type:'START_RUN',day:new Date().toISOString().slice(0,10)});
   if(!result.ok)return;
   active=campaign.progression.activeRun;
  }
  sound.unlock();sound.play('start');
  if(currentRunId!==active.id||!['running','upgrade'].includes(game.phase)){
   game=createGame(active.seed,active.runConfig);currentRunId=active.id;
  }
  runAppearance=structuredClone(active.appearance);runMovement={x:0,y:0};
  screen='play';paused=false;accumulator=0;lastTime=0;heldKeys.clear();releaseTouch();
  hideOverlay();setPlayingUI(true);updateHud();
  const chapter=CHAPTERS.find(item=>item.id===active.chapterId),mode=MODES.find(item=>item.id===active.mode);
  $('run-tag').textContent=`✦ ${chapter?.name||active.chapterId} · ${mode?.name||active.mode}`;
  const bossName=$('boss-hud').querySelector('.boss-name');
  bossName.textContent=chapter?.bossName||'STARFALL WARDEN';
  notify(game.timeLimitTicks?`เอาชีวิตรอด ${formatTime(game.timeLimitTicks)}`:game.targetBosses>1?`เอาชนะบอส ${game.targetBosses} ตัว`:`เอาชีวิตรอดจนบอสปรากฏตัวที่ ${formatTime(game.bossAtTicks)}`);
  if(game.phase==='upgrade')showUpgrade();
 }finally{starting=false}
}
function showUpgrade(){sound.play('level');heldKeys.clear();releaseTouch();screen='upgrade';const cards=game.upgrades.map(k=>{const [name,description]=getUpgradeDescription(k,game.runConfig?.heroId);return `<button class="upgrade-option" type="button" data-action="upgrade" data-id="${k}"><span class="upgrade-sigil">✧</span><span><b>${name}</b><small>${description}</small></span><span class="chevron">›</span></button>`}).join('');
 panel(`<section class="main-card menu-card upgrade-card"><div class="eyebrow">LEVEL UP — LV ${game.player.level}</div><h2>CHOOSE YOUR POWER</h2><p class="muted">เลือกพรเวทมนตร์ 1 อย่างเพื่อสู้ต่อ</p><div class="upgrade-list">${cards}</div></section>`,'upgrade-overlay');
}
async function finishRun(){
 if(finishing)return;
 if(!pendingFinish){
  if(screen==='result')return;
  heldKeys.clear();releaseTouch();screen='result';setPlayingUI(false);
  sound.play(game.phase==='won'?'victory':'defeat');
  pendingFinish={type:'FINISH_RUN',runId:currentRunId,stats:{kills:game.kills,seconds:Math.floor(game.tick/60),won:game.phase==='won'}};
 }
 finishing=true;
 panel('<section class="main-card menu-card"><h2>กำลังบันทึกรางวัล…</h2><p class="muted">รอสักครู่</p></section>','menu-overlay');
 try {
  const result=await commitCommand(pendingFinish);
  const committed=result.ok||result.code==='ALREADY_CLAIMED';
  const won=pendingFinish.stats.won;
  const details=result.details||{};
  const closedElsewhere=result.code==='ALREADY_CLAIMED';
  const rewardText=closedElsewhere?'ไม่มีรางวัลเพิ่มเติม':`+${details.gold||0} ✦`;
  panel(`<section class="main-card menu-card result-card"><div class="eyebrow">${committed?'RUN COMPLETE':'SAVE PENDING'}</div><h2>${closedElsewhere?'รอบนี้ถูกปิดแล้ว':committed?(won?'VICTORY':'DEFEAT'):'ยังบันทึกไม่สำเร็จ'}</h2><div class="result-icon">${won?'✦':'◇'}</div><p class="muted">${closedElsewhere?'รอบนี้จบหรือถูกยุติจากอีกแท็บแล้ว':committed?(won?'ผ่านด่านสำเร็จ เตรียมอุปกรณ์แล้วไปต่อกัน':'นำรางวัลไปพัฒนาตัวละครแล้วลองใหม่'):'รางวัลยังไม่ได้เข้าคลัง กดลองบันทึกอีกครั้ง รอบเดิมยังถูกเก็บไว้'}</p><div class="result-stats"><div><small>TIME</small><b>${formatTime(game.tick)}</b></div><div><small>DEFEATED</small><b>${game.kills}</b></div><div><small>REWARD</small><b>${committed?rewardText:'รอบันทึก'}</b></div></div>${committed?`<p class="muted">${details.essence?`เอสเซนซ์ +${details.essence} · `:''}${details.items?.length?`อุปกรณ์ +${details.items.length} · `:''}${details.firstClear?'ปลดล็อกความก้าวหน้าด่านใหม่':''}</p><button class="button primary wide" type="button" data-action="start">เล่นอีกครั้ง</button><button class="button secondary wide" type="button" data-action="home">กลับล็อบบี้</button>`:'<button class="button primary wide" type="button" data-action="retry-save">ลองบันทึกอีกครั้ง</button>'}</section>`,'menu-overlay');
  if(committed){pendingFinish=null;currentRunId=null}
 }finally{finishing=false}
}
function showPause(){if(screen!=='play')return;sound.play('pause');heldKeys.clear();releaseTouch();paused=true;screen='pause';
 panel(`<section class="main-card menu-card pause-card"><div class="eyebrow">TIME FROZEN</div><h2>PAUSED</h2><p class="muted">เวลาหยุดระหว่างพัก</p><button class="button primary wide" type="button" data-action="resume">เล่นต่อ</button><button class="button secondary wide" type="button" data-action="settings">ตั้งค่า</button><button class="button secondary wide" type="button" data-action="home">ออกสู่ล็อบบี้</button></section>`,'menu-overlay');
}
function resume(){sound.unlock();sound.play('resume');screen='play';paused=false;accumulator=0;lastTime=0;hideOverlay()}
async function handleAction(action,id){
 if(action==='retry-load')return boot();
 if(action==='retry-save')return finishRun();
 if(action==='home'){sound.play('menuBack');return showLobby()}
 if(action==='start')return startRun();
 if(action==='wardrobe'){sound.unlock();sound.play('menuOpen');return showWardrobe()}
 if(action==='wardrobe-hero'){if(HERO_IDS.includes(id)&&campaign.progression.heroes[id]?.level>0){wardrobeHeroId=id;return showWardrobe()}return;}
 if(action==='preview'){sound.unlock();sound.play('menuOpen');return showSkinShowcase(id)}
 if(action==='settings'){sound.unlock();sound.play('menuOpen');return showSettings(screen==='play'?'pause':screen)}
 if(action==='back'){sound.play('menuBack');return window.__returnTo==='pause'?showPauseFromSettings():showLobby()}
 if(action==='vfx'){const vfx=profile.settings.vfx==='high'?'low':profile.settings.vfx==='low'?'medium':'high';if((await commitCommand({type:'PROFILE_SETTINGS',settings:{vfx}})).ok)sound.play('switch');return showSettings(window.__returnTo)}
 if(action==='motion'){if((await commitCommand({type:'PROFILE_SETTINGS',settings:{reduceMotion:!motionReduced()}})).ok)sound.play('switch');return showSettings(window.__returnTo)}
 if(action==='sound'){sound.setEnabled(!sound.isEnabled());if(sound.isEnabled()){sound.unlock();sound.play('menu')}return showSettings(window.__returnTo)}
 if(action==='music-settings'){
   const choices=sound.musicChoices(),idx=choices.findIndex(c=>c.id===sound.getMusicChoice());
   sound.setMusicChoice(choices[(idx+1)%choices.length].id);
   sound.unlock();sound.play('switch');
   return showSettings(window.__returnTo);
 }
 if(action==='pause')return showPause();
 if(action==='resume')return resume();
 if(action==='upgrade') {if(chooseUpgrade(game,id)){sound.play(id==='heal'?'heal':'upgradeSelect');screen='play';hideOverlay();updateHud()}return;}
 if(action==='equip'){
   if((await commitCommand({type:'EQUIP_COSMETIC',heroId:id?.split(':')[0],cosmeticId:id})).ok)sound.play('equip');
   return showWardrobe();
 }
 if(action==='unlock'){
   if((await commitCommand({type:'UNLOCK_COSMETIC',heroId:id?.split(':')[0],cosmeticId:id})).ok){sound.play('unlock');notify('ปลดล็อกสกินสำเร็จ')}
   return showWardrobe();
 }
}
function showPauseFromSettings(){screen='play';showPause()}
$('overlay').addEventListener('click',event=>{
 if(screen==='lobby')return;
 const button=event.target.closest('[data-action]');if(button&&!button.disabled)handleAction(button.dataset.action,button.dataset.id).catch(()=>notify('เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'));
});
$('pause-btn').addEventListener('click',showPause);
const movingKeys={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
window.addEventListener('keydown',e=>{
 if(screen==='play'&&Object.hasOwn(movingKeys,e.code)){heldKeys.add(e.code);e.preventDefault()}
 if(e.code==='Escape'&&!e.repeat){if(screen==='play')showPause();else if(screen==='pause')resume();else if(screen==='showcase'){disposeShowcase();showWardrobe()}}
});
window.addEventListener('keyup',e=>heldKeys.delete(e.code));
window.addEventListener('blur',()=>{heldKeys.clear();releaseTouch();if(screen==='play')showPause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='play')showPause()});
const joystick=$('joystick'),knob=$('knob');
function moveTouch(e){
 if(touch.pointerId!==e.pointerId)return;
 const dx=e.clientX-touch.originX,dy=e.clientY-touch.originY;
 const magnitude=Math.hypot(dx,dy)||1,range=joystick.getBoundingClientRect().width*.32;
 const scale=Math.min(1,range/magnitude),mx=dx*scale,my=dy*scale;
 touch.x=mx/range;touch.y=my/range;knob.style.transform=`translate(${mx}px,${my}px)`;
}
function releaseTouch(e){
 if(e&&touch.pointerId!==e.pointerId)return;
 touch.active=false;touch.pointerId=null;touch.x=0;touch.y=0;
 knob.style.transform='translate(0px,0px)';joystick.classList.remove('active');
}
// The point where a drag begins is the joystick origin; the canvas owns pointer capture.
canvas.addEventListener('pointerdown',e=>{
 if(screen!=='play'||touch.active||(e.pointerType==='mouse'&&e.button!==0))return;
 e.preventDefault();
 const rect=canvas.getBoundingClientRect();
 touch.pointerId=e.pointerId;touch.active=true;touch.originX=e.clientX;touch.originY=e.clientY;
 joystick.style.left=`${e.clientX-rect.left}px`;joystick.style.top=`${e.clientY-rect.top}px`;
 joystick.classList.add('active');
 // Some WebKit and embedded browsers can reject capture. Window listeners
 // retain movement/release tracking so failed capture cannot lock input.
 try{canvas.setPointerCapture(e.pointerId)}catch{}
 moveTouch(e);
});
canvas.addEventListener('pointermove',e=>{if(touch.active)moveTouch(e)});
canvas.addEventListener('pointerup',releaseTouch);
canvas.addEventListener('pointercancel',releaseTouch);
canvas.addEventListener('lostpointercapture',releaseTouch);
// Capture normally routes these to canvas; a rejected capture falls back to window.
window.addEventListener('pointermove',e=>{if(touch.active)moveTouch(e)});
window.addEventListener('pointerup',releaseTouch);
window.addEventListener('pointercancel',releaseTouch);
function inputVector(){let x=touch.x,y=touch.y;for(const key of heldKeys){const [vx,vy]=movingKeys[key];x+=vx;y+=vy}return {x,y}}
function frame(ts){
 const delta=lastTime?Math.min(.05,(ts-lastTime)/1000):0;lastTime=ts;
 if(screen==='play'&&!paused){
   accumulator+=delta;
   for(let i=0;i<5&&accumulator>=1/60;i++){
     const beforeAudio=captureAudioState(game);
     const px=game.player.x,py=game.player.y;
     step(game,inputVector());runMovement={x:game.player.x-px,y:game.player.y-py};accumulator-=1/60;
     for(const cue of getStepSounds(beforeAudio,game))sound.play(cue);
     if(game.phase!=='running'){
       if(game.phase==='upgrade')showUpgrade();else finishRun();accumulator=0;break;
     }
   }
   if(ts-lastHud>90){updateHud();lastHud=ts;}
 }
 const lobbyVisible=screen==='lobby'||screen==='wardrobe'||screen==='showcase'||
   (screen==='settings'&&window.__returnTo!=='pause');
 const musicMode=document.hidden?false:
   screen==='play'&&!paused?'play':lobbyVisible?'lobby':false;
 sound.update(musicMode);
 drawScene(canvas,ctx,game,profile,ts/1000,{appearance:runAppearance,movement:runMovement,fireEvent:getLastPlayerFireEvent(game)});
 if(toastUntil&&ts>toastUntil){$('toast').classList.add('hidden');toastUntil=0}
 requestAnimationFrame(frame);
}
// Start lobby music automatically whenever the browser permits autoplay.
// Browsers that block sound until a user gesture unlock it on the first tap/key,
// without requiring a dedicated play control.
function unlockAudioOnInteraction() {
 if(sound.isEnabled()&&!sound.isReady())sound.unlock();
}
window.addEventListener('pointerdown',unlockAudioOnInteraction,{capture:true});
window.addEventListener('keydown',unlockAudioOnInteraction,{capture:true});
window.addEventListener('touchstart',unlockAudioOnInteraction,{capture:true,passive:true});
async function boot(){
 screen='loading';setPlayingUI(false);
 panel('<section class="main-card menu-card"><div class="eyebrow">ARCANA SURVIVOR</div><h2>กำลังโหลดการเดินทาง…</h2></section>','menu-overlay');
 const result=await campaignClient.load();
 if(result.ok){showLobby();return}
 screen='storage-error';
 panel(`<section class="main-card menu-card" role="alert" data-save-error="${result.code}"><h2>เปิดข้อมูลไม่สำเร็จ</h2><p class="muted">${storageMessage(result.code)}</p><p class="muted">ตรวจว่าเบราว์เซอร์อนุญาตให้บันทึกข้อมูลของเว็บไซต์นี้ แล้วลองใหม่</p><button type="button" class="button primary wide" data-action="retry-load">ลองอีกครั้ง</button></section>`,'menu-overlay');
}
boot();
sound.unlock();
requestAnimationFrame(frame);
