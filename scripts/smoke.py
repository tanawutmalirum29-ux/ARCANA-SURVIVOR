from playwright.sync_api import sync_playwright
from pathlib import Path
from base64 import b64encode
sizes=[(320,568),(390,844),(768,1024),(844,390),(1440,900)]
root=Path(__file__).resolve().parents[1]
def js_url(source): return 'data:text/javascript;base64,'+b64encode(source.encode()).decode()
engine=js_url((root/'src/engine.js').read_text())
storage=js_url((root/'src/storage.js').read_text())
render=js_url((root/'src/render.js').read_text().replace("from './engine.js'",f"from '{engine}'").replace("from './storage.js'",f"from '{storage}'"))
main=js_url((root/'src/main.js').read_text().replace("from './engine.js'",f"from '{engine}'").replace("from './render.js'",f"from '{render}'").replace("from './storage.js'",f"from '{storage}'"))
html=(root/'index.html').read_text().replace('<link rel="stylesheet" href="./src/styles.css" />','<style>'+(root/'src/styles.css').read_text()+'</style>').replace('<script type="module" src="./src/main.js"></script>','')
with sync_playwright() as p:
 for browser_type in [p.chromium]:
  try:b=browser_type.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox","--allow-file-access-from-files","--disable-web-security"])
  except Exception as e: print(browser_type.name,'launch failure',str(e)[:100]);continue
  for w,h in sizes:
   page=b.new_page(viewport={'width':w,'height':h}, device_scale_factor=1)
   errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
   page.set_content(html);page.add_script_tag(type='module',content=f'import \"{main}\"');page.wait_for_timeout(500)
   title=page.locator('.lobby h1').inner_text();card=page.locator('.main-card').bounding_box()
   assert 0<=card['x'] and card['x']+card['width']<=w+1 and card['y']>=0 and card['y']+card['height']<=h+1,(browser_type.name,w,h,card)
   page.locator('[data-action="start"]').click();page.wait_for_timeout(170)
   assert page.locator('#overlay').is_hidden()
   assert page.locator('#hud').is_visible()
   rects=page.evaluate('''() => ["#hud","#joystick","#pause-btn"].map(s=>{let r=document.querySelector(s).getBoundingClientRect();return {s,x:r.x,y:r.y,right:r.right,bottom:r.bottom}})''')
   assert all(r['x']>=-1 and r['right']<=w+1 and r['y']>=-1 and r['bottom']<=h+1 for r in rects),(browser_type.name,w,h,rects)
   page.locator('#pause-btn').click();assert page.get_by_text('PAUSED',exact=True).count()==1
   page.locator('[data-action="resume"]').click();assert page.locator('#overlay').is_hidden()
   page.locator('#pause-btn').click();page.locator('[data-action="home"]').click();page.locator('[data-action="wardrobe"]').click();assert page.locator('.skin-card').count()==3
   if w==390 and h==844 and browser_type.name=='chromium':
    page.locator('[data-action="home"]').click();page.screenshot(path='/mnt/data/arcana-work/lobby-390.png')
    page.locator('[data-action="start"]').click();page.screenshot(path='/mnt/data/arcana-work/arena-390.png')
   assert not errors,(browser_type.name,w,h,errors)
   print('PASS',browser_type.name,f'{w}x{h}','controls/HUD/lobby/wardrobe/pause')
   page.close()
  b.close()
