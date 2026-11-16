import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {describe,it,expect,vi} from 'vitest';
vi.mock('../../src/server/db/client',()=>({getDb:async()=>{throw new Error('No DB in pure source probes');},closeDb:async()=>{}}));
import {extractSubstantiatedCompsFromRaw,verifySourceObservation,resolveRawArtifact} from '../../src/server/meta/services/source-verification';
const base:any={id:'memory-only',datasetKind:'real',sourceId:'tftacademy',sourceCompId:'set-18-dragon-princess',sourceUrl:'https://tftacademy.com/tierlist/comps/set-18-dragon-princess',scope:{patchEpochId:'epoch_18_2'},status:'valid',observedAt:'2026-10-13T00:00:00Z',rawArtifactId:'art_tftacademy_18_2',evidenceRefIds:[],metrics:{},builds:[]};
const opts={patchEpochId:'epoch_18_2',maxAgeHours:72,referenceTime:'2026-10-13T01:00:00Z'};
function withRaw(body:any,fn:(file:string)=>void){const file=path.join(os.tmpdir(),`tft-claim-${randomUUID()}.json`);try{fs.writeFileSync(file,JSON.stringify(body));fn(file);}finally{if(fs.existsSync(file))fs.unlinkSync(file);}}
describe('Batch source proof invariants',()=>{
 it('accepts an exact claim in verified parent bytes',async()=>{expect((await verifySourceObservation(base,opts)).verified).toBe(true);});
 it('missing observation epoch cannot borrow a pinned artifact for a requested different patch',async()=>{expect((await verifySourceObservation({...base,scope:{}},{...opts,patchEpochId:'epoch_18_3'})).verified).toBe(false);});
 it.each([NaN,Infinity,-1])('rejects invalid freshness policy %s',async age=>{expect((await verifySourceObservation(base,{...opts,maxAgeHours:age})).verified).toBe(false);});
 it('matching comp path on a different provider host does not verify',async()=>{expect((await verifySourceObservation({...base,sourceUrl:'https://example.com/tierlist/comps/set-18-dragon-princess'},opts)).verified).toBe(false);});
 it('an unclassifiable group cannot attest every static archetype signature',()=>{withRaw({initialData:{groups:[{full:{units:[['UNKNOWN',1,100]]}}]}},file=>expect([...extractSubstantiatedCompsFromRaw(file)]).toEqual([]));});
 it('mutable storage paths do not retain an old comp index',()=>{withRaw({data:{list:[{id:'alpha'}]}},file=>{expect(extractSubstantiatedCompsFromRaw(file).has('alpha')).toBe(true);fs.writeFileSync(file,JSON.stringify({data:{list:[{id:'beta'}]}}));const ids=extractSubstantiatedCompsFromRaw(file);expect(ids.has('beta')).toBe(true);expect(ids.has('alpha')).toBe(false);});});
 it('a caller cannot replace a pinned digest',async()=>{expect((await resolveRawArtifact('art_tftacademy_18_2',{expectedSha256:'f'.repeat(64)})).resolved).toBe(false);});
});
it('Vietnamese item names resolve to their actual icon instead of initials',async()=>{const {resolveItemInfo}=await import('../../src/domain/meta/item-registry');expect(resolveItemInfo('Vô Cực Kiếm')?.key).toBe('infinityedge');expect(resolveItemInfo('vo cuc kiem')?.key).toBe('infinityedge');expect(resolveItemInfo('Huyết Kiếm')?.key).toBe('bloodthirster');});
