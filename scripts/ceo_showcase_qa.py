"""CEO VFX integration smoke on HTTP origin; emulated inputs, not physical phone."""
import argparse, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
SIZES=[(320,568),(390,844),(768,1024),(844,390),(1440,900)]
def campaign_state(page):
    """Read the same durable transaction store as the app, never its old cache."""
    return page.evaluate("""async () => {
      const {createCampaignStore}=await import('/src/campaignStore.js');
      const store=createCampaignStore();
      try {
        const result=await store.load();
        if (!result.ok) throw Error('Campaign read: '+result.code);
        return result.state;
      } finally {store.close();}
    }""")


HEROES=('mage','guardian','ranger')
VARIANTS=('base','ember','moon','lantern','verdant','aurora','crimson','celestial')
PREVIEW=('lantern','verdant','aurora','crimson','celestial')

def assert_no_preview_grants(saved):
    wardrobe=saved['progression']['wardrobe']
    assert saved['schemaVersion']==3,('expected a v3 campaign', saved.get('schemaVersion'))
    assert set(wardrobe)==set(HEROES)
    for hero in HEROES:
        slot=wardrobe[hero]
        assert f'{hero}:base' in slot['owned'],(hero,slot)
        assert slot['equipped'] in slot['owned'],(hero,slot)
        assert all(item.startswith(hero+':') for item in slot['owned']),(hero,slot)
        assert not set(f'{hero}:{variant}' for variant in PREVIEW).intersection(slot['owned']),(hero,slot)

def assert_hero_wardrobe(page, hero, engine, w, h):
    cards=page.locator('.skin-card')
    previews=page.locator('[data-action="preview"]')
    expected=sorted(f'{hero}:{variant}' for variant in VARIANTS)
    actual=sorted(previews.evaluate_all('(nodes) => nodes.map(el => el.dataset.id)'))
    assert cards.count()==len(VARIANTS),(engine,w,h,hero,'card count',cards.count())
    assert actual==expected,(engine,w,h,hero,'hero wardrobe entries',actual)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(engine,w,h,hero,'horizontal overflow')

def assert_hero_showcase(page, hero, engine, w, h):
    actual=sorted(page.locator('[data-vfx-skin]').evaluate_all('(nodes) => nodes.map(el => el.dataset.vfxSkin)'))
    expected=sorted(f'{hero}:{variant}' for variant in VARIANTS)
    assert actual==expected,(engine,w,h,hero,'hero-specific showcase',actual)
    assert page.locator('.vfx-catalog-item').count()==len(VARIANTS)

def capture(page,engine,w,h,name):
    root=os.environ.get('ARCANA_QA_ARTIFACTS')
    if not root:return
    location=Path(root)/engine/f'{w}x{h}'
    location.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(location/f'{name}.png'),full_page=True)

def assert_hero_separation(page,engine,w,h):
    """Synthetic unlock fixture then real v3 SELECT_HERO and UI equip transactions.
    Synthetic ownership is NOT evidence of earned hero progression.
    """
    page.evaluate("""async () => {
      const {createCampaignStore,CAMPAIGN_DB,CAMPAIGN_STORE,CAMPAIGN_KEY} = await import('/src/campaignStore.js');
      const {validateCampaign} = await import('/src/progression/index.js');
      const store=createCampaignStore();
      const loaded=await store.load();
      store.close();
      if (!loaded.ok) throw Error('Fixture failed to read campaign: '+loaded.code);
      const next=loaded.state;
      next.progression.heroes.guardian.level=1;
      next.progression.heroes.ranger.level=1;
      if (!validateCampaign(next)) throw Error('Invalid 3-hero synthetic fixture');
      await new Promise((resolve,reject) => {
        const request=indexedDB.open(CAMPAIGN_DB);
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{
          const db=request.result;
          const tx=db.transaction(CAMPAIGN_STORE,'readwrite');
          tx.oncomplete=()=>{db.close();resolve();};
          tx.onerror=()=>{db.close();reject(tx.error);};
          tx.onabort=()=>{db.close();reject(tx.error);};
          tx.objectStore(CAMPAIGN_STORE).put(next,CAMPAIGN_KEY);
        };
      });
    }""")
    # Cross-hero costume attempts must fail without any durable mutation.
    cross=page.evaluate("""async () => {
      const {createCampaignStore}=await import('/src/campaignStore.js');
      const store=createCampaignStore();
      try {
        const before=await store.load();
        if (!before.ok) throw Error('read failed: '+before.code);
        const forbidden=await store.dispatch({type:'EQUIP_COSMETIC',
          heroId:'guardian',cosmeticId:'mage:moon'});
        const after=await store.load();
        return {ok:forbidden.ok, code:forbidden.code,
          unchanged:JSON.stringify(before.state)===JSON.stringify(after.state)};
      } finally {store.close();}
    }""")
    assert cross['ok'] is False and cross['unchanged'],(engine,w,h,'cross-hero equip or save mutation',cross)
    for hero in ('guardian','ranger'):
        selected=page.evaluate("""async hero => {
          const {createCampaignStore}=await import('/src/campaignStore.js');
          const store=createCampaignStore();
          try {
            const result=await store.dispatch({type:'SELECT_HERO',heroId:hero});
            return {ok:result.ok,code:result.code};
          } finally {store.close();}
        }""",hero)
        assert selected['ok'],(engine,w,h,hero,'cannot select unlocked fixture hero',selected)
        page.reload(wait_until='networkidle')
        page.locator('[data-lobby-tab="adventure"]').wait_for()
        open_wardrobe(page)
        assert_hero_wardrobe(page,hero,engine,w,h)
        capture(page,engine,w,h,f'{hero}-wardrobe')
        page.locator(f'[data-action="preview"][data-id="{hero}:moon"]').click()
        assert page.locator('.vfx-showcase').is_visible()
        assert_hero_showcase(page,hero,engine,w,h)
        # All 3 earned moon entitlements came from a real FINISH_RUN above.
        page.locator(f'[data-vfx-equip="{hero}:moon"]').click()
        page.locator('.vfx-showcase').wait_for(state='detached')
        saved=campaign_state(page)
        assert saved['progression']['wardrobe'][hero]['equipped']==f'{hero}:moon',(engine,w,h,hero,saved['progression']['wardrobe'])
        assert_no_preview_grants(saved)
        assert saved['progression']['wardrobe']['mage']['equipped']=='mage:moon'
        capture(page,engine,w,h,f'{hero}-moon-equipped')
        page.reload(wait_until='networkidle')
        open_wardrobe(page)
        assert_hero_wardrobe(page,hero,engine,w,h)
        assert campaign_state(page)['progression']['wardrobe'][hero]['equipped']==f'{hero}:moon'
        page.locator('[data-action="home"]').click()

