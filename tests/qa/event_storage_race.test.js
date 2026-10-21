// QA characterization of a blocked activation condition: Event v2 storage has no
// inter-tab compare-and-swap. This is NOT evidence of an enabled live Events UI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEventState, advanceEventProgress} from '../../src/events/core.js';
import {createEventLocalStorage} from '../../src/integration/eventLocalStorage.js';
import {prepareStoredEventState} from '../../src/integration/eventV2Store.js';

const catalog=JSON.parse(readFileSync(new URL('../../src/content/events/s01_events.json', import.meta.url),'utf8'));
const time='2030-01-13T23:59:59.999Z'; // simulated fixture, not production event time
const event=eventId=>({eventId,type:'RUN_FINISHED',tick:600,runId:eventId,payload:{}});
const next=(state,id)=>advanceEventProgress(state,event(id),catalog,time).state;

test('QA CHARACTERIZATION: two stale tab snapshots can pass readback yet drop an Event replay ID',()=>{
  const entries=new Map();
  const backend={
    getItem(key){return entries.has(key)?entries.get(key):null},
    setItem(key,value){entries.set(key,value)}
  };
  const tabA=createEventLocalStorage({storage:backend});
  const tabB=createEventLocalStorage({storage:backend});
  assert.equal(prepareStoredEventState({store:tabA}).status,'INITIALIZED');
  // Two independent tabs may read the same old snapshot before either writes.
  const aOld=prepareStoredEventState({store:tabA}).state;
  const bOld=prepareStoredEventState({store:tabB}).state;
  assert.deepEqual(aOld,createEventState());
  assert.deepEqual(bOld,createEventState());
  const aNext=next(aOld,'qa-tab-A');
  const bNext=next(bOld,'qa-tab-B');
  // Interleave: A writes and verifies, then B writes based on its stale copy
  // and verifies. Both individual readbacks pass; global integrity does not.
  assert.equal(tabA.write(aNext),true);
  assert.deepEqual(tabA.read(),aNext);
  assert.equal(tabB.write(bNext),true);
  assert.deepEqual(tabB.read(),bNext);
  const final=prepareStoredEventState({store:tabA});
  assert.equal(final.status,'LOADED');
  assert.deepEqual(final.state.seenEventIds,['qa-tab-B']);
  assert.equal(final.state.seenEventIds.includes('qa-tab-A'),false,
    'Known blocker: last-writer-wins drops a previously verified ID');
});

test.todo('ACTIVATION HOLD: reject concurrent stale Event v2 writes with atomic revision/CAS or authority-side serialization');
