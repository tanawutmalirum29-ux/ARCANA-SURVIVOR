"""Actual production Engine -> drawScene Canvas walking-motion QA, with OS reduced motion ON.

Use real Chromium and WebKit across five shipping viewports; capture cropped,
unmodified production Canvas pixels for Astra, Orin, and Lyra at distinct real
simulation ticks. Controlled input/encounters (not physical-device QA).
"""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("ARCANA_QA_URL", "http://127.0.0.1:4173").rstrip("/")
ROOT = Path(os.environ.get("ARCANA_WALK_MOTION_ARTIFACTS", "/tmp/walk-motion-proof"))
SIZES = ((320,568),(390,844),(768,1024),(844,390),(1440,900))
HEROES = ("mage","guardian","ranger")
MODES = ("fresh","legacy-unset","explicit-off-persisted","explicit-on")
INIT = r"""async () => {
  const [engine, renderer, storage, visuals] = await Promise.all([
    import('/src/engine.js'), import('/src/render.js'),
    import('/src/storage.js'), import('/src/visual/presentation.js')
  ]);
  window.__walkQa = {...engine, ...renderer, ...storage, ...visuals};
  document.documentElement.style.cssText='margin:0;overflow:hidden';
  document.body.style.cssText='margin:0;overflow:hidden';
  const canvas=document.createElement('canvas');
  canvas.id='walk-production-canvas';
  canvas.style.cssText='width:100vw;height:100vh;display:block';
  document.body.replaceChildren(canvas);
  window.__ARCANA_IDLE_FACING_QA_FRAME__ = frame => {window.__realWalkFrame=frame;};
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
    throw Error('OS reduced-motion emulation not active');
  return {width:canvas.getBoundingClientRect().width,
          height:canvas.getBoundingClientRect().height};
}"""
FRAME = r"""({heroId,mode,ticks,opposed=false}) => {
  const {createGame,spawnEnemy,step,getLastPlayerFireEvent,drawScene,
         defaultProfile,sanitizeProfile,saveProfile,loadProfile,
         resolveReducedMotion,SAVE_KEY} = window.__walkQa;
  const canvas=document.getElementById('walk-production-canvas');
  const ctx=canvas.getContext('2d');
  let profile;
  if(mode==='fresh') {
    profile=defaultProfile();
  } else if(mode==='legacy-unset') {
    profile=sanitizeProfile({...defaultProfile(),settings:{vfx:'high'}});
  } else if(mode==='explicit-off-persisted') {
    const p=defaultProfile();p.settings.reduceMotion=false;
    localStorage.removeItem(SAVE_KEY);
    if(!saveProfile(p,localStorage)) throw Error('persist OFF failed');
    profile=loadProfile(localStorage);
    if(profile.settings.reduceMotion!==false) throw Error('reload OFF failed');
  } else if(mode==='explicit-on') {
    profile=defaultProfile();profile.settings.reduceMotion=true;
  } else throw Error('Invalid mode: '+mode);
  const expectReduced=mode==='explicit-on';
  if(resolveReducedMotion(profile.settings)!==expectReduced)
    throw Error('Resolved motion setting incorrect for '+mode);
  const game=createGame(13579,{heroId,mode:'campaign',
    stats:{maxHp:300,attack:35,fireDelay:24}});
  game.timers.spawn=999999;
  let expectedShot=null;
  if(opposed) {
    const enemy=spawnEnemy(game,'brute',game.player.x-(heroId==='guardian'?65:190),game.player.y);
    enemy.hp=enemy.maxHp=10000;enemy.speed=0;enemy.shotTimer=999999;
    game.player.fireTimer=0;
  }
  let movement={x:0,y:0};
  const before={x:game.player.x,y:game.player.y};
  for(let i=0;i<ticks;i++){
    const previous={x:game.player.x,y:game.player.y};
    step(game,{x:1,y:0});
    movement={x:game.player.x-previous.x,y:game.player.y-previous.y};
    if(opposed && i===0) expectedShot=getLastPlayerFireEvent(game);
  }
  if(opposed && (!expectedShot || expectedShot.tick!==1))
    throw Error('Real engine attack missing '+heroId);
  const fire=getLastPlayerFireEvent(game);
  window.__realWalkFrame=null;
  drawScene(canvas,ctx,game,profile,0,{
    appearance:{heroId},movement,fireEvent:fire
  });
  const frame=window.__realWalkFrame;
  if(!frame?.realEngine || !frame.hasRig || !frame.moving)
    throw Error('Production engine/Canvas locomotion missing: '+heroId+'/'+mode);
  if(frame.reducedMotion!==expectReduced)
    throw Error('Actual drawScene motion setting mismatch: '+heroId+'/'+mode);
  if(frame.direction8!=='E' || frame.travelDirection8!=='E')
    throw Error('Walking silhouette direction incorrect: '+heroId+'/'+mode);
  if(!frame.walkJoints?.leftLeg || !frame.walkJoints?.rightLeg)
    throw Error('Real renderer did not expose walk joints');
  if(game.player.x<=before.x)
    throw Error('Physical engine movement missing');
  if(opposed && frame.attackDirection8!=='W')
    throw Error('Attack must point west while player moves east: '+heroId);
  const w=canvas.width,h=canvas.height;
  const cx=Math.floor(w/2),cy=Math.floor(h/2);
  const bytes=ctx.getImageData(cx-32,cy-42,64,84).data;
  let hash=2166136261;
  for(let i=0;i<bytes.length;i+=4){
    hash=Math.imul(hash^bytes[i],16777619);
    hash=Math.imul(hash^bytes[i+1],16777619);
    hash=Math.imul(hash^bytes[i+2],16777619);
    hash=Math.imul(hash^bytes[i+3],16777619);
  }
  return {heroId,mode,ticks,opposed,osReduced:true,
    profileValue:profile.settings.reduceMotion,
    effectiveReduced:frame.reducedMotion,playerDelta:game.player.x-before.x,
    direction:frame.direction8,attackDirection:frame.attackDirection8,
    confirmedFireTick:fire?.tick??null,
    joints:frame.walkJoints,pixelHash:hash>>>0,
    kind:'REAL_ENGINE_AND_PRODUCTION_DRAWSCENE_CANVAS'};
}"""