def open_wardrobe(page, keyboard=False):
    # Wardrobe belongs to the Character tab in the five-tab lobby.
    if page.locator('[data-action="wardrobe"]').count()==0:
        page.locator('[data-lobby-tab="hero"]').click()
    if keyboard:
        page.locator('[data-action="wardrobe"]').focus()
        page.keyboard.press('Enter')
    else:
        page.locator('[data-action="wardrobe"]').click()

def check(browser,engine,w,h,origin):
    touch=w<1000
    page=browser.new_page(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin,wait_until='networkidle')
    page.locator('[data-lobby-tab="adventure"]').wait_for()
    open_wardrobe(page)
    assert_hero_wardrobe(page, 'mage', engine, w, h)
    capture(page, engine, w, h, 'mage-wardrobe-initial')
    page.locator('[data-action="preview"][data-id="mage:crimson"]').click()
    assert page.locator('.vfx-showcase').is_visible()
    assert_hero_showcase(page, 'mage', engine, w, h)
    assert page.get_by_text('LOCKED · PREVIEW ONLY').count()>=1
    assert page.locator('[data-vfx-equip="mage:crimson"]').count()==0
    capture(page, engine, w, h, 'mage-crimson-locked')
    box=page.locator('.vfx-showcase').bounding_box()
    assert box and box['x']>=-1 and box['y']>=-1 and box['x']+box['width']<=w+1 and box['y']+box['height']<=h+1,(engine,w,h,box)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    page.locator('[data-vfx-quality="medium"]').click()
    expect(page.locator('[data-vfx-quality="medium"]')).to_have_attribute('aria-pressed','true')
    page.locator('[data-vfx-motion]').click()
    expect(page.locator('[data-vfx-motion]')).to_have_attribute('aria-pressed','true')
    saved=campaign_state(page)
    assert saved['profile']['settings']=={'vfx':'medium','reduceMotion':True},saved['profile']['settings']
    page.locator('[data-vfx-skin="mage:moon"]').click()
    assert page.locator('[data-vfx-equip="mage:moon"]').count()==0
    page.locator('[data-vfx-close]').click()
    page.reload(wait_until='networkidle')
    saved=campaign_state(page)
    assert saved['profile']['settings']['vfx']=='medium'
    # A fixture-backed completed run earns the real free achievement through
    # the reducer and transactional store. This is not a full combat playthrough.
    page.evaluate("""async () => {
      const {createCampaignStore}=await import('/src/campaignStore.js');
      const store=createCampaignStore();
      try {
        const started=await store.dispatch({type:'START_RUN',day:new Date().toISOString().slice(0,10)});
        if (!started.ok) throw Error('Achievement fixture start: '+started.code);
        const finished=await store.dispatch({type:'FINISH_RUN',
          runId:started.details.runId,stats:{kills:30,seconds:60,won:false}});
        if (!finished.ok ||
            !['mage','guardian','ranger'].every(hero => (
              finished.state.progression.wardrobe[hero].owned.includes(hero+':moon'))))
          throw Error('Achievement fixture finish: '+finished.code);
      } finally {store.close();}
    }""")
    page.reload(wait_until='networkidle')
    page.locator('[data-lobby-tab="adventure"]').wait_for()
    open_wardrobe(page)
    page.locator('[data-action="preview"][data-id="mage:moon"]').click()
    page.locator('[data-vfx-equip="mage:moon"]').click()
    page.locator('.vfx-showcase').wait_for(state='detached')
    stored=campaign_state(page)
    assert stored['progression']['wardrobe']['mage']['equipped']=='mage:moon'
    assert all(stored['progression']['wardrobe'][hero]['equipped']==f'{hero}:base'
               for hero in ('guardian','ranger'))
    assert_no_preview_grants(stored)
    assert page.locator('.vfx-showcase').count()==0
    page.locator('[data-action="home"]').click()
    assert_hero_separation(page, engine, w, h)
    assert not errors,(engine,w,h,errors)
    print('PASS',engine,f'{w}x{h}','3 hero wardrobes, lock/preview, quality, motion, atomic equip')
    page.close()
