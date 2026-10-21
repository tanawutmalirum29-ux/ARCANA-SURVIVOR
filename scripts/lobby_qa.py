"""Independent lobby/campaign integration gate on an actual HTTP origin.

The layout matrix uses ordinary clicks and keyboard input. Transaction tests
use explicitly labelled reducer fixtures, real IndexedDB, and separate pages;
they do not claim physical phone, complete combat, or backend security evidence.
"""
import argparse
import json
import os
from playwright.sync_api import sync_playwright, expect

ORIGIN = os.environ.get('ARCANA_QA_URL', 'http://127.0.0.1:4173')
SIZES = [(320, 568), (390, 844), (768, 1024), (844, 390), (1440, 900)]
TABS = ['shop', 'hero', 'adventure', 'growth', 'events']

SETUP = """async () => {
  const [storage, core, legacy] = await Promise.all([
    import('/src/campaignStore.js'), import('/src/progression/index.js'),
    import('/src/storage.js')
  ]);
  const store = storage.createCampaignStore();
  window.__qa = {storage, core, legacy, store, done: true, round: 0};
  window.__qa.raw = async (value, write = false) => {
    const {CAMPAIGN_DB, CAMPAIGN_STORE, CAMPAIGN_KEY} = storage;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(CAMPAIGN_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(CAMPAIGN_STORE))
          request.result.createObjectStore(CAMPAIGN_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CAMPAIGN_STORE, write ? 'readwrite' : 'readonly');
        const objectStore = tx.objectStore(CAMPAIGN_STORE);
        const request = write ? objectStore.put(value, CAMPAIGN_KEY) : objectStore.get(CAMPAIGN_KEY);
        let result;
        request.onsuccess = () => {result = request.result;};
        tx.oncomplete = () => resolve(result === undefined ? null : result);
        tx.onabort = () => reject(tx.error || Error('Raw transaction aborted'));
      });
    } finally {db.close();}
  };
  window.__qa.channel = new BroadcastChannel('arcana-campaign-independent-qa');
  window.__qa.channel.onmessage = event => {
    if (event.data?.round !== window.__qa.round) return;
    window.__qa.store.dispatch(...window.__qa.armed).then(result => {
      window.__qa.result = result;
      window.__qa.done = true;
    }).catch(error => {
      window.__qa.result = {ok:false, code:'UNEXPECTED_REJECTION', message:String(error)};
      window.__qa.done = true;
    });
  };
  return await store.load();
}"""


def capture(page, engine, size, phase, error):
    record = {'browser': engine, 'viewport': list(size), 'phase': phase,
              'error': str(error)}
    try:
        record['dom'] = page.evaluate("""() => ({
          width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth,
          focus:document.activeElement?.outerHTML.slice(0,500),
          panel:document.querySelector('[data-lobby-panel]')?.getAttribute('data-lobby-panel'),
          alerts:[...document.querySelectorAll('[role="alert"], [data-save-error]')].map(x=>x.textContent),
          text:document.body.innerText.slice(0,2500)
        })""")
        path = f'/tmp/arcana-lobby-failure-{engine}-{size[0]}x{size[1]}-{phase}.png'
        page.screenshot(path=path, timeout=5000)
        record['screenshot'] = path
    except Exception as probe_error:
        record['probe_error'] = str(probe_error)
    print('LOBBY_QA_FAILURE ' + json.dumps(record, ensure_ascii=False), flush=True)


def visible_hit_target(page, selector, size, minimum=44):
    box = page.locator(selector).bounding_box()
    width, height = size
    assert box, ('missing target', selector)
    assert box['x'] >= -1 and box['y'] >= -1, (selector, box)
    assert box['x']+box['width'] <= width+1 and box['y']+box['height'] <= height+1, (selector, box, size)
    assert box['width'] >= minimum and box['height'] >= minimum, ('small touch target', selector, box)
    assert page.locator(selector).evaluate("""el => {
      const r=el.getBoundingClientRect();
      const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return !!top && (top===el || el.contains(top));
    }"""), ('obstructed target', selector)


