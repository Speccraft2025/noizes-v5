import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),nz=join(root,'dist','The-House-That-Remembered-Us-Masterpiece.nz'),temp=join(root,'.validation-masterpiece');
await rm(temp,{recursive:true,force:true});await mkdir(temp,{recursive:true});execFileSync('unzip',['-q',nz,'-d',temp]);
const read=async path=>JSON.parse(await readFile(join(temp,path),'utf8')),manifest=await read('manifest.json'),ledger=await read('metadata/asset-rights-ledger.json');const errors=[];
for(const path of ['manifest.json','experience.html','edition.json','rights.json','credits.json','authenticity.json','technical.json','experience.json','archive.json','history.json','timeline/masterpiece-vertical-slice.json'])try{await readFile(join(temp,path))}catch{errors.push(`missing ${path}`)}
if(manifest.release.track_count!==manifest.tracks.length)errors.push('track_count mismatch');if(manifest.experience?.vertical_slice?.end_seconds!==84)errors.push('vertical slice boundary');
const ids=new Set(),paths=new Set();for(const component of manifest.components){if(ids.has(component.component_id))errors.push(`duplicate ${component.component_id}`);ids.add(component.component_id);if(paths.has(component.path))errors.push(`duplicate ${component.path}`);paths.add(component.path);try{const bytes=await readFile(join(temp,component.path)),hash=createHash('sha256').update(bytes).digest('hex');if(hash!==component.sha256||bytes.length!==component.size)errors.push(`integrity ${component.path}`)}catch{errors.push(`missing component ${component.path}`)}}
for(const track of manifest.tracks)if(!ids.has(track.primary_audio_component))errors.push(`audio reference ${track.track_id}`);
const html=await readFile(join(temp,'experience.html'),'utf8');if(/<(script|link)\b[^>]+(src|href)=["']https?:/i.test(html))errors.push('external runtime dependency');
if(html.includes('/* THREE_RUNTIME */')||html.includes('/* MASTERPIECE_RUNTIME */'))errors.push('unresolved runtime marker');
if(/\bimport\{[^}]*\}from["']\.\/three\.core/i.test(html)||/\bexport\{[^}]*\}(?:from)?["']\.\/three\.core/i.test(html))errors.push('Three.js module syntax remained in offline runtime');
if(!html.includes('window.THREE=Object.assign(window.__THREE_CORE__')||!html.includes('"Scene":'))errors.push('incomplete Three.js core namespace');
for(const token of ['class ExperienceDirector','class AudioClock','class CueEngine','class SceneManager','class PerformanceGovernor','class SpatialAudioSystem','class WorldRenderer','audio.currentTime','gsap.timeline','new T.WebGLRenderer','Cross the threshold'])if(!html.includes(token))errors.push(`runtime token ${token}`);
for(const path of ['assets/images/world-atlas.png','timeline/masterpiece-vertical-slice.json'])if(!paths.has(path))errors.push(`world asset ${path}`);
for(const entry of ledger){if(!entry.sha256||!entry.source_page||!entry.verification_evidence)errors.push(`rights evidence ${entry.asset_id}`);if(!paths.has(entry.local_path))errors.push(`ledger orphan ${entry.local_path}`)}
for(const path of paths)if(path.startsWith('audio/')&&!ledger.some(entry=>entry.local_path===path))errors.push(`unledgered audio ${path}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log(`VALID MASTERPIECE SLICE · 84 seconds · ${manifest.components.length} verified components · ${ledger.length} rights records · offline runtime`);await rm(temp,{recursive:true,force:true});
