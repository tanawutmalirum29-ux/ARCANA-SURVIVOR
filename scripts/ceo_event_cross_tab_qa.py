"""Real two-page IndexedDB transaction serialization stress.

Browser origin data is stored in a *single IndexedDB readwrite transaction*.
Web Locks/localStorage-based snapshots were removed due to observed WebKit
lost replay IDs and duplicate claims. This script never activates game Events.
"""
import os
from playwright.sync_api import sync_playwright

ORIGIN=os.environ.get('ARCANA_QA_URL','http://127.0.0.1:4173')
SIZES=[(320,568),(844,390)]
ROUNDS=12
SETUP="""async () => {
 const [writer,core]=await Promise.all([
    import('/src/integration/eventExclusiveWriter.js'),
    import('/src/events/core.js')
 ]);
 const catalog=await (await fetch('/src/content/events/s01_events.json')).json();
 window.__ctx={writer,core,catalog};
 window.__done=true;window.__last=null;window.__results=[];
 window.__launch=(eventId,utc,claimId=null,crash=false)=>{
   window.__done=false;
   const transition=claimId
     ? state=>{const op=core.claimEventReward(state,claimId,utc);
                 return {state:op.state,result:{status:op.status}};}
     : state=>core.advanceEventProgress(
         state,{eventId,runId:'real-tabs',tick:100,type:'RUN_FINISHED',payload:{}},
         catalog,utc);
   window.__completion=writer.commitExclusiveEventTransition({
     indexedDBFactory:indexedDB,allowInitialize:true,transition,
     ...(crash?{checkpoint:phase=>{
       if(phase==='after_event_write')throw Error('SIMULATED_POWER_LOSS')
     }}:{})
   }).then(result=>{window.__last=result;window.__results.push(result);
                    window.__done=true;return result})
     .catch(error=>{window.__last={ok:false,status:'UNEXPECTED',reason:String(error)};
                     window.__done=true});
 };
 window.__arm=(eventId,utc,claimId=null)=>{
   window.__next=[eventId,utc,claimId];
   window.__done=false;
 };
 window.__channel=new BroadcastChannel('test-event-v2-idb-barrier');
 window.__channel.onmessage=evt=>{
   if(evt.data?.type==='go'&&evt.data.round===window.__round){
     window.__launch(...window.__next);
   }
 };
 window.__round=0;
 return typeof indexedDB?.open==='function';
}"""
def snapshot(page):
    return page.evaluate("""async()=> {
      const r=await window.__ctx.writer.readExclusiveEventSnapshot({
        indexedDBFactory:indexedDB
      });
      if(!r.ok)throw Error('IDB READ FAILED '+JSON.stringify(r));
      return r.state;
    }""")
def trigger(barrier,round_no):
    barrier.evaluate("""roundNo=>{
      if(!window.__channel)
        window.__channel=new BroadcastChannel('test-event-v2-idb-barrier');
      window.__channel.postMessage({type:'go',round:roundNo});
    }""",round_no)
def both(a,b,barrier,round_no,ida,idb,utc,claim=None):
    a.evaluate("r=>window.__round=r",round_no)
    b.evaluate("r=>window.__round=r",round_no)
    a.evaluate("([id,utc,claim])=>window.__arm(id,utc,claim)",[ida,utc,claim])
    b.evaluate("([id,utc,claim])=>window.__arm(id,utc,claim)",[idb,utc,claim])
    trigger(barrier,round_no)
    a.wait_for_function("window.__done===true",timeout=15000)
    b.wait_for_function("window.__done===true",timeout=15000)
    outcomes=[a.evaluate("window.__last"),b.evaluate("window.__last")]
    if not all(x.get('status')=='COMMITTED' for x in outcomes):
        print("IDB_TRANSACTION_FAILURE",round_no,outcomes,flush=True)
    assert all(x.get('status')=='COMMITTED' for x in outcomes),outcomes
    return outcomes