def layout(browser, engine, size):
    width, height = size
    context = browser.new_context(viewport={'width':width, 'height':height},
                                  has_touch=width<1000, is_mobile=width<1000)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type=='error' else None)
    phase = 'boot'
    try:
        page.goto(ORIGIN, wait_until='networkidle')
        page.locator('[data-lobby-tab="adventure"]').wait_for()
        assert page.locator('[data-lobby-tab]').count() == 5
        assert page.locator('select').count() == 0, 'native select in game lobby'
        for tab in TABS:
            phase = tab
            selector = f'[data-lobby-tab="{tab}"]'
            visible_hit_target(page, selector, size)
            page.locator(selector).click()
            expect(page.locator(selector)).to_have_attribute('aria-current', 'page')
            expect(page.locator(f'[data-lobby-panel="{tab}"]')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), ('horizontal overflow', tab)
            for target in TABS:
                visible_hit_target(page, f'[data-lobby-tab="{target}"]', size)
            if size in [(390,844),(1440,900)]:
                page.screenshot(path=f'/tmp/arcana-lobby-{engine}-{width}x{height}-{tab}.png')
        phase = 'keyboard'
        page.locator('[data-lobby-tab="adventure"]').focus()
        page.keyboard.press('Enter')
        expect(page.locator('[data-lobby-panel="adventure"]')).to_be_visible()
        visible_hit_target(page, '[data-action="start"]', size)
        page.locator('[data-lobby-tab="hero"]').focus()
        page.keyboard.press('Space')
        expect(page.locator('[data-lobby-panel="hero"]')).to_be_visible()
        phase = 'settings-return'
        page.locator('[data-action="settings"]').click()
        page.locator('[data-action="back"]').click()
        expect(page.locator('[data-lobby-panel="hero"]')).to_be_visible()
        assert not errors, errors
        print('PASS', engine, f'{width}x{height}', 'five tabs, hit targets, overflow, keyboard, settings return', flush=True)
    except Exception as error:
        capture(page, engine, size, phase, error)
        raise
    finally:
        context.close()


def stored(page):
    return page.evaluate('() => window.__qa.raw()')


def command_target(page, command_type, fields=None):
    """Choose by the public command payload, then perform an ordinary click."""
    fields=fields or {}
    buttons=page.locator(f'[data-command="{command_type}"]')
    for index, payload in enumerate(buttons.evaluate_all("nodes=>nodes.map(node=>node.dataset.payload)")):
        command=json.loads(payload)
        if all(command.get(key)==value for key,value in fields.items()):
            return buttons.nth(index)
    raise AssertionError(('missing command control',command_type,fields))


def ui_command(page, command_type, fields=None, confirm=False):
    before=stored(page)
    target=command_target(page,command_type,fields)
    expect(target).to_be_enabled()
    target.click()
    if confirm:
        command_target(page,command_type,fields).click()
    page.wait_for_function("""async revision=>{
      const result=await window.__qa.store.load();
      return result.ok && result.state.revision>revision;
    }""",arg=before['revision'])
    expect(page.locator('.lb-saving')).to_have_count(0)
    after=stored(page)
    assert after['revision']==before['revision']+1,('one gesture caused multiple commands',command_type)
    return after


def close_modal(page):
    page.locator('[data-action="close-modal"]').click()
    expect(page.locator('[role="dialog"]')).to_have_count(0)


