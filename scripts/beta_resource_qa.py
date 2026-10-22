"""Beta-only economy test kit: real shop clicks + authoritative IndexedDB persistence.
No mock wallets, direct DB writes, physical-device claims or premium payments.
"""
import os
from playwright.sync_api import sync_playwright, expect

ORIGIN=os.environ.get('ARCANA_QA_URL','http://127.0.0.1:4173')
VIEWPORTS=[(320,568),(390,844),(768,1024),(844,390),(1440,900)]

READ_SAVE="""async () => {
 const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open('arcana-campaign-v2',1);
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
 try {
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction('campaign','readonly');
   const request=tx.objectStore('campaign').get('profile');
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
 } finally{db.close();}
}"""

def check(browser,engine,w,h):
    page=browser.new_page(viewport={'width':w,'height':h},is_mobile=w<1000,has_touch=w<1000)
    errors=[]
    page.on('pageerror',lambda exc: errors.append(str(exc)))
    try:
        response=page.goto(ORIGIN,wait_until='domcontentloaded')
        assert response and response.status==200,(engine,w,h,'HTTP')
        shop=page.locator('[data-lobby-tab="shop"]')
        expect(shop).to_be_visible(timeout=15000)
        initial=page.evaluate(READ_SAVE)
        assert initial['profile']['gold']==0,(engine,w,h,'fresh save unexpectedly funded')
        shop.click()
        kit=page.locator('[data-beta-test-kit="true"]')
        expect(kit).to_be_visible()
        assert 'BETA TEST ONLY' in kit.inner_text()
        grant=kit.locator('[data-command="BETA_TEST_REFILL"]')
        expect(grant).to_be_enabled()
        grant.click()
        confirm=page.locator('.lb-modal [data-command="BETA_TEST_REFILL"]')
        expect(confirm).to_be_visible()
        confirm.click()
        expect(page.locator('[data-beta-test-kit]')).to_be_visible()
        state=page.evaluate(READ_SAVE)
        assert state['profile']['gold']==500000,(engine,w,h,'gold not persisted')
        for key in ('essence','research','dust'):
            assert state['progression']['materials'][key]==500000,(engine,w,h,key)
        assert state['profile']['runs']==5,(engine,w,h,'beta feature access missing')
        gear=state['progression']['inventory']
        assert len(gear)>10 and len({x['id'] for x in gear})==len(gear)
        assert state['profile']['owned']==['apprentice'],'unintended cosmetics'
        assert state['progression']['claimed']==[],'unintended reward claims'
        assert state['progression']['missions']['stats']['runs']==0,'fabricated real wins'
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('[data-lobby-tab="shop"]')).to_be_visible(timeout=15000)
        saved=page.evaluate(READ_SAVE)
        assert saved['profile']['gold']==500000,'reloaded gold reverted'
        assert saved['progression']['inventory']==gear,'inventory changed across reload'
        assert not errors,(engine,w,h,errors)
        print('PASS BETA_KIT',engine,f'{w}x{h}',f'gold={saved["profile"]["gold"]}',f'gear={len(gear)}',flush=True)
    finally: page.close()

if __name__=='__main__':
 with sync_playwright() as playwright:
    for engine in ('chromium','webkit'):
        browser=getattr(playwright,engine).launch(headless=True)
        try:
            for w,h in VIEWPORTS:check(browser,engine,w,h)
        finally:browser.close()
 print('BETA_KIT 10 browser/viewport combinations: REAL SHOP + INDEXEDDB PERSISTENCE PASS')
