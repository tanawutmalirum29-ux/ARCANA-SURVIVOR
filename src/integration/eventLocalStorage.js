/**
 * CEO offline-only, durable single-key Event v2 storage adapter.
 * Never mounted to main.js and NEVER an authority for paid entitlements.
 *
 * Absence semantics: getItem(key) === null means the key genuinely does not
 * exist. Any parse/access error throws. Existing "null" JSON is corrupt data,
 * not absence. The caller MUST not swallow read exceptions as null.
 */
export const EVENT_V2_LOCAL_KEY = 'arcana-survivor-events-v2';

export function createEventLocalStorage({storage, key=EVENT_V2_LOCAL_KEY}={}) {
  if(typeof key!=='string'||!key||key==='arcana-survivor-v1')
    throw new TypeError('Invalid dedicated Events storage key');
  // Access to globalThis.localStorage may itself throw (privacy/disabled).
  const backend=storage===undefined?globalThis.localStorage:storage;
  if(!backend||typeof backend.getItem!=='function'||typeof backend.setItem!=='function')
    throw new TypeError('Unavailable synchronous Events storage');
  return Object.freeze({
    read() {
      // Intentionally do not catch: denied access, codec problems and transient
      // read errors MUST not be mistaken for missing saved Events history.
      const raw=backend.getItem(key);
      if(raw===null)return null;
      if(typeof raw!=='string')throw new TypeError('Invalid Event save encoding');
      const parsed=JSON.parse(raw);
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
        throw new TypeError('Corrupt Event save: non-object JSON');
      return parsed;
    },
    write(value) {
      if(!value||typeof value!=='object'||Array.isArray(value))return false;
      try {
        const serialized=JSON.stringify(value);
        if(typeof serialized!=='string')return false;
        backend.setItem(key,serialized);
        return true;
      }catch{return false}
    }
  });
}
