"""Exercise two REAL same-origin browser tabs contending for a dormant Events v2 Web Lock.

Requires exclusive Web Locks. Unsupported browsers must fail closed and report HOLD,
never make an unlocked mutation. No game Events UI or real paid privileges.
"""
import os
from playwright.sync_api import sync_playwright

ORIGIN=os.environ.get('ARCANA_QA_URL','http://127.0.0.1:4173')
SIZES=[(320,568),(844,390)]
SETUP="""async () => {
 const [writer,local,core]=await Promise.all([
   import('/src/integration/eventExclusiveWriter.js'),
   import('/src/integration/eventLocalStorage.js'),
   import('/src/events/core.js')
 ]);
 const catalog=await (await fetch('/src/content/events/s01_events.json')).json();
 window.__ctx={writer,local,core,catalog};
 window.__launch=(id,utc,claimId=null)=>{
   window.__done=false;
   const store=local.createEventLocalStorage({storage:localStorage});
   const transition=claimId?
     s=>core.claimEventReward(s,claimId,utc):
     s=>core.advanceEventProgress(
       s,{eventId:id,runId:'real-tab-test',tick:600,type:'RUN_FINISHED',payload:{}},
       catalog,utc);
   window.__completion=writer.commitExclusiveEventTransition({store,transition})
      .then(result=>{window.__result=result;window.__done=true;return result})
      .catch(error=>{window.__result={ok:false,status:'UNEXPECTED',reason:String(error)};
         window.__done=true});
   return 'QUEUED';
 };
 return !!navigator.locks?.request;
}"""
def check(browser,engine,w,h):
    context=browser.new_context(viewport={'width':w,'height':h},
                                has_touch=True,is_mobile=True)
    try:
        a=context.new_page()
        b=context.new_page()
        for page in (a,b):
            page.goto(ORIGIN,wait_until='networkidle')
        support_a=a.evaluate(SETUP)
        support_b=b.evaluate(SETUP)
        assert support_a == support_b,(engine,w,h,'capability mismatch')
        key='arcana-survivor-events-v2'
        a.evaluate("(key)=>localStorage.removeItem(key)",key)
        if not support_a:
            a.evaluate("window.__launch('disabled', '2030-01-13T23:59:59.999Z')")
            a.wait_for_function("window.__done===true")
            blocked=a.evaluate("window.__result")
            assert blocked['status']=='CROSS_TAB_LOCK_UNAVAILABLE',blocked
            assert a.evaluate("(key)=>localStorage.getItem(key)",key) is None
            print('HOLD_UNSUPPORTED',engine,f'{w}x{h}','no Web Locks; no writes',flush=True)
            return False
        # Hold the exact production Web Locks name in tab A. BOTH real pages
        # start transactions, but neither may persist while A holds the lock.
        a.evaluate("""() => {
          const name=window.__ctx.writer.EVENT_V2_EXCLUSIVE_LOCK;
          window.__hold=navigator.locks.request(name,{mode:'exclusive'},async()=>{
            window.__held=true;
            await new Promise(resolve=>window.__releaseHold=resolve);
          });
        }""")
        a.wait_for_function("window.__held===true")
        a.evaluate("window.__launch('tab:A', '2030-01-13T23:59:59.999Z')")
        b.evaluate("window.__launch('tab:B', '2030-01-14T00:00:00.000Z')")
        assert not a.evaluate("window.__done")
        assert not b.evaluate("window.__done")
        assert a.evaluate("(key)=>localStorage.getItem(key)",key) is None
        a.evaluate("window.__releaseHold()")
        a.wait_for_function("window.__done===true")
        b.wait_for_function("window.__done===true")
        assert a.evaluate("window.__result.status")=='COMMITTED'
        assert b.evaluate("window.__result.status")=='COMMITTED'
        final=a.evaluate("""(key) => JSON.parse(localStorage.getItem(key)).seenEventIds""",key)
        assert len(final)==2 and set(final)=={'tab:A','tab:B'},(engine,w,h,final)
        # A repeat across midnight cannot re-credit the older stable ID.
        b.evaluate("window.__launch('tab:A', '2030-01-14T00:00:00.000Z')")
        b.wait_for_function("window.__done===true")
        seen=b.evaluate("(key)=>JSON.parse(localStorage.getItem(key)).seenEventIds",key)
        assert len(seen)==2 and set(seen)=={'tab:A','tab:B'},(engine,w,h,seen)
        # Two real tabs target the same earned claim, serialized by the lock.
        claimed=a.evaluate("""() => {
          const {core,local}=window.__ctx;
          const state=local.createEventLocalStorage({storage:localStorage}).read();
          return core.listClaimableEventRewards(state,'2030-01-14T00:00:00.000Z')
            .find(item=>item.rewardId.includes('#finish_run'))?.rewardId||null;
        }""")
        assert claimed,(engine,w,h,'no claimable test objective')
        a.evaluate("([id,utc])=>window.__launch('claim:A',utc,id)",
                   [claimed,'2030-01-14T00:00:00.000Z'])
        b.evaluate("([id,utc])=>window.__launch('claim:B',utc,id)",
                   [claimed,'2030-01-14T00:00:00.000Z'])
        a.wait_for_function("window.__done===true")
        b.wait_for_function("window.__done===true")
        claim_outcomes=[a.evaluate("window.__result.result?.status"),
                        b.evaluate("window.__result.result?.status")]
        assert sorted(claim_outcomes)==['CLAIMED','DUPLICATE'],claim_outcomes
        state=a.evaluate("(key)=>JSON.parse(localStorage.getItem(key))",key)
        assert len(state['claims'])==1 and len(state['seenEventIds'])==2
        a.reload(wait_until='networkidle')
        reloaded=a.evaluate("(key)=>JSON.parse(localStorage.getItem(key))",key)
        assert reloaded['seenEventIds']==state['seenEventIds']
        assert reloaded['claims']==state['claims']
        print('PASS',engine,f'{w}x{h}','TWO_REAL_TABS serialized; replay; one claim; reload',flush=True)
        return True
    finally:
        context.close()

passed=0
held=0
with sync_playwright() as p:
    for engine in ['chromium','webkit']:
        browser=getattr(p,engine).launch(headless=True)
        try:
            for w,h in SIZES:
                if check(browser,engine,w,h): passed+=1
                else: held+=1
        finally:
            browser.close()
print(f'EXCLUSIVE EVENT REAL-TAB BROWSER QA COMPLETE: {passed} PASS / {held} UNSUPPORTED HOLDS')
