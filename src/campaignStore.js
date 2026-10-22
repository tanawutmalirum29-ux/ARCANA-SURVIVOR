import {defaultProfile, SAVE_KEY} from './storage.js';
import {createCampaign, validateCampaign, applyCommand} from './progression/index.js';

export const CAMPAIGN_DB = 'arcana-campaign-v2';
export const CAMPAIGN_STORE = 'campaign';
export const CAMPAIGN_KEY = 'profile';

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 999999;
const knownCosmetics = new Set(['apprentice','ember','moon']);

// Missing data is the only case where defaults are permitted. An unreadable,
// future, or malformed save is preserved in place and cannot become a grant.
export function migrateLegacyBytes(bytes) {
  if (bytes === null) return {ok:true, profile:defaultProfile(), source:'new'};
  if (typeof bytes !== 'string') return {ok:false, code:'LEGACY_READ_FAILED'};
  let data;
  try {data = JSON.parse(bytes);} catch {return {ok:false, code:'LEGACY_CORRUPT'};}
  if (!plain(data)) return {ok:false, code:'LEGACY_CORRUPT'};
  if (data.version !== 1) return {ok:false, code:'LEGACY_UNSUPPORTED'};
  if (!['gold','runs','totalKills','bestSeconds'].every(key => count(data[key])) ||
      !Array.isArray(data.owned) || !data.owned.includes('apprentice') ||
      data.owned.some(id => typeof id !== 'string' || !knownCosmetics.has(id)) ||
      !data.owned.includes(data.skin) || !plain(data.settings) ||
      !['low','medium','high'].includes(data.settings.vfx) ||
      typeof data.settings.reduceMotion !== 'boolean') {
    return {ok:false, code:'LEGACY_CORRUPT'};
  }
  return {ok:true, source:'v1', profile:{
    version:1, gold:data.gold, runs:data.runs, totalKills:data.totalKills,
    bestSeconds:data.bestSeconds, skin:data.skin, owned:[...new Set(data.owned)],
    settings:{vfx:data.settings.vfx, reduceMotion:data.settings.reduceMotion},
  }};
}

// All changes, including grants and their replay IDs, share one IndexedDB
// readwrite transaction. The browser serializes competing tabs' transactions.
// There is deliberately no localStorage read-modify-write fallback.
export function createCampaignStore(options = {}) {
  let factory;
  try {factory = Object.hasOwn(options,'indexedDB') ? options.indexedDB : globalThis.indexedDB;} catch {factory = null;}
  const name = options.name ?? CAMPAIGN_DB;
  let connectionPromise = null;
  let connection = null;
  let closed = false;

  function open() {
    if (closed) return Promise.reject(new Error('STORE_CLOSED'));
    if (connectionPromise) return connectionPromise;
    connectionPromise = new Promise((resolve, reject) => {
      if (!factory || typeof factory.open !== 'function') {
        reject(new Error('STORAGE_UNAVAILABLE')); return;
      }
      let request, settled = false;
      const fail = code => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(code));
      };
      const timer = setTimeout(() => fail('STORAGE_BLOCKED'), 10000);
      try {request = factory.open(name, 1);} catch {fail('STORAGE_UNAVAILABLE'); return;}
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(CAMPAIGN_STORE)) {
          request.result.createObjectStore(CAMPAIGN_STORE);
        }
      };
      request.onblocked = () => fail('STORAGE_BLOCKED');
      request.onerror = () => fail('STORAGE_UNAVAILABLE');
      request.onsuccess = () => {
        if (settled || closed) {request.result.close(); if(closed)fail('STORE_CLOSED'); return;}
        settled = true; clearTimeout(timer);
        connection = request.result;
        connection.onversionchange = () => {connection.close(); connection=null; connectionPromise=null;};
        resolve(connection);
      };
    }).catch(error => {connectionPromise=null; throw error;});
    return connectionPromise;
  }

  function readLegacy() {
    try {
      const storage = Object.hasOwn(options,'legacyStorage') ? options.legacyStorage : globalThis.localStorage;
      if (!storage || typeof storage.getItem !== 'function') return {ok:false, code:'LEGACY_READ_FAILED'};
      return migrateLegacyBytes(storage.getItem(SAVE_KEY));
    } catch {return {ok:false, code:'LEGACY_READ_FAILED'};}
  }

  async function transact(command, expectedRevision) {
    let db;
    try {db = await open();} catch (error) {return {ok:false, code:error.message, state:null};}
    return new Promise(resolve => {
      let tx, result = {ok:false, code:'READ_FAILED', state:null}, current = null, settled = false;
      const finish = value => {if (!settled) {settled=true; resolve(value);}};
      try {tx = db.transaction(CAMPAIGN_STORE, 'readwrite');}
      catch {finish({ok:false, code:'STORAGE_UNAVAILABLE', state:null}); return;}
      tx.onabort = () => finish({ok:false, code:'WRITE_FAILED', state:current});
      tx.onerror = () => {}; // onabort owns the failure result.
      tx.oncomplete = () => finish(result);
      const objectStore = tx.objectStore(CAMPAIGN_STORE);
      const request = objectStore.get(CAMPAIGN_KEY);
      request.onsuccess = () => {
        try {
          current = request.result;
          let fresh = false;
          if (current === undefined) {
            const legacy = readLegacy();
            if (!legacy.ok) {result={...legacy,state:null}; return;}
            current = createCampaign(legacy.profile);
            if (!validateCampaign(current)) {result={ok:false,code:'INVALID_MIGRATION',state:null}; return;}
            fresh = true;
          } else if (!validateCampaign(current)) {
            result={ok:false, code:current?.schemaVersion !== 2 ? 'UNSUPPORTED_SAVE' : 'CORRUPT_SAVE', state:null};
            return;
          }
          if (expectedRevision !== undefined && current.revision !== expectedRevision) {
            result={ok:false,code:'STALE_STATE',state:current}; return;
          }
          if (command === null) {
            result={ok:true,code:fresh?'MIGRATED':'LOADED',state:current};
            if (fresh) objectStore.put(current,CAMPAIGN_KEY);
            return;
          }
          result = applyCommand(current, command);
          if (!result || typeof result.ok !== 'boolean') throw new Error('invalid reducer response');
          if (!result.state) result={...result,state:current};
          if (!result.ok) return;
          if (!validateCampaign(result.state) || result.state.revision !== current.revision + 1) {
            result={ok:false,code:'INVALID_TRANSITION',state:current}; return;
          }
          objectStore.put(result.state,CAMPAIGN_KEY);
        } catch {
          result={ok:false,code:'INVALID_TRANSITION',state:current};
          tx.abort();
        }
      };
    });
  }

  return {
    load: () => transact(null),
    dispatch: (command, {expectedRevision} = {}) => transact(command, expectedRevision),
    close() {closed=true; connection?.close(); connection=null; connectionPromise=null;},
  };
}
