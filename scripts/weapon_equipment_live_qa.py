"""QA_BLOCK #2: real responsive lobby equipment UI and persisted cross-hero weapon rules.

This is browser UI + real IndexedDB transaction evidence, not a domain-only
simulation. The ONLY fixture is a valid owned/unlocked/craftable inventory.
All switch/equip commands are clicked via the production DOM and committed
through the ordinary campaign store. Does not assert any earned drop.
"""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL=os.environ.get("ARCANA_QA_URL","http://127.0.0.1:4173").rstrip("/")
OUT=Path(os.environ.get("ARCANA_WEAPON_UI_ARTIFACTS","/tmp/weapon-ui-proof"))
SIZES=((320,568),(390,844),(768,1024),(844,390),(1440,900))

FIXTURE=r"""async () => {
 const [{createCampaignStore,CAMPAIGN_DB,CAMPAIGN_STORE,CAMPAIGN_KEY},
  {validateCampaign},{createItem}]=await Promise.all([
    import('/src/campaignStore.js'),import('/src/progression/index.js'),
    import('/src/progression/state.js')]);
 const store=createCampaignStore(), loaded=await store.load();store.close();
 if(!loaded.ok)throw Error('No loaded campaign: '+loaded.code);
 const s=loaded.state,p=s.progression;
 s.profile.runs=30;s.profile.gold=50000;
 p.heroes.guardian.level=1;p.heroes.ranger.level=1;
 p.inventory.push(createItem('item-3','sentinel_sword'));
 p.inventory.push(createItem('item-4','oak_bow'));
 p.nextItem=5;
 if(!validateCampaign(s))throw Error('Invalid fixture before actual UI commands');
 await new Promise((resolve,reject)=>{
  const q=indexedDB.open(CAMPAIGN_DB);
  q.onerror=()=>reject(q.error);
  q.onsuccess=()=>{
   const db=q.result,tx=db.transaction(CAMPAIGN_STORE,'readwrite');
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.onabort=()=>{db.close();reject(tx.error)};
   tx.objectStore(CAMPAIGN_STORE).put(s,CAMPAIGN_KEY);
  };
 });
 return {hero:p.heroId,items:p.inventory.map(x=>x.id)};
}"""

STORED=r"""async () => {
 const {createCampaignStore}=await import('/src/campaignStore.js');
 const store=createCampaignStore();
 try{
  const result=await store.load();
  if(!result.ok)throw Error('Campaign read '+result.code);
  return result.state;
 }finally{store.close()}
}"""

def state(page):
 return page.evaluate(STORED)

def evidence(page,folder,name):
 target=folder/(name+".png")
 assert not target.exists(),("SCREENSHOT_OVERWRITE_BLOCKED",str(target))
 page.screenshot(path=str(target),timeout=15000)
 data=target.read_bytes()
 assert data.startswith(b"\x89PNG\r\n\x1a\n"),name
 return {"screenshot":str(target),"sha256":hashlib.sha256(data).hexdigest()}

def open_equipment(page):
 if not page.locator('[data-lobby-panel="hero"]').count():
  page.locator('[data-lobby-tab="hero"]').click()
 page.locator('[data-subtab="equipment"][data-scope="hero"]').click()
 expect(page.locator('.lb-inventory-grid')).to_be_visible()

def open_modal(page,item):
 open_equipment(page)
 page.locator(f'.lb-inventory-grid [data-action="item"][data-id="{item}"]').click()
 expect(page.locator('[role="dialog"]')).to_be_visible()
 return page.locator('[role="dialog"]')

def close_modal(page):
 page.locator('[data-action="close-modal"]').click()
 expect(page.locator('[role="dialog"]')).to_have_count(0)

