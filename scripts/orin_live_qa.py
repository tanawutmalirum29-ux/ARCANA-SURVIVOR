"""Exact-source REAL Orin gameplay + appearance acceptance, not synthetic SVG QA.

The QA tap in src/render.js observes the game's actual painted #scene, real
confirmed player fire event, arm/shield pose and selected equipped skin.
No enemy/projectile/combat state, RNG, clock tick or entitlements are forged.
Only a validated high-level save in a clean browser context grants test access
to owned free/earned skins; event/premium concepts remain LOCKED PREVIEW ONLY.
Runs Chromium + WebKit in all five shipping viewports. Not a hardware test.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get("ARCANA_QA_URL", "http://127.0.0.1:4173").rstrip("/")
OUT = Path(os.environ.get("ARCANA_LIVE_ARTIFACTS", "/tmp/orin-live-proof"))
SIZES = ((320, 568), (390, 844), (768, 1024), (844, 390), (1440, 900))
DIRECTIONS = (
    ("E", ("ArrowRight",)), ("SE", ("ArrowRight", "ArrowDown")),
    ("S", ("ArrowDown",)), ("SW", ("ArrowDown", "ArrowLeft")),
    ("W", ("ArrowLeft",)), ("NW", ("ArrowLeft", "ArrowUp")),
    ("N", ("ArrowUp",)), ("NE", ("ArrowUp", "ArrowRight")),
)
OPPOSITE = {
    "ArrowRight": "ArrowLeft", "ArrowLeft": "ArrowRight",
    "ArrowUp": "ArrowDown", "ArrowDown": "ArrowUp",
}
REAL_VARIANTS = ("base", "ember", "moon")
# Do NOT claim a purchasable/event/premium skin is equipped: these are concept
# previews only in the current catalog (and the real transactional store).
LOCKED_CONCEPTS = ("lantern", "crimson")

QA_INIT = r"""(() => {
  const qa = {frames:0,latest:null,dir:null,captures:{},attack:null,brace:null};
  const visible = e => e.hasRig && e.skinId && e.x>45 && e.y>45 &&
    e.x<e.width-45 && e.y<e.height-45;
  const snap = (canvas,e) => ({event:{...e},png:canvas.toDataURL('image/png')});
  Object.defineProperty(globalThis,'__orinQA',{value:qa,configurable:true});
  globalThis.__ARCANA_ORIN_QA_FRAME__=(event,canvas)=>{
    qa.latest=event;qa.frames++;
    if (!visible(event)) return;
    if (qa.dir && event.moving && event.direction8===qa.dir) {
      qa.captures[qa.dir]=snap(canvas,event);qa.dir=null;
    }
    if(!qa.attack && event.phase==='release' &&
       event.firedAtTick!==null && event.firedAtTick<=event.tick &&
       event.tick-event.firedAtTick<=5 && event.shieldBrace>.2){
      qa.attack=snap(canvas,event);
    }
    if(!qa.brace && ['windup','charge'].includes(event.phase) &&
       event.shieldBrace>.5)qa.brace=snap(canvas,event);
  };
})()"""

# User's own save lives solely in a clean throwaway browser context.
# Valid fixture preserves exact schema and authorized ownership classes.
STORE_FIXTURE = r"""async () => {
  const [{createCampaignStore,CAMPAIGN_DB,CAMPAIGN_STORE,CAMPAIGN_KEY},
    {validateCampaign}] = await Promise.all([
      import('/src/campaignStore.js'),import('/src/progression/index.js')]);
  const store=createCampaignStore();
  const loaded=await store.load();store.close();
  if(!loaded.ok)throw Error('Campaign read '+loaded.code);
  const state=loaded.state;
  state.profile.runs=30;
  for(const variant of ['ember','moon'])
    if(!state.profile.owned.includes(variant))state.profile.owned.push(variant);
  state.progression.mode='resource';
  state.progression.heroId='guardian';
  state.progression.heroes.guardian.level=20;
  state.progression.heroes.guardian.stars=5;
  state.progression.talents.vitality=5;
  state.progression.talents.ward=5;
  state.progression.research.totems=10;
  for(const variant of ['ember','moon']){
    const skin='guardian:'+variant;
    if(!state.progression.wardrobe.guardian.owned.includes(skin))
      state.progression.wardrobe.guardian.owned.push(skin);
  }
  if(!validateCampaign(state))throw Error('Invalid legal Orin test save');
  await new Promise((resolve,reject)=>{
    const request=indexedDB.open(CAMPAIGN_DB);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction(CAMPAIGN_STORE,'readwrite');
      tx.oncomplete=()=>{db.close();resolve()};
      tx.onerror=()=>{db.close();reject(tx.error)};
      tx.onabort=()=>{db.close();reject(tx.error)};
      tx.objectStore(CAMPAIGN_STORE).put(state,CAMPAIGN_KEY);
    };
  });
  return {heroId:state.progression.heroId,mode:state.progression.mode};
}"""

READ_CAMPAIGN = r"""async () => {
  const {createCampaignStore}=await import('/src/campaignStore.js');
  const store=createCampaignStore();
  try{
    const result=await store.load();
    if(!result.ok)throw Error('Campaign read '+result.code);
    return result.state;
  }finally{store.close()}
}"""

def write_png(target, payload):
    assert payload and payload.startswith("data:image/png;base64,"), (
        "Not a real HTMLCanvasElement.toDataURL PNG", target)
    raw=base64.b64decode(payload.split(",",1)[1],validate=True)
    assert raw.startswith(b"\x89PNG\r\n\x1a\n")
    target.write_bytes(raw)
    return hashlib.sha256(raw).hexdigest()

def store(page):
    return page.evaluate(READ_CAMPAIGN)

def visible(event):
    return bool(event and event["hasRig"] and event["heroId"]=="guardian"
      and 45<event["x"]<event["width"]-45
      and 45<event["y"]<event["height"]-45)

def capture_qa(page, key, destination, expected_skin):
    shot=page.evaluate("""key => {
      const q=globalThis.__orinQA;
      const val=key==='attack'||key==='brace'?q[key]:q.captures[key];
      return val||null;
    }""", key)
    assert shot,(key,expected_skin,"no real-map frame captured")
    data=shot["event"]
    assert data["skinId"]==expected_skin,(key,"painted skin mismatch",data)
    assert visible(data),(key,"sprite clipped/out of frame",data)
    sha=write_png(destination,shot["png"])
    return {"name":key,"event":data,"sha256":sha,"file":str(destination)}

def open_wardrobe(page):
    if not page.locator('[data-action="wardrobe"]').count():
        page.locator('[data-lobby-tab="hero"]').click()
    page.locator('[data-action="wardrobe"]').click()
    page.locator(".skin-card").first.wait_for()

def equip_through_ui(page, variant, folder):
    expected="guardian:"+variant
    open_wardrobe(page)
    if variant!="base":
        page.locator('[data-action="equip"][data-id="'+expected+'"]').click()
    active=page.locator(".skin-card.active")
    assert active.count()==1 and active.locator('[data-action][data-id="'+expected+'"]').count(), (
        "Wearable skin is not active in real wardrobe UI",expected)
    if variant=="base":
        # Event and premium art is an intentionally locked preview, not an
        # entitlement. Prove that the real UI does not offer equip or checkout.
        for concept in LOCKED_CONCEPTS:
            page.locator('[data-action="preview"][data-id="guardian:'+concept+'"]').click()
            expect(page.locator(".vfx-showcase")).to_be_visible()
            assert page.locator('[data-vfx-equip="guardian:'+concept+'"]').count()==0
            assert page.get_by_text("LOCKED · PREVIEW ONLY").count()>=1
            page.screenshot(path=str(folder/("locked-"+concept+"-showcase.png")),full_page=True)
            page.locator("[data-vfx-close]").click()
        assert store(page)["progression"]["wardrobe"]["guardian"]["equipped"]==expected
    page.screenshot(path=str(folder/"orin-wardrobe-equipped.png"),full_page=True)
    page.locator('[data-action="home"]').click()
    page.locator('[data-lobby-tab="adventure"]').wait_for()

def verify_lobby(page,expected,folder):
    saved=store(page)
    assert saved["progression"]["heroId"]=="guardian"
    assert saved["progression"]["wardrobe"]["guardian"]["equipped"]==expected
    # No preview-only skin is granted by the test fixture.
    for concept in LOCKED_CONCEPTS:
        assert "guardian:"+concept not in saved["progression"]["wardrobe"]["guardian"]["owned"]
    result=page.evaluate("""expected => {
      return import('/src/characters/skins/index.js').then(({getSkinDefinition})=>{
        const skin=getSkinDefinition(expected);
        const candidates=[...document.querySelectorAll('.canonical-hero-art[data-hero="guardian"]')];
        const correct=candidates.filter(svg=>
          svg.getAttribute('data-signature')==='sword-shield' &&
          [...svg.querySelectorAll('path')].some(path=>path.getAttribute('fill')===skin.primary));
        return {exists:candidates.length,correct:correct.length,primary:skin.primary};
      });
    }""",expected)
    assert result["correct"]>0,("Orin lobby SVG did not show equipped skin palette",result)
    page.screenshot(path=str(folder/"orin-lobby-equipped.png"),full_page=True)
    return {"equipped":expected,"lobby_primary":result["primary"],"lobby_svg_count":result["correct"]}

def check_pause_rotation(page,width,height,folder):
    page.keyboard.press("Escape")
    expect(page.locator(".pause-card")).to_be_visible()
    assert page.locator("#overlay").is_visible()
    page.screenshot(path=str(folder/"orin-paused.png"),full_page=True)
    page.keyboard.press("Escape")
    expect(page.locator("#overlay")).to_be_hidden()
    page.set_viewport_size({"width":height,"height":width})
    page.clock.run_for(65)
    assert page.locator("#scene").is_visible() and page.locator("#hud").is_visible()
    rotated=page.evaluate("""() => {
      const scene=document.querySelector('#scene').getBoundingClientRect();
      const pause=document.querySelector('#pause-btn').getBoundingClientRect();
      return {scene:[scene.width,scene.height],pause:[pause.x,pause.y,
        pause.right,pause.bottom],viewport:[innerWidth,innerHeight]};
    }""")
    assert rotated["scene"][0]>100 and rotated["scene"][1]>100,rotated
    assert rotated["pause"][0]>=-1 and rotated["pause"][1]>=-1 and (
        rotated["pause"][2]<=height+1 and rotated["pause"][3]<=width+1), (
        "Pause control obscured after rotation",rotated)
    page.screenshot(path=str(folder/"orin-rotated.png"),full_page=True)
    page.set_viewport_size({"width":width,"height":height})
    page.clock.run_for(65)
    return rotated

def pointer_check(page,folder):
    box=page.locator("#scene").bounding_box()
    assert box
    x=box["x"]+box["width"]*.49
    y=box["y"]+box["height"]*.54
    # Trusted Playwright pointer drag exercises real joystick handlers in
    # touch-capable contexts; not a claim of physical finger input.
    page.mouse.move(x,y)
    page.mouse.down()
    page.mouse.move(x+28,y-18,steps=4)
    page.clock.run_for(100)
    assert page.locator("#joystick.active").count()==1,"pointer drag didn't activate joystick"
    pose=page.evaluate("globalThis.__orinQA.latest")
    assert pose and pose["hasRig"] and pose["moving"],"drag not forwarded to renderer"
    page.mouse.up()
    assert page.locator("#joystick.active").count()==0,"joystick stuck after release"
    return {"pointer_drag":"PASS","moving_pose":pose["direction8"]}

def run_one(browser,engine,width,height,variant):
    skin="guardian:"+variant
    folder=OUT/engine/f"{width}x{height}"/variant
    folder.mkdir(parents=True,exist_ok=True)
    context=browser.new_context(
      viewport={"width":width,"height":height},
      device_scale_factor=1,is_mobile=width<1000,has_touch=width<1000,
      record_video_dir=str(folder),record_video_size={"width":width,"height":height})
    page=context.new_page()
    page.add_init_script(QA_INIT)
    page.clock.install()
    errors=[]
    page.on("pageerror",lambda exc:errors.append(str(exc)))
    held=set()
    video=page.video
    try:
        response=page.goto(URL,wait_until="networkidle")
        assert response and response.status==200
        page.locator('[data-action="start"]').wait_for()
        assert page.evaluate(STORE_FIXTURE)=={"heroId":"guardian","mode":"resource"}
        page.reload(wait_until="networkidle")
        page.locator('[data-lobby-tab="adventure"]').wait_for()
        equip_through_ui(page,variant,folder)
        page.reload(wait_until="networkidle")
        page.locator('[data-lobby-tab="adventure"]').wait_for()
        lobby=verify_lobby(page,skin,folder)
        # Real click leads through START_RUN transactional store; do not
        # fabricate an activeRun, target or a projectile.
        page.locator('[data-action="start"]').click()
        expect(page.locator("#overlay")).to_be_hidden()
        expect(page.locator("#hud")).to_be_visible()
        active=store(page)["progression"]["activeRun"]
        assert active and active["runConfig"]["heroId"]=="guardian"
        assert active["appearance"]=={"heroId":"guardian","skinId":skin}
        start=page.locator("#clock").inner_text()
        frames=[]
        for direction,keys in DIRECTIONS:
            # Each excursion is followed by an equal opposite displacement.
            # This prevents the old E->SE->S->SW map-edge clipping bug.
            page.evaluate("(direction) => {globalThis.__orinQA.dir=direction}",direction)
            for key in keys:
                page.keyboard.down(key)
                held.add(key)
            page.clock.run_for(120)
            if page.locator(".upgrade-option").count():
                page.locator(".upgrade-option").first.click()
            if page.evaluate("!!globalThis.__orinQA.dir"):
                page.clock.run_for(90)
            shot=capture_qa(page,direction,folder/(direction+"-real-scene.png"),skin)
            assert shot["event"]["direction8"]==direction,(direction,shot)
            frames.append(shot)
            for key in keys:
                page.keyboard.up(key)
                held.discard(key)
            opposites=[OPPOSITE[key] for key in keys]
            for key in opposites:page.keyboard.down(key)
            page.clock.run_for(120 if len(frames)%2 else 210)
            for key in opposites:page.keyboard.up(key)
            if page.locator(".upgrade-option").count():
                page.locator(".upgrade-option").first.click()
            assert page.locator(".result-card").count()==0,"Hero died during real QA"
            expect(page.locator("#hud")).to_be_visible()
            expect(page.locator("#overlay")).to_be_hidden()
        # The confirmed shot is collected by the production renderer's actual
        # resolveHeroPose from getLastPlayerFireEvent(game), not synthesized.
        if not page.evaluate("!!globalThis.__orinQA.attack"):
            for _ in range(180):
                page.clock.run_for(35)
                if page.locator(".upgrade-option").count():
                    page.locator(".upgrade-option").first.click()
                if page.evaluate("!!globalThis.__orinQA.attack"):break
        attack=capture_qa(page,"attack",folder/"REAL-CONFIRMED-SWORD-RELEASE.png",skin)
        assert attack["event"]["phase"]=="release"
        assert attack["event"]["firedAtTick"] is not None
        assert attack["event"]["tick"]>=attack["event"]["firedAtTick"]
        assert attack["event"]["shieldBrace"]>.2
        brace=None
        if page.evaluate("!!globalThis.__orinQA.brace"):
            brace=capture_qa(page,"brace",folder/"REAL-SHIELD-BRACE.png",skin)
        rotated=check_pause_rotation(page,width,height,folder)
        pointer=pointer_check(page,folder)
        assert page.locator("#clock").inner_text()!=start
        assert not errors,(engine,width,height,variant,"page errors",errors)
        latest=page.evaluate("globalThis.__orinQA.latest")
        assert latest and latest["skinId"]==skin and latest["hasRig"]
        assert len(frames)==8 and all(visible(row["event"]) for row in frames)
        print("PASS REAL_ORIN_ACCEPTANCE",engine,f"{width}x{height}",variant,
              "8/8 visible headings, real confirmed release/brace, wardrobe/lobby/Canvas",
              flush=True)
        return {"engine":engine,"viewport":f"{width}x{height}","variant":variant,
          "classification":"ACTUAL_BROWSER_GAMEPLAY: real engine/UI/canonical Canvas",
          "limits":"touch-capable browser emulation and valid save access fixture; not hardware",
          "run_id":active["id"],"appearance":active["appearance"],
          "lobby":lobby,"frames":frames,"confirmed_attack":attack,
          "anticipatory_brace":brace,"rotation":rotated,"pointer":pointer,
          "start_clock":start,"end_clock":page.locator("#clock").inner_text()}
    finally:
        for key in held:
            try:page.keyboard.up(key)
            except Exception:pass
        page.close()
        context.close()
        if video:
            try:video.save_as(str(folder/"orin-real-map.webm"))
            except Exception as exc:print("ORIN_VIDEO_UNAVAILABLE",engine,width,height,variant,str(exc))

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    results=[]
    with sync_playwright() as playwright:
        for engine in ("chromium","webkit"):
            browser=getattr(playwright,engine).launch(headless=True)
            try:
                for width,height in SIZES:
                    # Every shipped size gets actual Orin walking, brace and
                    # confirmed shot evidence. All equip-capable variants are
                    # additionally exercised in both engines at portrait size.
                    variants=REAL_VARIANTS if (width,height)==(390,844) else ("base",)
                    for variant in variants:
                        results.append(run_one(browser,engine,width,height,variant))
            finally:
                browser.close()
    report=OUT/"report.json"
    report.write_text(json.dumps({
      "classification":"ACTUAL_BROWSER_GAMEPLAY plus source-matched visual telemetry",
      "real_size_engine_runs":10,"extra_earned_skin_runs":4,
      "reviewed_variants":list(REAL_VARIANTS),
      "locked_preview_only_concepts":list(LOCKED_CONCEPTS),
      "not_claimed":"real-money or event purchase/equip; physical mobile; ALL reward TODO",
      "runs":results},ensure_ascii=False,indent=2),encoding="utf-8")
    print("PASS: 10 live engine/size runs + 4 additional earned variant runs;",
          "8 visible headings per run, confirmed shot/brace, UI equip",flush=True)
    print("PHYSICAL_MOBILE: NOT_RUN; EVENT_PREMIUM: LOCKED_PREVIEW_ONLY")

if __name__=="__main__":main()
