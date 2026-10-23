"""Astra-focused synthetic visual evidence generator, not live gameplay QA.

Prerequisites:
  npm run dev   # in another terminal
  pip install playwright && python -m playwright install chromium webkit
Run:
  ARCANA_QA_URL=http://127.0.0.1:4173 python scripts/astra_visual_qa.py

Renders current SOURCE branch's real lobby SVG and real Path2D Canvas actor at
map scale in both engines, five viewports, eight directions and three distinct
combat phases. Writes labeled contact-sheet screenshots, never mockup art.
A passing result does NOT replace full in-game input, save and reward QA.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("ARCANA_QA_URL", "http://127.0.0.1:4173").rstrip("/")
OUT = Path(os.environ.get("ARCANA_QA_ARTIFACTS", "/tmp/astra-visual-qa"))
SIZES = ((320, 568), (390, 844), (768, 1024), (844, 390), (1440, 900))
DIRECTIONS = ((1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1),(0,-1),(1,-1))
LABELS = ("E", "SE", "S", "SW", "W", "NW", "N", "NE")
PHASES = ("walk", "charge", "release", "recover")

BUILD = """async ({directions,labels,phases}) => {
  const {heroActorSvg, renderHeroActor} =
    await import('/src/characters/visual/hero-art.js');
  const {resolveHeroPose} =
    await import('/src/characters/motion/index.js');
  const host=document.createElement('section');
  host.id='astra-candidate-proof';
  host.style.cssText='font:12px sans-serif;background:#142033;color:#f3f5fa;padding:12px;display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px;';
  const checks=[];
  for(const phase of phases){
    for(let i=0;i<directions.length;i++){
      const [x,y]=directions[i];
      const tick=100, base={heroId:'mage',tick,moving:true,
        moveVector:{x,y},aimVector:{x:-x,y:-y||-1},
        attackIntervalTicks:30};
      if(phase==='charge'){base.targetPresent=true;base.nextAttackTick=106;}
      if(phase==='release')base.lastAttackTick=100;
      if(phase==='recover')base.lastAttackTick=96;
      const pose=resolveHeroPose(base);
      if(phase!=='walk' && pose.attackPhase!==phase) {
        throw Error(labels[i]+' wrong phase: '+pose.attackPhase);
      }
      const svg=heroActorSvg({heroId:'mage',pose});
      if(!svg.includes('data-actor-part="capeTail"'))throw Error('Astra hem missing');
      const tile=document.createElement('div');
      tile.style.cssText='background:#1e2c40;border:1px solid #526881;padding:6px;text-align:center;min-width:0;';
      const heading=document.createElement('div');
      heading.textContent='SYNTHETIC source / '+labels[i]+' / '+phase+' / tick 100';
      const art=document.createElement('div');
      art.style.cssText='height:240px;display:flex;align-items:center;justify-content:center';
      art.innerHTML=svg;
      const vector=art.querySelector('svg');
      vector.style.cssText='width:210px;height:230px;max-width:100%';
      const cv=document.createElement('canvas');
      cv.width=72;cv.height=82;cv.style.cssText='width:72px;height:82px;image-rendering:auto';
      const ok=renderHeroActor(cv.getContext('2d'),{heroId:'mage',pose,x:36,y:41,scale:.2});
      if(!ok)throw Error('Canvas Path2D rendering unavailable at '+labels[i]);
      const data=cv.getContext('2d').getImageData(0,0,72,82).data;
      let opaque=0;
      for(let p=3;p<data.length;p+=4)if(data[p])opaque++;
      if(opaque<60)throw Error('Map-scale actor invisible '+labels[i]+'/'+phase);
      tile.append(heading,art,cv);host.append(tile);
      checks.push({direction:labels[i],phase,opaque});
    }
  }
  document.body.innerHTML='';
  document.body.style.cssText='margin:0;background:#142033';
  document.body.append(host);
  return {frames:checks.length,checks};
}"""

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    summary = []
    with sync_playwright() as pw:
        for engine in ("chromium", "webkit"):
            browser = getattr(pw, engine).launch(headless=True)
            try:
                for width, height in SIZES:
                    page = browser.new_page(
                        viewport={"width":width,"height":height},
                        is_mobile=width<1000, has_touch=width<1000)
                    errors = []
                    page.on("pageerror", lambda e: errors.append(str(e)))
                    try:
                        response = page.goto(
                            URL + "/tests/characters/visual/preview.html",
                            wait_until="networkidle", timeout=30000)
                        assert response and response.status == 200, (
                            engine,width,height,"preview missing")
                        result = page.evaluate(BUILD, {
                            "directions": DIRECTIONS, "labels": LABELS,
                            "phases": PHASES,
                        })
                        assert result["frames"] == len(DIRECTIONS)*len(PHASES)
                        assert not errors, (engine,width,height,errors)
                        target = OUT / engine
                        target.mkdir(parents=True,exist_ok=True)
                        name = target / f"astra-source-{width}x{height}.png"
                        # Full-page contact sheet, all directions/phases, with
                        # both high-res lobby SVG and actual map-sized Canvas.
                        page.screenshot(path=str(name),full_page=True)
                        summary.append({"engine":engine,"viewport":f"{width}x{height}",
                                        "result":"PASS","synthetic_frames":result["frames"],
                                        "artifact":str(name)})
                    finally:
                        page.close()
            finally:
                browser.close()
    report=OUT/"report.json"
    report.write_text(json.dumps({
      "classification":"SYNTHETIC source render; NOT live gameplay or physical hardware",
      "checks":summary},indent=2),encoding="utf-8")
    print(report)
    print("PASS:",len(summary),"browser/viewport matrices;",
          sum(row["synthetic_frames"] for row in summary),"source frames")
    print("LIVE GAMEPLAY / PHYSICAL MOBILE: NOT_RUN")

if __name__=="__main__":
    main()
