"""SYNTHETIC eight-direction gait contact sheet; not live gameplay/hardware QA.

Uses real candidate SVG/Canvas renderers on Chromium and WebKit, at the five
shipping viewport sizes. Requires running dev-server at ARCANA_QA_URL or :4173.
Screenshots are available via ARCANA_WALK8_ARTIFACTS for human art review.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('ARCANA_QA_URL','http://127.0.0.1:4173').rstrip('/')
ROOT = os.environ.get('ARCANA_WALK8_ARTIFACTS')
SIZES = ((320,568),(390,844),(768,1024),(844,390),(1440,900))

EVALUATE = r'''async () => {
  const {resolveHeroPose} = await import('/src/characters/motion/index.js');
  const {heroActorSvg, renderHeroActor} =
    await import('/src/characters/visual/hero-art.js');
  const heroes = ['mage','guardian','ranger'];
  const moves = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  const dirs = ['E','SE','S','SW','W','NW','N','NE'];
  const assert = (ok, msg) => {if(!ok) throw Error('WALK8_QA '+msg);};
  const hash = canvas => {
    const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let h=2166136261, opaque=0;
    for(let i=0;i<bytes.length;i+=4){
      if(bytes[i+3]>0) opaque++;
      for(let j=0;j<4;j++) h=Math.imul(h^bytes[i+j],16777619);
    }
    return {value:h>>>0,opaque};
  };
  document.body.replaceChildren();
  const style=document.createElement('style');
  style.textContent='body{margin:0;padding:12px;background:#101726;color:#e9e6da;font:12px system-ui}'+
    '#walk8-frames{display:grid;grid-template-columns:repeat(3, minmax(0, 105px));gap:8px;max-width:340px}'+
    '.pose{display:flex;align-items:center;flex-direction:column;padding:3px 0;min-height:118px;background:#24314b;border-radius:5px}'+
    '.pose canvas{width:80px;height:80px}.pose small{white-space:nowrap}';
  document.head.append(style);
  const title=document.createElement('h1');title.textContent='Walk8 directional gait | synthetic visual';
  title.style.fontSize='16px'; document.body.append(title);
  const holder=document.createElement('div');holder.id='walk8-frames';document.body.append(holder);
  let frames=0;
  for(const heroId of heroes){
    const signatures=new Set(), directions=new Set();
    for(let i=0;i<moves.length;i++){
      const [x,y]=moves[i], name=dirs[i];
      const first=resolveHeroPose({heroId,tick:6,moving:true,
        moveVector:{x,y},aimVector:{x:0,y:-1},lastAttackTick:null});
      assert(first.travel.direction8===name,heroId+'/'+name+' movement orientation');
      assert(first.facing.direction8==='N',heroId+'/'+name+' aim unexpectedly replaced');
      assert(first.attackPhase==='none',heroId+'/'+name+' invented attack');
      assert(first.travel.backView === (y<0),heroId+'/'+name+' cloak facing');
      const svg=heroActorSvg({heroId,pose:first});
      assert(svg.includes('data-hero="'+heroId+'"'),heroId+' visual identity lost');
      if(x<0) assert(svg.includes('scale(-0.'),heroId+'/'+name+' mirror missing');
      for(const step of [0,1]){
        const tick=step===0 ? 6 : 6+first.travel.period/4;
        const pose=resolveHeroPose({heroId,tick,moving:true,
          moveVector:{x,y},aimVector:{x:0,y:-1},lastAttackTick:null});
        const c=document.createElement('canvas');c.width=80;c.height=80;
        assert(renderHeroActor(c.getContext('2d'),{heroId,pose,x:40,y:40,scale:.19}),
          heroId+'/'+name+' Canvas Path2D draw failed');
        const fingerprint=hash(c);
        assert(fingerprint.opaque>65,heroId+'/'+name+' actor blank or clipped');
        if(step===0){directions.add(pose.travel.direction8);signatures.add(fingerprint.value);}
        else{
          const earlier=holder.querySelector('canvas[data-hero="'+heroId+'"]'+
            '[data-direction="'+name+'"][data-step="0"]');
          assert(earlier && hash(earlier).value!==fingerprint.value,
            heroId+'/'+name+' has no gait-frame pixel change');
        }
        c.dataset.hero=heroId;c.dataset.direction=name;c.dataset.step=String(step);
        const cell=document.createElement('div');cell.className='pose';
        cell.append(c);
        const label=document.createElement('small');label.textContent=heroId+' '+name+' / '+step;
        cell.append(label);holder.append(cell); frames++;
      }
    }
    assert(directions.size===8 && signatures.size>=7,
      heroId+' directions rendered indistinguishably');
  }
  return {heroes:heroes.length,directions:8,frames,kind:'SYNTHETIC_CANVAS_WALK8'};
}'''

def run(browser,engine,w,h):
    page=browser.new_page(viewport={'width':w,'height':h},
        has_touch=w<1000,is_mobile=w<1000)
    errors=[]
    page.on('pageerror',lambda err: errors.append(str(err)))
    try:
        response=page.goto(URL+'/tests/characters/visual/preview.html',wait_until='networkidle')
        assert response and response.status==200,(engine,w,h,'preview HTTP failed')
        result=page.evaluate(EVALUATE)
        assert result['frames']==48 and result['directions']==8,result
        assert not errors,(engine,w,h,errors)
        if ROOT:
            path=Path(ROOT)/engine/f'{w}x{h}'
            path.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(path/'walk8-contact-sheet.png'),full_page=True)
        print('PASS SYNTHETIC_WALK8',engine,f'{w}x{h}',result,flush=True)
    finally:
        page.close()

def main():
    with sync_playwright() as p:
        for engine in ('chromium','webkit'):
            browser=getattr(p,engine).launch(headless=True)
            try:
                for w,h in SIZES: run(browser,engine,w,h)
            finally:
                browser.close()
    print('WALK8 QA SYNTHETIC browser matrix passed: 3 heroes x 8 headings x 2 gait phases x 10 engine/viewports')
    print('LIVE_GAMEPLAY/PHYSICAL_DEVICE: NOT_RUN in this script; separate existing QA required')

if __name__=='__main__': main()