def rejection(page,folder,hero,item,phase=None):
 dialog=open_modal(page,item)
 button=dialog.locator(f'[data-command="EQUIP_ITEM"][data-item-id="{item}"]')
 assert button.count()==1,(hero,item,'missing actual UI equip control')
 expect(button).to_be_disabled()
 expect(dialog.locator('.lb-unlock-reason')).to_contain_text('อาวุธนี้สวมไม่ได้')
 proof=evidence(page,folder,f"{hero}-{phase}-blocked-{item}" if phase else f"{hero}-blocked-{item}")
 close_modal(page)
 return proof

def equip(page,hero,item):
 dialog=open_modal(page,item)
 button=dialog.locator(f'[data-command="EQUIP_ITEM"][data-item-id="{item}"]')
 expect(button).to_be_enabled()
 button.click()
 expect(page.locator('.lb-notice')).to_contain_text('สวมใส่อุปกรณ์แล้ว')
 saved=state(page)
 assert saved["progression"]["equipment"]["weapon"]==item,(hero,item,'UI equip not persisted')
 close_modal(page)
 return saved

def switch(page,hero):
 if page.locator('[role="dialog"]').count():close_modal(page)
 if not page.locator('[data-lobby-panel="hero"]').count():
  page.locator('[data-lobby-tab="hero"]').click()
 page.locator('[data-subtab="heroes"][data-scope="hero"]').click()
 button=page.locator(f'[data-command="SELECT_HERO"][data-hero-id="{hero}"]')
 expect(button).to_be_enabled()
 button.click()
 expect(page.locator('.lb-notice')).to_contain_text('เปลี่ยนนักรบแล้ว')
 saved=state(page)
 assert saved["progression"]["heroId"]==hero,("hero switch not committed",hero)
 return saved

def run_one(browser,engine,width,height):
 folder=OUT/engine/f"{width}x{height}"
 folder.mkdir(parents=True,exist_ok=True)
 context=browser.new_context(viewport={"width":width,"height":height},
  device_scale_factor=1,is_mobile=width<1000,has_touch=width<1000)
 page=context.new_page()
 page_errors=[]
 page.on("pageerror",lambda exc:page_errors.append(str(exc)))
 shots=[]
 try:
  response=page.goto(URL,wait_until="networkidle")
  assert response and response.status==200
  page.locator('[data-action="start"]').wait_for()
  fixture=page.evaluate(FIXTURE)
  assert fixture=={"hero":"mage","items":["item-1","item-2","item-3","item-4"]},fixture
  page.reload(wait_until="networkidle")
  page.locator('[data-lobby-tab="hero"]').wait_for()
  expected=set(fixture["items"])
  before=state(page)
  assert before["progression"]["equipment"]["weapon"]=="item-1"
  # Mage cannot equip either the sword or the bow, even via an enabled button.
  shots.append(rejection(page,folder,"mage","item-3"))
  shots.append(rejection(page,folder,"mage","item-4",phase="initial"))
  guardian=switch(page,"guardian")
  assert guardian["progression"]["equipment"]["weapon"] is None
  assert set(i["id"] for i in guardian["progression"]["inventory"])==expected
  shots.append(evidence(page,folder,"guardian-switch-inventory-preserved"))
  shots.append(rejection(page,folder,"guardian","item-1"))
  shots.append(rejection(page,folder,"guardian","item-4"))
  equip(page,"guardian","item-3")
  ranger=switch(page,"ranger")
  assert ranger["progression"]["equipment"]["weapon"] is None
  assert set(i["id"] for i in ranger["progression"]["inventory"])==expected
  shots.append(evidence(page,folder,"ranger-switch-inventory-preserved"))
  shots.append(rejection(page,folder,"ranger","item-3"))
  shots.append(rejection(page,folder,"ranger","item-1"))
  equip(page,"ranger","item-4")
  mage=switch(page,"mage")
  assert mage["progression"]["equipment"]["weapon"] is None
  assert set(i["id"] for i in mage["progression"]["inventory"])==expected
  shots.append(evidence(page,folder,"mage-switch-inventory-preserved"))
  shots.append(rejection(page,folder,"mage","item-4",phase="returned"))
  equip(page,"mage","item-1")
  after=state(page)
  assert set(i["id"] for i in after["progression"]["inventory"])==expected
  assert after["progression"]["equipment"]["weapon"]=="item-1"
  assert after["profile"]["gold"]==before["profile"]["gold"],"UI switch invented gold"
  assert after["progression"]["nextItem"]==before["progression"]["nextItem"]
  page.reload(wait_until="networkidle")
  reloaded=state(page)
  assert reloaded["progression"]["heroId"]=="mage"
  assert reloaded["progression"]["equipment"]["weapon"]=="item-1"
  assert set(i["id"] for i in reloaded["progression"]["inventory"])==expected
  assert not page_errors,("page errors",page_errors)
  assert len(shots)==10 and len({shot["screenshot"] for shot in shots})==10,("DUPLICATE_EVIDENCE_PATH",engine,width,height)
  print("PASS REAL_WEAPON_UI",engine,f"{width}x{height}",
   "6 disabled off-class equip controls; 3 persisted hero switches;",
   "3 valid equipped weapons; 4/4 inventory items preserved after reload",flush=True)
  return {"engine":engine,"viewport":f"{width}x{height}",
   "classification":"REAL_BROWSER_UI_AND_INDEXEDDB_WITH_VALID_OWNED_FIXTURE",
   "not_proven":"earned crafting/drop path; physical device hardware",
   "switch_sequence":["mage","guardian","ranger","mage"],
   "weapon_equip_sequence":["sentinel_sword","oak_bow","star_wand"],
   "final_items":sorted(expected),"final_equipped":reloaded["progression"]["equipment"]["weapon"],
   "screenshots":shots}
 finally:
  page.close();context.close()

