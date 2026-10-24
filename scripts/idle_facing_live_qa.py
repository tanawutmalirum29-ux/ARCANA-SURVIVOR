"""Real Engine + real Canvas acceptance for stationary weapon facing.

Each capture comes from createGame -> spawnEnemy -> step -> drawScene using
actual source modules in Chromium/WebKit; only encounter positions are
controlled. Not a stock actor sprite sheet or physical-device hardware QA.
"""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('ARCANA_QA_URL','http://127.0.0.1:4173').rstrip('/')
ROOT=Path(os.environ.get('ARCANA_IDLE_FACING_ARTIFACTS','/tmp/idle-facing-proof'))
SIZES=((320,568),(390,844),(768,1024),(844,390),(1440,900))
HEADINGS=(('E',1,0),('SE',1,1),('S',0,1),('SW',-1,1),
          ('W',-1,0),('NW',-1,-1),('N',0,-1),('NE',1,-1))
HEROES=('mage','guardian','ranger')
INIT=r"""async () => {
 const [{createGame,spawnEnemy,step,getLastPlayerFireEvent},
  {drawScene},{defaultProfile}] = await Promise.all([
   import('/src/engine.js'),import('/src/render.js'),
   import('/src/storage.js')]);
 window.__qaModules={createGame,spawnEnemy,step,getLastPlayerFireEvent,drawScene,defaultProfile};
 const canvas=document.createElement('canvas');
 canvas.id='scene';canvas.style.cssText='display:block;width:100vw;height:100vh';
 document.body.replaceChildren(canvas);
 document.documentElement.style.cssText='margin:0;padding:0;overflow:hidden';
 document.body.style.cssText='margin:0;padding:0;overflow:hidden';
 window.__ARCANA_IDLE_FACING_QA_FRAME__=(event)=>window.__actualFacing=event;
 return {width:canvas.getBoundingClientRect().width,height:canvas.getBoundingClientRect().height};
}"""
SCENE=r"""({heroId,heading,x,y,variant}) => {
 const {createGame,spawnEnemy,step,getLastPlayerFireEvent,drawScene,defaultProfile}=window.__qaModules;
 const canvas=document.getElementById('scene'),context=canvas.getContext('2d');
 const game=createGame(97531,{heroId,mode:'campaign',
  stats:{maxHp:300,attack:35,fireDelay:24}});
 game.timers.spawn=999999;
 const distance=heroId==='guardian'?65:variant==='dead-target'?75:190;
 let dx=x,dy=y;
 if(variant==='opposed-walk'){dx=-1;dy=0;}
 const norm=Math.hypot(dx,dy);
 const e=spawnEnemy(game,'brute',
  game.player.x+dx/norm*distance,game.player.y+dy/norm*distance);
 e.speed=0;e.shotTimer=999999;e.hp=e.maxHp=10000;
 if(variant==='dead-target'){e.hp=1;}
 game.player.fireTimer=0;
 const oldX=game.player.x,oldY=game.player.y;
 step(game,variant==='opposed-walk'?{x:1,y:0}:{x:0,y:0});
 const event=getLastPlayerFireEvent(game);
 if (!event||event.tick!==game.tick)throw Error('No REAL engine attack '+heroId+'/'+heading+'/'+variant);
 let movement={x:game.player.x-oldX,y:game.player.y-oldY};
 if(variant==='dead-target'){
  // The arrow/staff bolt travels for several legitimate fixed ticks before
  // collision, unlike sword melee. Do not fake death or skip projectile physics.
  for(let i=0;e.hp>0 && i<30;i++) step(game,{x:0,y:0});
  if(e.hp!==0)throw Error('Actual engine shot did not kill target '+heroId);
  movement={x:0,y:0};
 }
 const visual={appearance:{heroId},movement,
  fireEvent:getLastPlayerFireEvent(game)};
 const player=game.player;
 window.__actualFacing=null;
 drawScene(canvas,context,game,defaultProfile(),game.tick/60,visual);
 const frame=window.__actualFacing;
 if(!frame?.realEngine||!frame.hasRig)throw Error('No actual canonical game sprite '+heroId);
 const expected=(variant==='opposed-walk')?'E':heading;
 if(frame.direction8!==expected)throw Error('wrong body facing '+heroId+'/'+heading+'/'+variant+' '+frame.direction8+' expected '+expected);
 if(frame.moving!==(variant==='opposed-walk'))throw Error('wrong locomotion '+heroId+'/'+variant);
 if(frame.attackDirection8!==(variant==='opposed-walk'?'W':heading))
  throw Error('wrong weapon aim '+heroId+'/'+heading+'/'+variant+' '+frame.attackDirection8);
 if(frame.backView!==['N','NE','NW'].includes(expected))
  throw Error('wrong rear face '+heroId+'/'+heading+'/'+variant);
 if(frame.confirmedFireTick!==event.tick)throw Error('lost real engine fire '+heroId);
 if(variant==='dead-target' && frame.targetPresent)throw Error('dead enemy still targeted');
 if(variant!=='dead-target' && !frame.targetPresent)throw Error('live enemy missed');
 if(variant==='dead-target' && game.enemies.some(e=>e.hp>0))throw Error('fake target remains');
 if(!canvas.width||!canvas.height)throw Error('scene canvas empty');
 return {...frame,variant,expected,distance,engineShotId:event.shotId,
   deadEnemyConfirmed:variant==='dead-target' ? e.hp===0 : null,
   liveEnemyHP:e.hp,player:{x:player.x,y:player.y}};
}"""

