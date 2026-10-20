"""CEO VFX integration smoke on HTTP origin; emulated inputs, not physical phone."""
import argparse, os
from playwright.sync_api import sync_playwright
SIZES=[(320,568),(390,844),(768,1024),(844,390),(1440,900)]
def check(browser,engine,w,h,origin):
    touch=w<1000
    page=browser.new_page(viewport={'width':w,'height':h},has_touch=touch,is_mobile=touch,device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin,wait_until='networkidle')
    page.locator('[data-action="wardrobe"]').click()
    assert page.locator('.skin-card').count()==8
    assert page.locator('[data-action="preview"]').count()==8
    page.locator('[data-action="preview"][data-id="crimson"]').click()
    assert page.locator('.vfx-showcase').is_visible()
    assert page.locator('.vfx-catalog-item').count()==8
    assert page.get_by_text('LOCKED · PREVIEW ONLY').count()>=1
    assert page.locator('[data-vfx-equip="crimson"]').count()==0
    box=page.locator('.vfx-showcase').bounding_box()
    assert box and box['x']>=-1 and box['y']>=-1 and box['x']+box['width']<=w+1 and box['y']+box['height']<=h+1,(engine,w,h,box)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    page.locator('[data-vfx-quality="medium"]').click()
    assert page.locator('[data-vfx-quality="medium"]').get_attribute('aria-pressed')=='true'
    page.locator('[data-vfx-motion]').click()
    assert page.locator('[data-vfx-motion]').get_attribute('aria-pressed')=='true'
    saved=page.evaluate("JSON.parse(localStorage.getItem('arcana-survivor-v1'))")
    assert saved['settings']=={'vfx':'medium','reduceMotion':True},saved['settings']
    page.locator('[data-vfx-skin="moon"]').click()
    assert page.locator('[data-vfx-equip="moon"]').count()==0
    page.locator('[data-vfx-close]').click()
    page.reload(wait_until='networkidle')
    saved=page.evaluate("JSON.parse(localStorage.getItem('arcana-survivor-v1'))")
    assert saved['settings']['vfx']=='medium'
    # Simulate legitimate free achievement skin in the v1 saved profile.
    page.evaluate("""() => {const key='arcana-survivor-v1';const p=JSON.parse(localStorage.getItem(key));p.owned.push('moon');localStorage.setItem(key,JSON.stringify(p))}""")
    page.reload(wait_until='networkidle')
    page.locator('[data-action="wardrobe"]').click()
    page.locator('[data-action="preview"][data-id="moon"]').click()
    page.locator('[data-vfx-equip="moon"]').click()
    stored=page.evaluate("JSON.parse(localStorage.getItem('arcana-survivor-v1'))")
    assert stored['skin']=='moon'
    assert page.locator('.vfx-showcase').count()==0
    page.locator('[data-action="home"]').click()
    assert not errors,(engine,w,h,errors)
    print('PASS',engine,f'{w}x{h}','showcase lock, preview, quality, motion, persistence, equip')
    page.close()
def keyboard_and_system_motion(browser,engine,w,h,origin):
    page=browser.new_page(viewport={'width':w,'height':h},has_touch=True,is_mobile=True,
                          device_scale_factor=1,reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin,wait_until='networkidle')
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
    page.locator('[data-action="wardrobe"]').focus()
    page.keyboard.press('Enter')
    page.locator('[data-action="preview"][data-id="apprentice"]').focus()
    page.keyboard.press('Space')
    assert page.locator('.vfx-showcase').is_visible()
    assert page.evaluate('window.__vfxFrames')==0,(engine,w,h,'OS reduced motion scheduled preview frames')
    # Keyboard activation of low-visibility, last-in-gallery card must preserve focus/scroll.
    last=page.locator('[data-vfx-skin="celestial"]')
    last.focus()
    before=page.locator('.vfx-showcase').evaluate('(el) => el.scrollTop')
    page.keyboard.press('Enter')
    focused=page.evaluate("document.activeElement?.getAttribute('data-vfx-skin')")
    after=page.locator('.vfx-showcase').evaluate('(el) => el.scrollTop')
    assert focused=='celestial',(engine,w,h,'catalog keyboard focus lost',focused)
    card=page.locator('.vfx-showcase').bounding_box()
    control=page.locator('[data-vfx-skin="celestial"]').bounding_box()
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
