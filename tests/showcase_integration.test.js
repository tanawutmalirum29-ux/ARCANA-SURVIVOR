import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile,sanitizeProfile,COSMETICS} from '../src/storage.js';
test('medium visual quality survives profile validation and quality remains whitelisted',()=>{
 const p=defaultProfile();p.settings.vfx='medium';
 assert.equal(sanitizeProfile(p).settings.vfx,'medium');
 assert.equal(sanitizeProfile({...p,settings:{vfx:'ultra',reduceMotion:'true'}}).settings.vfx,'high');
});
test('preview-only premium entries cannot enter owned skins through persistence',()=>{
 const p=defaultProfile();p.skin='crimson';p.owned=['apprentice','crimson','celestial'];
 const safe=sanitizeProfile(p);assert.deepEqual(safe.owned,['apprentice']);assert.equal(safe.skin,'apprentice');
 assert.equal(COSMETICS.filter(x=>x.source.includes('PREMIUM')).length,2);
});