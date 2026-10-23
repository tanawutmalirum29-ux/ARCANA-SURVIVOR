"""Capture REAL Orin map gameplay (browser-emulated, NOT physical device).

No engine changes, mocked shot events, injected projectiles, forced victory or
synthetic hero rendering. The only fixture is a VALID high-progress mage save
to survive long enough; the run uses regular UI and keyboard controls.
Compared with scripts/orin_visual_qa.py this captures the actual #scene Canvas.
"""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get("ARCANA_QA_URL", "http://127.0.0.1:4173").rstrip("/")
OUT = Path(os.environ.get("ARCANA_LIVE_ARTIFACTS", "/tmp/orin-live-proof"))
# Portrait and short landscape reproduce the most challenging phone layouts.
SIZES = ((390, 844), (844, 390))
VECTORS = (
    ("E", ("ArrowRight",)),
    ("SE", ("ArrowRight", "ArrowDown")),
    ("S", ("ArrowDown",)),
    ("SW", ("ArrowDown", "ArrowLeft")),
    ("W", ("ArrowLeft",)),
    ("NW", ("ArrowLeft", "ArrowUp")),
    ("N", ("ArrowUp",)),
    ("NE", ("ArrowUp", "ArrowRight")),
)

STORE_FIXTURE = """async () => {
  const [{createCampaignStore, CAMPAIGN_DB, CAMPAIGN_STORE, CAMPAIGN_KEY},
    {validateCampaign}] = await Promise.all([
      import('/src/campaignStore.js'),import('/src/progression/index.js')]);
  const store=createCampaignStore();
  const loaded=await store.load();store.close();
  if(!loaded.ok)throw Error('Campaign read '+loaded.code);
  const state=loaded.state;
  state.profile.runs=30;
  state.progression.mode='resource';
  state.progression.heroId='guardian';
  state.progression.heroes.guardian.level=20;
  state.progression.heroes.guardian.stars=5;
  state.progression.talents.vitality=5;
  state.progression.talents.ward=5;
  state.progression.research.totems=10;
  if(!validateCampaign(state))throw Error('Invalid legal Orin test save');
  await new Promise((resolve,reject)=>{
    const request=indexedDB.open(CAMPAIGN_DB);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction(CAMPAIGN_STORE,'readwrite');
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
      tx.onabort=()=>{db.close();reject(tx.error);};
      tx.objectStore(CAMPAIGN_STORE).put(state,CAMPAIGN_KEY);
    };
  });
  return {heroId:state.progression.heroId,mode:state.progression.mode};
}"""

READ_RUN = """async () => {
  const {createCampaignStore}=await import('/src/campaignStore.js');
  const store=createCampaignStore();
  try {
    const result=await store.load();
    if(!result.ok)throw Error(result.code);
    return result.state.progression.activeRun;
  } finally {store.close();}
}"""

def run_one(browser, engine, width, height):
    folder=OUT/engine/f"{width}x{height}"
    folder.mkdir(parents=True,exist_ok=True)
    context=browser.new_context(
      viewport={"width":width,"height":height},device_scale_factor=1,
      is_mobile=width<1000,has_touch=width<1000,
      record_video_dir=str(folder),
      record_video_size={"width":width,"height":height})
    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda exc:errors.append(str(exc)))
    page.clock.install()
    held=set()
    rows=[]
    video=page.video
    try:
      response=page.goto(URL,wait_until="networkidle")
      assert response and response.status==200,"game entry missing"
      page.locator('[data-action="start"]').wait_for()
      fixture=page.evaluate(STORE_FIXTURE)
      assert fixture=={"heroId":"guardian","mode":"resource"},fixture
      page.reload(wait_until="networkidle")
      page.locator('[data-action="start"]').click()
      expect(page.locator("#overlay")).to_be_hidden()
      expect(page.locator("#hud")).to_be_visible()
      active=page.evaluate(READ_RUN)
      assert active and active["runConfig"]["heroId"]=="guardian",(
          "Actual in-game character not Orin",active)
      assert active["mode"]=="resource"
      start_clock=page.locator("#clock").inner_text()
      scene=page.locator("#scene")
      assert scene.is_visible(),"actual #scene Canvas hidden"
      fingerprints=set()
      for direction,keys in VECTORS:
        desired=set(keys)
        for key in held-desired:page.keyboard.up(key)
        for key in desired-held:page.keyboard.down(key)
        held=desired
        for frame in range(2):
          # Let real requestAnimationFrame, enemies and automatic shots run.
          # This is accelerated elapsed time, not a synthesized render input.
          page.clock.run_for(900)
          if page.locator(".upgrade-option").count():
            page.locator(".upgrade-option").first.click()
          assert not page.locator(".result-card").count(),(
              "Orin died/finished before eight-heading evidence",direction)
          expect(page.locator("#hud")).to_be_visible()
          expect(page.locator("#overlay")).to_be_hidden()
          capture=folder/f"{direction}-{frame}-actual-scene.png"
          scene.screenshot(path=str(capture),timeout=10000)
          digest=hashlib.sha256(capture.read_bytes()).hexdigest()
          fingerprints.add(digest)
          rows.append({"direction":direction,"sample":frame,
               "hud_clock":page.locator("#clock").inner_text(),
               "kills":page.locator("#kill-count").inner_text(),
               "sha256":digest,"screenshot":str(capture)})
      for key in held:page.keyboard.up(key)
      assert len(rows)==16
      assert len(fingerprints)>=8,(
         "Gameplay Canvas did not visibly update across inputs",len(fingerprints))
      assert rows[-1]["hud_clock"]!=start_clock,(
         "Actual simulation clock did not advance",start_clock,rows[-1])
      assert not errors,("Game page error",engine,width,height,errors)
      print("PASS ACTUAL_ORIN_MAP",engine,f"{width}x{height}",
        "16 real #scene frames, normal 8-way keyboard movement",
        "observed_kills",rows[-1]["kills"],flush=True)
      return {"engine":engine,"viewport":f"{width}x{height}",
          "classification":"ACTUAL_BROWSER_GAMEPLAY (valid high-level save fixture)",
          "not_proven":"exact frame of projectile fire, physical mobile device",
          "run_id":active["id"],"start_clock":start_clock,
          "end_clock":rows[-1]["hud_clock"],"samples":rows}
    finally:
      try:
        for key in held:page.keyboard.up(key)
      except Exception:
        pass
      page.close()
      context.close()
      if video:
        try:video.save_as(str(folder/"orin-real-map.webm"))
        except Exception as exc:print("LIVE_VIDEO_UNAVAILABLE",engine,width,height,str(exc))

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    results=[]
    with sync_playwright() as playwright:
      for engine in ("chromium","webkit"):
        browser=getattr(playwright,engine).launch(headless=True)
        try:
          for width,height in SIZES:
            results.append(run_one(browser,engine,width,height))
        finally:
          browser.close()
    path=OUT/"report.json"
    path.write_text(json.dumps(results,ensure_ascii=False,indent=2),
      encoding="utf-8")
    print("LIVE ASTRa report",path)
    print("PHYSICAL_MOBILE / EXACT_SHOT_FRAME: NOT_RUN / NOT_PROVEN")

if __name__=="__main__":
    main()