def capture(page, folder, name, metadata, width, height):
    dest=folder/(name+".png")
    assert not dest.exists(), ("DUPLICATE",str(dest))
    # Crop only the real Canvas actor, not a synthetic sprite or HTML preview.
    page.screenshot(path=str(dest),clip={"x":width/2-48,"y":height/2-56,
                                        "width":96,"height":112})
    data=dest.read_bytes()
    assert data.startswith(b'\x89PNG\r\n\x1a\n'), str(dest)
    return {"filename":str(dest),"sha256":hashlib.sha256(data).hexdigest(),
            "frame":metadata}

def one(browser, engine, width, height):
    folder=ROOT/engine/(str(width)+"x"+str(height))
    folder.mkdir(parents=True,exist_ok=True)
    context=browser.new_context(viewport={"width":width,"height":height},
        device_scale_factor=1,has_touch=width<1000,is_mobile=width<1000)
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda error: errors.append(str(error)))
    try:
        page.emulate_media(reduced_motion="reduce")
        response=page.goto(URL+"/tests/characters/visual/preview.html",wait_until="networkidle")
        assert response and response.status==200
        size=page.evaluate(INIT)
        assert round(size["width"])==width and round(size["height"])==height,size
        images=[]
        for hero in HEROES:
            for mode in MODES:
                first=page.evaluate(FRAME,{"heroId":hero,"mode":mode,"ticks":10})
                images.append(capture(page,folder,hero+"-"+mode+"-t10",first,width,height))
                second=page.evaluate(FRAME,{"heroId":hero,"mode":mode,"ticks":17})
                images.append(capture(page,folder,hero+"-"+mode+"-t17",second,width,height))
                same=first["joints"]["leftLeg"]==second["joints"]["leftLeg"]
                if mode=="explicit-on":
                    assert same,(engine,width,height,hero,"Reduce Motion ON did not freeze gait")
                else:
                    assert not same,(engine,width,height,hero,mode,"walking joint never changed")
                    assert first["pixelHash"]!=second["pixelHash"],(
                        engine,width,height,hero,mode,"real Canvas pixels did not animate")
            for mode in ("explicit-off-persisted","explicit-on"):
                shot=page.evaluate(FRAME,{"heroId":hero,"mode":mode,"ticks":1,"opposed":True})
                assert shot["attackDirection"]=="W",shot
                assert shot["direction"]=="E",shot
                assert shot["confirmedFireTick"]==1,shot
                images.append(capture(page,folder,hero+"-"+mode+"-walk-east-shoot-west",shot,width,height))
        assert len(images)==30,(engine,width,height,len(images))
        assert not errors,(engine,width,height,errors)
        print("PASS REAL_WALK_OS_REDUCE",engine,str(width)+"x"+str(height),
            "3 heroes, 30 real Canvas crop PNGs, fresh/legacy/explicit OFF/ON/opposed shot",
            flush=True)
        return {"engine":engine,"viewport":str(width)+"x"+str(height),
                "images":images,"kind":"ACTUAL_PRODUCTION_CANVAS_CONTROLLED_ENGINE",
                "os_reduced_motion":True,"physical_device":"NOT_TESTED"}
    finally:
        page.close()
        context.close()

def main():
    results=[]
    with sync_playwright() as playwright:
        for engine in ("chromium","webkit"):
            browser=getattr(playwright,engine).launch(headless=True)
            try:
                for width,height in SIZES:
                    results.append(one(browser,engine,width,height))
            finally:
                browser.close()
    items=[item for result in results for item in result["images"]]
    assert len(results)==10 and len(items)==300
    paths=[Path(item["filename"]) for item in items]
    assert len(set(paths))==300
    for item,path in zip(items,paths):
        assert hashlib.sha256(path.read_bytes()).hexdigest()==item["sha256"]
    assert set(ROOT.rglob("*.png"))==set(paths)
    ROOT.mkdir(parents=True,exist_ok=True)
    (ROOT/"report.json").write_text(json.dumps({
        "runs":results,"png_count":300,"verified_sha256":300,
        "os_setting":"prefers-reduced-motion: reduce",
        "game_default":"Reduce Motion OFF overrides OS; existing saves remain Boolean",
        "proof":"real fixed-tick engine + production drawScene Canvas and motion observer",
        "physical_device":"NOT_TESTED"},ensure_ascii=False,indent=2),encoding="utf-8")
    print("PASS REAL_WALK_OS_REDUCE 300/300 PNG SHA256, 10 browser/viewport combinations",flush=True)

if __name__=="__main__":
    main()
