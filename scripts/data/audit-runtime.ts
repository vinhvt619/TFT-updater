import {communityDragonAdapter} from "../../src/ingestion/adapters/community-dragon";
import {snapshotRepository} from "../../src/server/repositories/snapshot-repository";
import {compareSnapshots} from "../../src/domain/compare";
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {sql} from 'drizzle-orm';import {getDb,closeDb,databaseRuntime} from '../../src/server/db/client';
export async function auditRuntime(options:{apply?:boolean;out?:string}={}){
 const db=await getDb(),q=async(text:string)=>{const r=await db.execute(sql.raw(text));return Array.isArray(r)?r:r.rows||[];},quote=(v:unknown)=>"'"+String(v).replaceAll("'","''")+"'";
 const root=path.resolve('storage/raw'),inside=(p:string)=>p.startsWith(root+path.sep),digest=(b:Buffer)=>crypto.createHash('sha256').update(b).digest('hex');
 const before=await databaseRuntime.getFingerprint(),raw=await q('SELECT * FROM raw_artifacts');const files=new Map<string,{key:string,size:number}>();
 function scan(dir:string){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isSymbolicLink())continue;if(e.isDirectory())scan(p);else if(e.isFile()){const b=fs.readFileSync(p);files.set(digest(b),{key:path.relative(root,p).replaceAll('\\','/'),size:b.length});}}}scan(root);
 const rawAudit=raw.map((r:any)=>{const p=path.resolve(root,r.storage_key);let status='missing';if(inside(p)&&fs.existsSync(p)&&inside(fs.realpathSync(p))){const b=fs.readFileSync(p);status=digest(b)===r.sha256&&b.length===r.byte_size?'valid':'mismatch';}else if(!inside(p))status='unsafe_path';const recovery=files.get(r.sha256);return{id:r.id,expectedSha256:r.sha256,expectedByteSize:r.byte_size,storageKey:r.storage_key,status,recovery:recovery?.size===r.byte_size?recovery:null};});
 const bad=rawAudit.filter((r:any)=>r.status!=='valid'&&!r.recovery).map((r:any)=>r.id),badList=bad.length?bad.map(quote).join(','):"''";
 const realSnapshots=await q(`SELECT s.id,s.release_id,s.status,s.raw_hash,s.gameplay_hash,count(cs.champion_id)::int AS champion_count FROM snapshots s JOIN releases r ON r.id=s.release_id LEFT JOIN champion_snapshots cs ON cs.snapshot_id=s.id WHERE r.dataset_kind='real' GROUP BY s.id ORDER BY s.id`);
 const affectedGameplay=await q(`SELECT DISTINCT s.id FROM snapshots s JOIN releases r ON r.id=s.release_id JOIN snapshot_artifacts a ON a.snapshot_id=s.id WHERE r.dataset_kind='real' AND a.artifact_id IN (${badList})`);
 const affectedSources=await q(`SELECT id FROM meta_source_snapshots WHERE dataset_kind='real' AND raw_artifact_id IN (${badList})`);
 const affectedObs=await q(`SELECT DISTINCT o.id FROM meta_source_comp_observations o JOIN meta_source_snapshots s ON s.id=o.snapshot_id LEFT JOIN meta_source_comp_builds b ON b.observation_id=o.id WHERE o.dataset_kind='real' AND (s.raw_artifact_id IN (${badList}) OR b.raw_artifact_id IN (${badList}) OR EXISTS(SELECT 1 FROM evidence_refs e WHERE e.id IN (SELECT jsonb_array_elements_text(o.evidence_ref_ids)) AND e.artifact_id IN (${badList})))`);
 const obsList=affectedObs.length?affectedObs.map((r:any)=>quote(r.id)).join(','):"''";
 const affectedRankings=await q(`SELECT DISTINCT r.id FROM meta_ranking_snapshots r LEFT JOIN meta_ranking_inputs i ON i.ranking_snapshot_id=r.id WHERE r.dataset_kind='real' AND ((i.input_type='observation' AND i.input_id IN (${obsList})) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(r.input_observation_ids,'[]'::jsonb)) v WHERE v IN (${obsList})))`);
 const rankList=affectedRankings.length?affectedRankings.map((r:any)=>quote(r.id)).join(','):"''";
 const pointers=await q('SELECT * FROM meta_current_ranking_pointers');const releases=await q(`SELECT id,dataset_kind,patch_label,channel,canonical_release_id,history_visibility,current_snapshot_id,effective_at FROM releases ORDER BY dataset_kind,effective_at`);
 if(options.apply){await q('BEGIN');try{
  for(const r of rawAudit.filter((r:any)=>r.status!=='valid'&&r.recovery))await q(`UPDATE raw_artifacts SET storage_key=${quote(r.recovery!.key)} WHERE id=${quote(r.id)} AND sha256=${quote(r.expectedSha256)}`);
  for(const r of affectedGameplay)await q(`UPDATE snapshots SET status='quarantined',reason='Raw artifact không còn khớp hash đã ghi; chờ phục hồi byte gốc' WHERE id=${quote(r.id)}`);
  for(const r of affectedSources)await q(`UPDATE meta_source_snapshots SET status='quarantined' WHERE id=${quote(r.id)}`);
  await q(`UPDATE meta_source_comp_observations SET status='quarantined',quarantine_reason='Raw artifact/evidence không khớp hash; chưa phục hồi được byte gốc' WHERE dataset_kind='real' AND id IN (${obsList})`);
  await q(`UPDATE meta_ranking_snapshots SET status='quarantined',quarantine_reason='Ranking phụ thuộc raw/evidence mất tính toàn vẹn' WHERE dataset_kind='real' AND id IN (${rankList})`);
  await q(`DELETE FROM meta_current_ranking_pointers WHERE dataset_kind='real' AND ranking_snapshot_id IN (SELECT id FROM meta_ranking_snapshots WHERE dataset_kind='real' AND status IN ('quarantined','retracted'))`);
  await q(`DELETE FROM diff_cache WHERE from_snapshot_id IN (SELECT id FROM snapshots WHERE status='quarantined') OR to_snapshot_id IN (SELECT id FROM snapshots WHERE status='quarantined')`);
  await q(`UPDATE releases SET history_visibility='archive',visibility_reason='Snapshot cách ly, không có patch notes chứng thực cho mốc này' WHERE dataset_kind='real' AND current_snapshot_id IN (SELECT id FROM snapshots WHERE status='quarantined') AND NOT EXISTS (SELECT 1 FROM release_changes c WHERE c.release_id=releases.id)`);
  await q('COMMIT');
 }catch(e){await q('ROLLBACK');throw e;}}
 const semanticSnapshots:any[]=[];
 const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 for(const snap of realSnapshots.filter((r:any)=>r.status==='published')){const rel=releases.find((r:any)=>r.id===snap.release_id);const links=await q(`SELECT a.* FROM raw_artifacts a JOIN snapshot_artifacts sa ON sa.artifact_id=a.id WHERE sa.snapshot_id=${quote(snap.id)}`);const a=links.find((r:any)=>r.sha256===snap.raw_hash)||raw.find((r:any)=>r.sha256===snap.raw_hash);{}
  if(!a){semanticSnapshots.push({id:snap.id,status:'missing_raw_link'});continue;}
  const checked=rawAudit.find((r:any)=>r.id===a.id);if(!checked||checked.status!=='valid'&&!checked.recovery){semanticSnapshots.push({id:snap.id,status:'raw_integrity_failure'});continue;}
  const bytes=fs.readFileSync(path.join(root,checked.recovery?.key||a.storage_key));const norm=await communityDragonAdapter.normalize(bytes,{id:rel.channel==='live'?'community_dragon_live':'community_dragon_pbe',channel:rel.channel,targetSet:18});const stored=await snapshotRepository.getSnapshotPayload(snap.id);
  const ordered=(cs:any[])=>[...cs].sort((a,b)=>a.championId.localeCompare(b.championId));
  const normalizedGameplayHash=digest(Buffer.from(JSON.stringify(norm.payload?.champions||[])));
  const payloadMatches=!!norm.payload&&!!stored&&JSON.stringify(stable(ordered(norm.payload.champions)))===JSON.stringify(stable(ordered(stored.champions)));
  const cmp=(stored&&norm.payload)?compareSnapshots(stored,norm.payload,snap.id,'replayed'):null;
  const gameplayMatches=Boolean(cmp&&cmp.summary.changedChampions===0&&cmp.summary.totalChampions===(stored?.champions.length||0));
  const rawHashMatches=digest(bytes)===snap.raw_hash;
  if(options.apply&&rawHashMatches&&gameplayMatches)await q(`INSERT INTO snapshot_artifacts(id,snapshot_id,artifact_id,role) VALUES (${quote('sa_'+snap.id+'_'+a.id)},${quote(snap.id)},${quote(a.id)},'source_payload') ON CONFLICT (id) DO NOTHING`);
  semanticSnapshots.push({id:snap.id,artifactId:a.id,storedArtifactJoin:links.some((r:any)=>r.id===a.id),proof:'raw digest + normalizer replay + gameplay equality',rawHashMatches,expectedGameplayHash:snap.gameplay_hash,normalizedGameplayHash,gameplayHashMatches:normalizedGameplayHash===snap.gameplay_hash,payloadMatches,gameplayMatches,champions:stored?.champions.length||0,status:rawHashMatches&&gameplayMatches?'PASS':'FAIL'});
 }
 const output={generatedAt:new Date().toISOString(),subjectCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mode:options.apply?'apply':'read_only',dbPath:databaseRuntime.getDataDir(),before,after:await databaseRuntime.getFingerprint(),summary:{rawTotal:rawAudit.length,valid:rawAudit.filter((r:any)=>r.status==='valid').length,recoverable:rawAudit.filter((r:any)=>r.status!=='valid'&&r.recovery).length,unrecoverable:bad.length,affectedGameplay:affectedGameplay.length,affectedSources:affectedSources.length,affectedObs:affectedObs.length,affectedRankings:affectedRankings.length},rawAudit,realSnapshots,semanticSnapshots,releases,pointersBefore:pointers,pointersAfter:await q('SELECT * FROM meta_current_ranking_pointers'),affectedGameplay,affectedSources,affectedObs,affectedRankings};
 const out=options.out||'artifacts/runtime-audit.json';fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({out,mode:output.mode,summary:output.summary}));return output;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('scripts/data/audit-runtime.ts')){const i=process.argv.indexOf('--out');auditRuntime({apply:process.argv.includes('--apply'),out:i>=0?process.argv[i+1]:undefined}).then(()=>closeDb()).catch(async e=>{console.error(e);await closeDb();process.exitCode=1;});}