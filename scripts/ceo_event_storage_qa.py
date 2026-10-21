"""CEO Events v2 localStorage real-origin smoke; not Events UI or physical-device QA."""
import os
from playwright.sync_api import sync_playwright

ORIGIN=os.environ.get('ARCANA_QA_URL','http://127.0.0.1:4173')
SIZES=[(320,568),(844,390)]
async_probe="""async () => {
  const {createEventLocalStorage, EVENT_V2_LOCAL_KEY:key}
    = await import('/src/integration/eventLocalStorage.js');
  const {prepareStoredEventState,commitStoredEventTransition}
    = await import('/src/integration/eventV2Store.js');
  const {advanceEventProgress}=await import('/src/events/core.js');
  const catalog=await (await fetch('/src/content/events/s01_events.json')).json();
  localStorage.removeItem(key);
  const store=createEventLocalStorage({storage:localStorage});
  const initial=prepareStoredEventState({store});
  if(!initial.ok||initial.status!=='INITIALIZED')throw Error('missing-key init failed');
  const event=id=>({eventId:id,runId:'browser:run',tick:100,type:'RUN_FINISHED',payload:{}});
  const send=(id,utc)=>commitStoredEventTransition({
    store, transition:s=>advanceEventProgress(s,event(id),catalog,utc)
  });
  const first=send('browser:stable','2030-01-13T23:59:59.999Z');
  if(!first.ok||first.state.seenEventIds.length!==1)throw Error('first event');
  const replay=send('browser:stable','2030-01-14T00:00:00.000Z');
  if(!replay.ok||replay.state.seenEventIds.length!==1)throw Error('replay duplication');
  if(Object.keys(replay.state.progress).filter(k=>k.startsWith('event_arcane_orders@')).length!==1)
    throw Error('cross-day duplicate progress');
  const newSignal=send('browser:unique','2030-01-14T00:00:00.000Z');
  if(!newSignal.ok||newSignal.state.seenEventIds.length!==2)throw Error('new signal lost');
  const saved=localStorage.getItem(key);
  localStorage.setItem(key,'{');
  if(prepareStoredEventState({store}).status!=='READ_FAILED'||localStorage.getItem(key)!=='{')
    throw Error('corrupt persisted JSON erased');
  localStorage.setItem(key,'null');
  if(prepareStoredEventState({store}).status!=='READ_FAILED'||localStorage.getItem(key)!=='null')
    throw Error('existing null JSON mistaken for missing key');
  localStorage.setItem(key,saved);
  const quotaStore=createEventLocalStorage({storage:{
    getItem:k=>localStorage.getItem(k),
    setItem:()=>{throw Error('Quota exceeded')}
  }});
  const failed=commitStoredEventTransition({store:quotaStore,transition:s=>
    advanceEventProgress(s,event('never-written'),catalog,'2030-01-14T00:00:00.000Z')});
  if(failed.ok||failed.status!=='WRITE_FAILED'||localStorage.getItem(key)!==saved)
    throw Error('quota failure corrupted save');
  const lostRead=createEventLocalStorage({storage:{
    getItem:()=>undefined,setItem:()=>{throw Error('must not write')}
  }});
  if(prepareStoredEventState({store:lostRead}).status!=='READ_FAILED')
    throw Error('lost read silently initialized');
  return {key,replayCount:newSignal.state.seenEventIds.length,failed:failed.status};
}"""
reload_probe="""async () => {
 const {createEventLocalStorage, EVENT_V2_LOCAL_KEY:key}
  = await import('/src/integration/eventLocalStorage.js');
 const {prepareStoredEventState}=await import('/src/integration/eventV2Store.js');
 const found=prepareStoredEventState({store:createEventLocalStorage({storage:localStorage})});
 if(found.status!=='LOADED'||found.state.seenEventIds.length!==2)
   throw Error('durable localStorage reload failed');
 return found.state.seenEventIds;
}"""
with sync_playwright() as p:
    for engine in ['chromium','webkit']:
        browser=getattr(p,engine).launch(headless=True)
        try:
            for w,h in SIZES:
                page=browser.new_page(viewport={'width':w,'height':h},has_touch=True,is_mobile=True)
                errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(ORIGIN,wait_until='networkidle')
                got=page.evaluate(async_probe)
                page.reload(wait_until='networkidle')
                after=page.evaluate(reload_probe)
                assert after==['browser:stable','browser:unique'],(engine,w,h,after)
                assert not errors,(engine,w,h,errors)
                print('PASS',engine,f'{w}x{h}',got['failed'],'cross-UTC replay, read-failure, reload')
                page.close()
        finally:
            browser.close()
print('EVENT LOCALSTORAGE BROWSER QA COMPLETE: 4')