def main():
 results=[]
 with sync_playwright() as pw:
  for engine in ("chromium","webkit"):
   browser=getattr(pw,engine).launch(headless=True)
   try:
    for width,height in SIZES:
     results.append(run_one(browser,engine,width,height))
   finally:browser.close()
 assert len(results)==10
 # Audit the final PNG bytes on disk, not just the bytes at capture time.
 # Overwritten screenshots invalidate earlier hashes even if UI tests pass.
 records=[shot for run in results for shot in run["screenshots"]]
 assert len(records)==100,("INCOMPLETE_EVIDENCE",len(records))
 paths=[Path(shot["screenshot"]) for shot in records]
 assert len(set(paths))==100,("DUPLICATE_EVIDENCE_PATHS",len(set(paths)))
 for shot,path in zip(records,paths):
  assert path.is_file(),("EVIDENCE_NOT_FOUND",str(path))
  raw=path.read_bytes()
  assert raw.startswith(b"\x89PNG\r\n\x1a\n"),("NOT_PNG",str(path))
  actual=hashlib.sha256(raw).hexdigest()
  assert actual==shot["sha256"],("EVIDENCE_SHA256_MISMATCH",str(path),shot["sha256"],actual)
 actual_files=set(OUT.rglob("*.png"))
 assert actual_files==set(paths),("UNLISTED_OR_MISSING_PNGS",len(actual_files),len(set(paths)))
 OUT.mkdir(parents=True,exist_ok=True)
 report=OUT/"report.json"
 report.write_text(json.dumps({"runs":results,
  "actual_engine_size_pairs":10,"physical_mobile":"NOT_TESTED",
  "fixtures":"legally valid owned/unlocked items, no reward grant in UI test"},ensure_ascii=False,indent=2),encoding="utf-8")
 print("PASS REAL_WEAPON_UI 10/10 browser/size runs",flush=True)
 print("PASS WEAPON_UI_EVIDENCE_SHA256 100/100 MATCH, 100 UNIQUE PNG PATHS, 0 OVERWRITES",flush=True)

if __name__=="__main__":main()
