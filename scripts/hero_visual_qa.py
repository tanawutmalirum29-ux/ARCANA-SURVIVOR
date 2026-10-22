"""Independent SYNTHETIC actor/pose visual smoke; NOT live gameplay or hardware QA.

Requires the combined #67 source and a running "npm run dev" HTTP server.
Run: python scripts/hero_visual_qa.py
Optional: ARCANA_QA_ARTIFACTS=/tmp/hero-qa for rendered screenshots.
Do not accept a release based on this smoke alone: gameplay shot signals,
actual Canvas map integration, persistence, and complete CI need separate QA.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

SIZES = ((320, 568), (390, 844), (768, 1024), (844, 390), (1440, 900))
HEROES = ("mage", "guardian", "ranger")
URL = os.environ.get("ARCANA_QA_URL", "http://127.0.0.1:4173").rstrip("/")
ARTIFACTS = os.environ.get("ARCANA_QA_ARTIFACTS")

SYNTHETIC_CHECK = """async () => {
  const {heroActorSvg, renderHeroActor} =
    await import('/src/characters/visual/hero-art.js');
  const {resolveHeroPose} =
    await import('/src/characters/motion/index.js');
  const require = (ok, label) => {if (!ok) throw Error(label);};
  const heroes = ['mage', 'guardian', 'ranger'];
  const signatures = new Set();
  const fingerprints = new Set();
  const pixels = canvas => {
    const data = canvas.getContext('2d').getImageData(
      0, 0, canvas.width, canvas.height).data;
    let opaque=0, hash=2166136261;
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]) opaque++;
      for(let c=0;c<4;c++) hash=Math.imul(hash ^ data[i+c],16777619);
    }
    return {opaque, hash:hash>>>0};
  };
  const frames = document.createElement('div');
  frames.id = 'independent-qa-frames';
  frames.style.cssText = 'display:grid;grid-template-columns:repeat(3,80px);gap:8px;margin:16px;';
  document.body.append(frames);
  for (const heroId of heroes) {
    const baseline = document.querySelector(
      '.canonical-hero-art[data-hero="' + heroId + '"]');
    require(baseline, heroId+' canonical SVG missing in reference matrix');
    const signature = baseline.getAttribute('data-signature');
    require(signature,heroId+' missing identity signature');
    signatures.add(signature);
    const original = document.getElementById('map-'+heroId);
    require(original && pixels(original).opaque > 40,
      heroId+' reference Canvas blank; Path2D or actor render failed');
    const states = [
      ['idle',{heroId,tick:96,moving:false,lastAttackTick:null,
        aimVector:{x:1,y:0},attackIntervalTicks:30}],
      ['walk',{heroId,tick:103,moving:true,moveVector:{x:1,y:0},
        aimVector:{x:1,y:0},lastAttackTick:null,attackIntervalTicks:30}],
      ['release',{heroId,tick:100,moving:true,moveVector:{x:1,y:0},
        aimVector:{x:1,y:0},lastAttackTick:100,attackIntervalTicks:30}],
    ];
    const hashes = new Set();
    for (const [name,input] of states) {
      const pose = resolveHeroPose(input);
      require(name==='release' ? pose.attackPhase==='release' :
        pose.attackPhase==='none',heroId+' synthetic '+name+' phase incorrect');
      require(name==='walk' ? pose.locomotion==='walk' : true,
        heroId+' walking pose missing');
      require(JSON.stringify(pose)===JSON.stringify(resolveHeroPose(input)),
        heroId+' non-deterministic pose input');
      const svg = heroActorSvg({heroId,pose});
      require(svg.includes('data-hero="'+heroId+'"'),
        heroId+' pose SVG lost identity');
      const c = document.createElement('canvas');
      c.width=80;c.height=80;c.dataset.hero=heroId;c.dataset.state=name;
      const rendered=renderHeroActor(c.getContext('2d'),
        {heroId,pose,x:40,y:40,scale:.2});
      require(rendered,heroId+' '+name+' Canvas actor returned false');
      const pixel = pixels(c);
      require(pixel.opaque>60,heroId+' '+name+' rendered transparent');
      hashes.add(pixel.hash);
      const tile=document.createElement('div');
      tile.append(c,document.createTextNode(heroId+'/'+name));
      frames.append(tile);
      if(name==='idle') fingerprints.add(pixel.hash);
    }
    require(hashes.size>1,heroId+' actor never changes pose');
    const noShot = resolveHeroPose({heroId,tick:120,
      moving:false,targetPresent:false,lastAttackTick:null,
      attackIntervalTicks:30});
    require(noShot.attackPhase==='none',
      heroId+' release invented without a confirmed shot');
    const reduced = resolveHeroPose({heroId,tick:120,
      moving:true,moveVector:{x:1,y:0},lastAttackTick:120,
      attackIntervalTicks:30,reducedMotion:true});
    require(reduced.reducedMotion && reduced.attackPhase==='release',
      heroId+' reduced-motion keypose omitted');
  }
  require(signatures.size===3,'hero signatures not distinct');
  require(fingerprints.size===3,'hero idle Canvas fingerprints not distinct');
  const savedPath2D = globalThis.Path2D;
  let fallbackTested=false;
  try {
    globalThis.Path2D=undefined;
    if(typeof globalThis.Path2D!=='function'){
      const c=document.createElement('canvas');
      require(renderHeroActor(c.getContext('2d'),
        {heroId:'mage',x:40,y:40})===false,
        'Path2D unavailable must decline Canvas rendering');
      fallbackTested=true;
    }
  } finally {globalThis.Path2D=savedPath2D;}
  return {heroes:heroes.length,syntheticFrames:frames.querySelectorAll('canvas').length,
    differentIdentity:signatures.size, fallbackTested};
}"""

def run_one(browser, engine, width, height):
    page = browser.new_page(viewport={"width": width, "height": height},
        has_touch=width < 1000, is_mobile=width < 1000)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    try:
        response = page.goto(URL + "/tests/characters/visual/preview.html",
            wait_until="networkidle")
        assert response and response.status == 200, (
            engine, width, height, "preview source missing from candidate")
        evidence = page.evaluate(SYNTHETIC_CHECK)
        assert evidence["heroes"] == 3 and evidence["syntheticFrames"] == 9
        assert not errors, (engine, width, height, errors)
        if ARTIFACTS:
            target = Path(ARTIFACTS) / engine / f"{width}x{height}"
            target.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(target / "actor-pose-synthetic.png"),
                full_page=True)
        print("PASS SYNTHETIC_ACTOR_ONLY", engine, f"{width}x{height}", evidence)
    finally:
        page.close()

def main():
    with sync_playwright() as playwright:
        for engine in ("chromium", "webkit"):
            browser = getattr(playwright, engine).launch(headless=True)
            try:
                for width, height in SIZES:
                    run_one(browser, engine, width, height)
            finally:
                browser.close()
    print("SYNTHETIC ACTOR QA COMPLETE: 10 browser/viewport combinations")
    if not ARTIFACTS:
        print("SCREENSHOT_ARTIFACTS NOT_RUN: set ARCANA_QA_ARTIFACTS")
    print("LIVE_GAMEPLAY_MAP/SHOT_SYNC/MIGRATION/PHYSICAL_DEVICE: NOT_RUN")

if __name__ == "__main__":
    main()
