import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)), nz=join(root,'dist','The-House-That-Remembered-Us-Guided.nz'), temp=join(root,'.validation');
await rm(temp,{recursive:true,force:true});await mkdir(temp,{recursive:true});execFileSync('unzip',['-q',nz,'-d',temp]);
const read=async p=>JSON.parse(await readFile(join(temp,p),'utf8')), manifest=await read('manifest.json'), ledger=await read('metadata/asset-rights-ledger.json');const errors=[];
for(const p of ['manifest.json','experience.html','edition.json','rights.json','credits.json','authenticity.json','technical.json','experience.json','archive.json','history.json'])try{await readFile(join(temp,p))}catch{errors.push(`missing ${p}`)}
if(manifest.release.track_count!==manifest.tracks.length)errors.push('track_count mismatch');
const ids=new Set(),paths=new Set();for(const c of manifest.components){if(ids.has(c.component_id))errors.push(`duplicate ${c.component_id}`);ids.add(c.component_id);if(paths.has(c.path))errors.push(`duplicate ${c.path}`);paths.add(c.path);try{const b=await readFile(join(temp,c.path)),h=createHash('sha256').update(b).digest('hex');if(h!==c.sha256||b.length!==c.size)errors.push(`integrity ${c.path}`)}catch{errors.push(`missing component ${c.path}`)}}
for(const t of manifest.tracks){if(!ids.has(t.primary_audio_component))errors.push(`audio reference ${t.track_id}`)}
const html=await readFile(join(temp,'experience.html'),'utf8');if(/<(script|link)\b[^>]+(src|href)=["']https?:/i.test(html))errors.push('external runtime dependency');
for(const entry of ledger){if(!entry.sha256||!entry.source_page||!entry.verification_evidence)errors.push(`rights evidence ${entry.asset_id}`);if(!paths.has(entry.local_path))errors.push(`ledger orphan ${entry.local_path}`)}
for(const p of paths)if(p.startsWith('audio/')&&!ledger.some(x=>x.local_path===p))errors.push(`unledgered audio ${p}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log(`VALID · ${manifest.tracks.length} tracks · ${manifest.components.length} verified components · ${ledger.length} rights records · offline runtime`);
await rm(temp,{recursive:true,force:true});