def check(browser,engine,w,h):
    context=browser.new_context(viewport={'width':w,'height':h},
                                has_touch=True,is_mobile=True)
    try:
        a=context.new_page()
        b=context.new_page()
        third=context.new_page()
        for page in (a,b,third):
            page.goto(ORIGIN,wait_until='networkidle')
        assert a.evaluate(SETUP) and b.evaluate(SETUP),(engine,w,h,'IndexedDB unavailable')
        assert third.evaluate(SETUP),(engine,w,h,'third-tab IndexedDB unavailable')
        # No implicit empty ledger on first launch; explicit initialization
        # remains unavailable by default to prevent legacy save erasure.
        blocked=a.evaluate("""async()=>{
          const w=window.__ctx.writer;
          return await w.commitExclusiveEventTransition({
            indexedDBFactory:indexedDB,
            transition:s=>({state:s})
          });
        }""")
        assert blocked['status']=='MIGRATION_REQUIRED',blocked
        assert snapshot(a) is None
        a.evaluate("window.__launch('seed', '2030-01-13T23:59:59.999Z')")
        a.wait_for_function("window.__done===true")
        assert a.evaluate("window.__last.status")=='COMMITTED'
        expected={'seed'}
        for i in range(ROUNDS):
            day='2030-01-13T23:59:59.999Z' if i%2==0 else '2030-01-14T00:00:00.000Z'
            ids=[f'tab:A:{i}',f'tab:B:{i}']
            both(a,b,third,i+1,ids[0],ids[1],day)
            expected.update(ids)
            # A genuinely fresh third page sees all accepted IDs, not an old
            # process-local localStorage view. Check both long-lived tabs too.
            for page in (a,b,third):
                state=snapshot(page)
                seen=state['seenEventIds']
                if set(seen)!=expected or len(seen)!=len(expected):
                    print('IDB_LOST_ID',engine,[w,h],i,seen,sorted(expected),flush=True)
                assert set(seen)==expected and len(seen)==len(expected)
        # Deliberately poison both tabs' OLD localStorage caches. IndexedDB
        # transactions MUST ignore these stale values completely.
        a.evaluate("localStorage.setItem('arcana-survivor-events-v2','{}')")
        b.evaluate("localStorage.setItem('arcana-survivor-events-v2','null')")
        both(a,b,third,ROUNDS+1,'after:stale:A','after:stale:B',
             '2030-01-14T00:00:00.000Z')
        expected.update(['after:stale:A','after:stale:B'])
        assert set(snapshot(third)['seenEventIds'])==expected
        # Same earned claim from two REAL same-origin tabs must be exactly
        # one CLAIMED and one DUPLICATE, with one durable outbox claim.
        claim=a.evaluate("""async()=>{
          const {writer,core}=window.__ctx;
          const state=(await writer.readExclusiveEventSnapshot({
            indexedDBFactory:indexedDB
          })).state;
          return core.listClaimableEventRewards(state,'2030-01-14T00:00:00.000Z')
            .find(x=>x.rewardId.includes('#finish_run'))?.rewardId||null;
        }""")
        assert claim,(engine,w,h,'fixture has no claimable reward')
        results=both(a,b,third,ROUNDS+2,'claim:A','claim:B',
                     '2030-01-14T00:00:00.000Z',claim)
        outcomes=sorted(x.get('result',{}).get('status') for x in results)
        assert outcomes==['CLAIMED','DUPLICATE'],outcomes
        state=snapshot(third)
        assert len(state['claims'])==1 and set(state['seenEventIds'])==expected
        # Simulated crash after reducer produces a staged write must abort
        # the whole transaction, not leave any replay ID.
        a.evaluate("window.__launch('aborted:event','2030-01-14T00:00:00.000Z',null,true)")
        a.wait_for_function("window.__done===true")
        assert a.evaluate("window.__last.ok") is False
        assert 'aborted:event' not in snapshot(third)['seenEventIds']
        a.reload(wait_until='networkidle')
        b.reload(wait_until='networkidle')
        third.reload(wait_until='networkidle')
        # Freshly reopened pages from same origin must see EXACT same state.
        for page in (a,b,third):
            restored=page.evaluate("""async()=>{
              const {readExclusiveEventSnapshot}=await import(
                '/src/integration/eventExclusiveWriter.js');
              return (await readExclusiveEventSnapshot({
                indexedDBFactory:indexedDB
              })).state;
            }""")
            assert restored['claims']==state['claims']
            assert set(restored['seenEventIds'])==expected
        print('PASS',engine,f'{w}x{h}',f'{ROUNDS} concurrent rounds',
              'two real tabs; fresh third tab; one claim; abort; reload',flush=True)
    finally:
        context.close()

with sync_playwright() as p:
    for engine in ['chromium','webkit']:
        browser=getattr(p,engine).launch(headless=True)
        try:
            for w,h in SIZES:
                check(browser,engine,w,h)
        finally:
            browser.close()
print('EVENT INDEXEDDB TRANSACTION REAL-TAB QA COMPLETE: 4 PASS')