def capture(page,folder,name,details):
  target=folder/f'{name}.png'
  assert not target.exists(),('SCREENSHOT_OVERWRITE',str(target))
  page.locator('#scene').screenshot(path=str(target),timeout=20000)
  data=target.read_bytes()
  assert data.startswith(b'\x89PNG\r\n\x1a\n')
  return {'filename':str(target),'sha256':hashlib.sha256(data).hexdigest(),'evidence':details}

def run_one(browser,engine,w,h):
 folder=ROOT/engine/f'{w}x{h}'
 folder.mkdir(parents=True,exist_ok=True)
 context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,
   is_mobile=w<1000,has_touch=w<1000)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 proof=[]
 try:
  response=page.goto(URL+'/tests/characters/visual/preview.html',wait_until='networkidle')
  assert response and response.status==200
  size=page.evaluate(INIT)
  assert round(size['width'])==w and round(size['height'])==h,size
  for hero in HEROES:
   for direction,x,y in HEADINGS:
    frame=page.evaluate(SCENE,{'heroId':hero,'heading':direction,'x':x,'y':y,'variant':'idle-attack'})
    proof.append(capture(page,folder,f'{hero}-{direction}-idle-attack',frame))
   # A real step east while shooting a target behind, without mirroring the legs.
   frame=page.evaluate(SCENE,{'heroId':hero,'heading':'W','x':-1,'y':0,'variant':'opposed-walk'})
   proof.append(capture(page,folder,f'{hero}-walk-east-shoot-west',frame))
   frame=page.evaluate(SCENE,{'heroId':hero,'heading':'NW','x':-1,'y':-1,'variant':'dead-target'})
   proof.append(capture(page,folder,f'{hero}-dead-target-keep-NW',frame))
  assert len(proof)==30 and len(set(s['filename'] for s in proof))==30
  assert not errors,('PAGE_ERRORS',engine,w,h,errors)
  print('PASS REAL_ENGINE_IDLE_8WAY',engine,f'{w}x{h}',
      '24 actual eight-direction attacks + 3 opposed walks + 3 post-kill rear poses',flush=True)
  return {'engine':engine,'viewport':f'{w}x{h}','proof':proof,
    'kind':'REAL_ENGINE_STEP_AND_CANONICAL_GAME_CANVAS',
    'setup':'Controlled encounter directions; real engine shots and real render; not a live player-controlled run',
    'hardware':'BROWSER_EMULATION_ONLY'}
 finally:
  page.close();context.close()

def main():
 results=[]
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   browser=getattr(pw,engine).launch(headless=True)
   try:
    for w,h in SIZES:results.append(run_one(browser,engine,w,h))
   finally:browser.close()
 assert len(results)==10
 screenshots=[s for r in results for s in r['proof']]
 assert len(screenshots)==300
 paths=[Path(s['filename']) for s in screenshots]
 assert len(set(paths))==300
 for item,path in zip(screenshots,paths):
  raw=path.read_bytes()
  assert raw.startswith(b'\x89PNG\r\n\x1a\n')
  assert hashlib.sha256(raw).hexdigest()==item['sha256'],('HASH_MISMATCH',str(path))
 assert set(ROOT.rglob('*.png'))==set(paths)
 (ROOT/'report.json').write_text(json.dumps(
    {'runs':results,'evidence_count':300,'checksum_passed':300,
     'classification':'REAL_GAME_ENGINE_AND_CANVAS_WITH_CONTROLLED_ENCOUNTERS',
     'physical_device':'NOT_TESTED'},ensure_ascii=False,indent=2),
   encoding='utf-8')
 print('PASS REAL_IDLE_8WAY_EVIDENCE 300/300 SHA-256, 300 UNIQUE PNG, 3 HEROES x 8 DIRECTIONS x 10 BROWSER/VIEWPORT RUNS',flush=True)

if __name__=='__main__':main()