def progression_ui(browser,engine):
    """Fixture unlocks content; every listed action below uses the real UI."""
    size=(390,844)
    context=browser.new_context(viewport={'width':size[0],'height':size[1]},has_touch=True,is_mobile=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    phase='progression-fixture'
    try:
        page.goto(ORIGIN,wait_until='networkidle')
        assert page.evaluate(SETUP)['ok']
        fixture=page.evaluate("""async()=>{
          const state=(await window.__qa.store.load()).state;
          state.profile.gold=900000;state.profile.runs=30;
          state.progression.materials={essence:900000,research:900000,dust:900000};
          state.progression.cleared=window.__qa.core.CHAPTERS.map(chapter=>chapter.id);
          state.progression.relics.compass.fragments=10;
          if(!window.__qa.core.validateCampaign(state))throw Error('Invalid unlocked UI fixture');
          await window.__qa.raw(state,true);
          return state;
        }""")
        page.reload(wait_until='networkidle')
        assert page.evaluate(SETUP)['ok']
        page.locator('[data-lobby-tab="hero"]').click()
        page.locator('[data-subtab="forge"][data-scope="hero"]').click()
        phase='craft-fuse-equip'
        created=[]
        for _ in range(3):
            before=stored(page)
            after=ui_command(page,'CRAFT_ITEM',{'definitionId':'star_wand'})
            created.extend(item['id'] for item in after['progression']['inventory']
                           if item['id'] not in {entry['id'] for entry in before['progression']['inventory']})
        assert len(created)==3
        page.locator('[data-subtab="equipment"][data-scope="hero"]').click()
        page.locator(f'[data-action="item"][data-id="{created[0]}"]').click()
        assert page.locator('[role="dialog"]').count()==1
        # Modal focus trap and keyboard close must keep focus inside / return it.
        page.locator('[data-action="close-modal"]').focus()
        page.keyboard.press('Shift+Tab')
        assert page.evaluate("document.activeElement.closest('[role=dialog]')!==null")
        page.keyboard.press('Escape')
        expect(page.locator('[role="dialog"]')).to_have_count(0)
        assert page.evaluate('document.activeElement?.dataset.id')==created[0]
        page.locator(f'[data-action="item"][data-id="{created[0]}"]').click()
        ui_command(page,'UPGRADE_ITEM',{'itemId':created[0]})
        page.locator('[data-action="fusion"]').click()
        for item_id in created[1:]:
            page.locator(f'[data-action="fusion-select"][data-id="{item_id}"]').click()
        fused=ui_command(page,'FUSE_ITEMS',{'itemIds':created},confirm=True)
        item=next(entry for entry in fused['progression']['inventory'] if entry['id']==created[0])
        assert item['rarity']==1 and item['level']==2
        assert all(item_id not in {entry['id'] for entry in fused['progression']['inventory']} for item_id in created[1:])
        equipped=ui_command(page,'EQUIP_ITEM',{'itemId':created[0],'slot':'weapon'})
        assert equipped['progression']['equipment']['weapon']==created[0]
        close_modal(page)
        page.locator('[data-subtab="presets"][data-scope="hero"]').click()
        ui_command(page,'SAVE_PRESET',{'index':0})
        phase='growth-effects'
        page.locator('[data-lobby-tab="growth"]').click()
        ui_command(page,'UPGRADE_TALENT',{'talentId':'power'})
        page.locator('[data-subtab="relics"][data-scope="growth"]').click()
        ui_command(page,'UNLOCK_RELIC',{'relicId':'compass'})
        ui_command(page,'UPGRADE_RELIC',{'relicId':'compass'})
        page.locator('[data-subtab="runes"][data-scope="growth"]').click()
        for rune_id,slot in [('power','attack'),('guard','defense'),('haste','utility')]:
            ui_command(page,'UPGRADE_RUNE',{'runeId':rune_id})
            after=ui_command(page,'EQUIP_RUNE',{'runeId':rune_id,'slot':slot})
            assert after['progression']['runes']['equipped'][slot]==rune_id
        page.locator('[data-subtab="jewels"][data-scope="growth"]').click()
        ui_command(page,'UPGRADE_JEWEL',{'jewelId':'ruby'})
        page.locator('[data-action="jewel"][data-id="ruby"]').click()
        ui_command(page,'EQUIP_JEWEL',{'jewelId':'ruby','slot':'weapon'})
        close_modal(page)
        for tab,kind,item_id in [('artifacts','ARTIFACT','hourglass'),
                                 ('companions','COMPANION','wisp'),
                                 ('guardians','GUARDIAN','phoenix')]:
            page.locator(f'[data-subtab="{tab}"][data-scope="growth"]').click()
            field=kind.lower()+'Id'
            ui_command(page,'UPGRADE_'+kind,{field:item_id})
            ui_command(page,'EQUIP_'+kind,{field:item_id})
        page.locator('[data-subtab="research"][data-scope="growth"]').click()
        ui_command(page,'UPGRADE_RESEARCH',{'researchId':'sigils'})
        page.locator('[data-subtab="homestead"][data-scope="growth"]').click()
        ui_command(page,'UPGRADE_BUILDING',{'buildingId':'garden'})
        phase='denied-write-ui'
        before=stored(page)
        page.evaluate("""()=>{
          window.__qaPut=IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put=function(...args){
            if(this.name===window.__qa.storage.CAMPAIGN_STORE)
              throw new DOMException('Test quota exhausted','QuotaExceededError');
            return window.__qaPut.apply(this,args);
          };
        }""")
        command_target(page,'UPGRADE_BUILDING',{'buildingId':'garden'}).click()
        expect(page.locator('.lb-notice[role="alert"]')).to_be_visible()
        expect(page.locator('.lb-saving')).to_have_count(0)
        assert stored(page)==before,'failed UI save changed durable resources'
        page.evaluate('IDBObjectStore.prototype.put=window.__qaPut')
        ui_command(page,'UPGRADE_BUILDING',{'buildingId':'garden'})
        phase='snapshot-to-combat'
        page.locator('[data-lobby-tab="hero"]').click()
        page.locator('[data-subtab="heroes"][data-scope="hero"]').click()
        ui_command(page,'UNLOCK_HERO',{'heroId':'guardian'})
        ui_command(page,'SELECT_HERO',{'heroId':'guardian'})
        page.locator('[data-lobby-tab="adventure"]').click()
        page.locator('[data-action="start"]').click()
        expect(page.locator('#overlay')).to_be_hidden()
        active=stored(page)['progression']['activeRun']
        assert active['runConfig']['heroId']=='guardian'
        assert active['runConfig']['artifact']['id']=='hourglass'
        assert active['runConfig']['companions'][0]['id']=='wisp'
        max_hp=active['runConfig']['stats']['maxHp']
        assert int(page.locator('#hp-text').inner_text().split('/')[-1].strip())==max_hp
        page.locator('#pause-btn').click()
        page.locator('[data-action="home"]').click()
        expect(page.locator('[data-lobby-panel="adventure"]')).to_be_visible()
        phase='earned-claims-and-shop'
        # Fixture completion is clearly separate from the actual configured
        # start above; mission/Chronicle/homestead claims still use UI buttons.
        finish=page.evaluate("""runId=>window.__qa.store.dispatch({type:'FINISH_RUN',
          runId,stats:{kills:150,seconds:600,won:true}})""",active['id'])
        assert finish['ok'],finish
        page.reload(wait_until='networkidle')
        assert page.evaluate(SETUP)['ok']
        page.locator('[data-lobby-tab="events"]').click()
        after=ui_command(page,'CLAIM_MISSION',{'missionId':'first_run'})
        assert 'first_run' in after['progression']['missions']['claimed']
        expect(command_target(page,'CLAIM_MISSION',{'missionId':'first_run'})).to_be_disabled()
        page.locator('[data-subtab="season"][data-scope="events"]').click()
        after=ui_command(page,'CLAIM_SEASON',{'tier':1})
        assert 1 in after['progression']['season']['claimed']
        expect(command_target(page,'CLAIM_SEASON',{'tier':1})).to_be_disabled()
        page.locator('[data-lobby-tab="growth"]').click()
        page.locator('[data-subtab="homestead"][data-scope="growth"]').click()
        after=ui_command(page,'CLAIM_HOMESTEAD')
        assert all(value==0 for value in after['progression']['homestead']['pending'].values())
        expect(command_target(page,'CLAIM_HOMESTEAD')).to_be_disabled()
        page.locator('[data-lobby-tab="shop"]').click()
        before=stored(page)
        after=ui_command(page,'BUY_OFFER',{'offerId':'essence_bundle'})
        assert after['profile']['gold']==before['profile']['gold']-60
        assert after['progression']['materials']['essence']==before['progression']['materials']['essence']+12
        assert not errors,errors
        print('PASS',engine,'real UI craft/upgrade/fuse/equip/preset, talents/relics/three rune slots/jewel/artifact/companion/guardian/research/homestead, denied save+retry, configured start, mission/Chronicle/homestead claims, earned shop',flush=True)
    except Exception as error:
        capture(page,engine,size,phase,error)
        raise
    finally:
        context.close()


def race(a, b, barrier, number, command_a, command_b, options=None):
    for page, command in [(a,command_a), (b,command_b)]:
        page.evaluate("""([round,command,options]) => {
          window.__qa.round=round;
          window.__qa.armed=[command,options||{}];
          window.__qa.done=false;
        }""", [number,command,options])
    barrier.evaluate('round => window.__qa.channel.postMessage({round})', number)
    for page in (a,b):
        page.wait_for_function('window.__qa.done===true', timeout=15000)
    return [page.evaluate('window.__qa.result') for page in (a,b)]


def transaction_checks(browser, engine):
    context = browser.new_context(viewport={'width':390, 'height':844})
    pages = [context.new_page() for _ in range(3)]
    a,b,barrier = pages
    try:
        for page in pages:
            page.goto(ORIGIN, wait_until='networkidle')
            assert page.evaluate(SETUP)['ok']
        # Rich valid fixture isolates writer correctness from content balance.
        # It is not an assertion that these resources were earned in combat.
        fixture = a.evaluate("""async () => {
          const state=(await window.__qa.store.load()).state;
          state.profile.gold=900000;
          state.profile.runs=30;
          state.progression.materials={essence:900000,research:900000,dust:900000};
          if(!window.__qa.core.validateCampaign(state)) throw Error('Invalid QA fixture');
          await window.__qa.raw(state,true);
          return state;
        }""")
        definition = fixture['progression']['inventory'][0]['definitionId']
        crafted = {'type':'CRAFT_ITEM', 'definitionId':definition}
        expected = fixture
        for number in range(1,13):
            results = race(a,b,barrier,number,crafted,crafted)
            assert all(result['ok'] for result in results), results
            expected = a.evaluate("""([state,command]) => {
              for(let n=0;n<2;n++){
                const result=window.__qa.core.applyCommand(state,command);
                if(!result.ok)throw Error(result.code);
                state=result.state;
              }
              return state;
            }""", [expected,crafted])
            durable = stored(barrier)
            assert durable == expected, ('lost concurrent inventory/wallet update', number)
            ids = [item['id'] for item in durable['progression']['inventory']]
            assert len(ids)==len(set(ids)), ('duplicate instance identity', ids)
        before = stored(barrier)
        item_id = before['progression']['inventory'][0]['id']
        upgrade = {'type':'UPGRADE_ITEM','itemId':item_id}
        results = race(a,b,barrier,13,upgrade,upgrade,{'expectedRevision':before['revision']})
        assert sum(result['ok'] for result in results)==1, results
        assert sorted(result['code'] for result in results if not result['ok'])==['STALE_STATE'], results
        assert stored(barrier)['revision']==before['revision']+1
        # Abort after a real put was staged. The complete wallet/inventory
        # snapshot must roll back, and a retry must spend only once.
        before = stored(barrier)
        aborted = a.evaluate("""async command => {
          const native=IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put=function(...args){
            const result=native.apply(this,args);
            if(this.name===window.__qa.storage.CAMPAIGN_STORE)this.transaction.abort();
            return result;
          };
          try{return await window.__qa.store.dispatch(command);}
          finally{IDBObjectStore.prototype.put=native;}
        }""", upgrade)
        assert not aborted['ok'] and aborted['code']=='WRITE_FAILED', aborted
        assert stored(barrier)==before, 'aborted write changed wallet/inventory'
        assert a.evaluate('command => window.__qa.store.dispatch(command)', upgrade)['ok']
        assert stored(barrier)['revision']==before['revision']+1
        # Same run completion from two real tabs must grant the entire bundle
        # and stable replay marker once, including after page reload.
        started = a.evaluate("""() => window.__qa.store.dispatch({type:'START_RUN',
          day:new Date().toISOString().slice(0,10)})""")
        assert started['ok'], started
        completion = {'type':'FINISH_RUN','runId':started['details']['runId'],
                      'stats':{'kills':150,'seconds':600,'won':True}}
        results = race(a,b,barrier,14,completion,completion)
        assert sum(result['ok'] for result in results)==1, results
        assert [result['code'] for result in results if not result['ok']]==['ALREADY_CLAIMED'], results
        durable = stored(barrier)
        assert durable['profile']['runs']==started['state']['profile']['runs']+1
        assert durable['progression']['activeRun'] is None
        for page in pages:
            page.reload(wait_until='networkidle')
            assert page.evaluate(SETUP)['state']==durable
            replay = page.evaluate('command => window.__qa.store.dispatch(command)',completion)
            assert not replay['ok'] and replay['code']=='ALREADY_CLAIMED', replay
        assert stored(barrier)==durable
        print('PASS',engine,'real three-page IndexedDB: 12 simultaneous craft rounds, stale revision, staged-write abort, reward replay, reload',flush=True)
    except Exception as error:
        capture(a,engine,(390,844),'transactions',error)
        raise
    finally:
        context.close()


def migration_checks(browser, engine):
    legacy = {'version':1,'gold':877,'totalKills':31,'runs':12,'bestSeconds':540,
              'skin':'moon','owned':['apprentice','moon'],
              'settings':{'vfx':'low','reduceMotion':True}}
    raw = json.dumps(legacy,separators=(',',':'))
    context = browser.new_context()
    page = context.new_page()
    try:
        context.add_init_script("if(localStorage.getItem('arcana-survivor-v1')===null) localStorage.setItem('arcana-survivor-v1',"+json.dumps(raw)+");")
        page.goto(ORIGIN,wait_until='networkidle')
        expect(page.locator('[data-action="start"]')).to_be_visible()
        loaded=page.evaluate(SETUP)
        assert loaded['ok'] and loaded['state']['profile']==legacy, loaded
        first=stored(page)
        assert len(first['progression']['inventory'])==2, 'starter grant count'
        for _ in range(2):
            page.reload(wait_until='networkidle')
            assert page.evaluate(SETUP)['state']==first, 'migration repeated a grant or changed progress'
            assert page.evaluate("localStorage.getItem('arcana-survivor-v1')")==raw
        print('PASS',engine,'legacy profile exact preservation, original bytes, starter once, reload',flush=True)
    finally:
        context.close()
    for raw in ['{broken', 'null', '{"version":999}', '{"version":1,"gold":-1}']:
        context=browser.new_context()
        page=context.new_page()
        try:
            context.add_init_script("localStorage.setItem('arcana-survivor-v1',"+json.dumps(raw)+");")
            page.goto(ORIGIN,wait_until='networkidle')
            result=page.evaluate(SETUP)
            assert not result['ok'], ('invalid legacy accepted',raw,result)
            assert page.evaluate("localStorage.getItem('arcana-survivor-v1')")==raw
            assert stored(page) is None, 'invalid legacy initialized a default campaign'
            expect(page.locator('[data-action="start"]')).to_have_count(0)
            expect(page.locator('[data-save-error]')).to_be_visible()
        finally:
            context.close()
    for fault in [None, {'schemaVersion':999,'valuableFutureProgress':4711}, {'schemaVersion':2,'revision':0}]:
        context=browser.new_context()
        page=context.new_page()
        try:
            page.goto(ORIGIN,wait_until='networkidle')
            assert page.evaluate(SETUP)['ok']
            page.evaluate('value => window.__qa.raw(value,true)',fault)
            page.reload(wait_until='networkidle')
            result=page.evaluate(SETUP)
            assert not result['ok'], ('invalid v2 accepted',fault,result)
            assert stored(page)==fault, 'invalid v2 was overwritten'
            expect(page.locator('[data-action="start"]')).to_have_count(0)
            expect(page.locator('[data-save-error]')).to_be_visible()
        finally:
            context.close()
    context=browser.new_context()
    page=context.new_page()
    try:
        context.add_init_script("""const original=Storage.prototype.getItem;
          Storage.prototype.getItem=function(key){
            if(key==='arcana-survivor-v1')throw new DOMException('Denied','SecurityError');
            return original.call(this,key);
          };""")
        page.goto(ORIGIN,wait_until='networkidle')
        result=page.evaluate(SETUP)
        assert not result['ok'] and result['code']=='LEGACY_READ_FAILED',result
        assert stored(page) is None
        expect(page.locator('[data-save-error]')).to_be_visible()
        expect(page.locator('[data-action="start"]')).to_have_count(0)
    finally:
        context.close()
    context=browser.new_context()
    page=context.new_page()
    try:
        context.add_init_script("""Object.defineProperty(window,'indexedDB',{
          configurable:true,get(){throw new DOMException('Denied','SecurityError');}
        });""")
        page.goto(ORIGIN,wait_until='networkidle')
        result=page.evaluate(SETUP)
        assert not result['ok'] and result['code']=='STORAGE_UNAVAILABLE',result
        expect(page.locator('[data-save-error="STORAGE_UNAVAILABLE"]')).to_be_visible()
        expect(page.locator('[data-action="start"]')).to_have_count(0)
    finally:
        context.close()
    print('PASS',engine,'malformed/future/null/read-denied saves blocked and preserved',flush=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--browsers',nargs='+',choices=['chromium','webkit'],default=['chromium','webkit'])
    args=parser.parse_args()
    with sync_playwright() as playwright:
        for engine in args.browsers:
            for size in SIZES:
                browser=getattr(playwright,engine).launch(headless=True)
                try:layout(browser,engine,size)
                finally:browser.close()
            browser=getattr(playwright,engine).launch(headless=True)
            try:
                migration_checks(browser,engine)
                transaction_checks(browser,engine)
                progression_ui(browser,engine)
            finally:browser.close()
    print('LOBBY QA COMPLETE:',len(args.browsers)*len(SIZES),'layout combinations + both-browser migration/transaction gates',flush=True)


if __name__=='__main__':
    main()