def keyboard_and_system_motion(browser,engine,w,h,origin):
    page=browser.new_page(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,
                          device_scale_factor=1,reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin,wait_until='networkidle')
    page.locator('[data-lobby-tab="adventure"]').wait_for()
    assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
    # Count scheduled Canvas preview frames, not the game's own 'frame' callback.
    page.evaluate("""() => {
      window.__vfxFrames = 0;
      const native = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = fn => {
        if (fn.name === 'draw') window.__vfxFrames++;
        return native(fn);
      };
    }""")
    open_wardrobe(page, keyboard=True)
    page.locator('[data-action="preview"][data-id="mage:base"]').focus()
    page.keyboard.press('Space')
    assert page.locator('.vfx-showcase').is_visible()
    assert_hero_showcase(page,'mage',engine,w,h)
    assert page.evaluate('window.__vfxFrames')==0,(engine,w,h,'OS reduced motion scheduled preview frames')
    # Keyboard activation of low-visibility, last-in-gallery card must preserve focus/scroll.
    last=page.locator('[data-vfx-skin="mage:celestial"]')
    last.focus()
    before=page.locator('.vfx-showcase').evaluate('(el) => el.scrollTop')
    page.keyboard.press('Enter')
    focused=page.evaluate("document.activeElement?.getAttribute('data-vfx-skin')")
    after=page.locator('.vfx-showcase').evaluate('(el) => el.scrollTop')
    assert focused=='mage:celestial',(engine,w,h,'catalog keyboard focus lost',focused)
    card=page.locator('.vfx-showcase').bounding_box()
    control=page.locator('[data-vfx-skin="mage:celestial"]').bounding_box()
    assert after>=before-8,(engine,w,h,'catalog unexpectedly jumped backwards',before,after)
    # The rerender is allowed to reveal the focused control with a small forward
    # scroll, but it must never reset the catalog or jump more than one page.
    assert after-before<=card['height'],(engine,w,h,'catalog jumped too far',before,after)
    assert control and control['y'] >= card['y']-5 and control['y']+control['height']<=card['y']+card['height']+5,(engine,w,h,'focused skin hidden after redraw')
    page.locator('[data-vfx-quality="low"]').focus()
    page.keyboard.press('Space')
    assert page.evaluate("document.activeElement?.getAttribute('data-vfx-quality')")=='low',(engine,w,h,'quality focus lost')
    assert page.evaluate('window.__vfxFrames')==0,(engine,w,h,'OS reduced motion was not respected')
    page.keyboard.press('Escape')
    assert page.locator('.vfx-showcase').count()==0
    assert page.get_by_text('WARDROBE').count()>=1
    assert not errors,(engine,w,h,errors)
    page.close()
    print('PASS',engine,f'{w}x{h}','OS reduced-motion, keyboard, focus/scroll, Escape')

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--browsers',nargs='+',default=['chromium','webkit'])
    args=ap.parse_args()
    origin=os.environ.get('ARCANA_QA_URL','http://127.0.0.1:4173')
    with sync_playwright() as p:
        for engine in args.browsers:
            for w,h in SIZES:
                browser=getattr(p,engine).launch(headless=True)
                try:check(browser,engine,w,h,origin)
                finally:browser.close()
            for w,h in [(320,568),(844,390)]:
                browser=getattr(p,engine).launch(headless=True)
                try:keyboard_and_system_motion(browser,engine,w,h,origin)
                finally:browser.close()
    print('SHOWCASE QA COMPLETE',len(args.browsers)*(len(SIZES)+2))
if __name__=='__main__':main()
