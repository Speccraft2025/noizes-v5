import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const GUIDED=join(ROOT,'build','The-House-That-Remembered-Us-Guided');
const PKG=join(ROOT,'build','The-House-That-Remembered-Us-Masterpiece');
const OUT=join(ROOT,'dist','The-House-That-Remembered-Us-Masterpiece.nz');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const put=async(path,value)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,value)};

await import('./build.mjs');
await rm(PKG,{recursive:true,force:true});
await cp(GUIDED,PKG,{recursive:true});

const source=join(ROOT,'masterpiece');
const modules=['core.js','visuals.js','interaction.js','director.js','app.js'];
const runtime=(await Promise.all(modules.map(file=>readFile(join(source,'runtime',file),'utf8')))).join('\n');
const css=await readFile(join(source,'styles.css'),'utf8');
const gsap=await readFile(join(ROOT,'..','..','studio','node_modules','gsap','dist','gsap.min.js'),'utf8');
const exportObject=source=>{const match=source.match(/export\{([^}]*)\};?\s*$/);if(!match)throw new Error('Unable to convert local Three.js export');const object=match[1].split(',').map(entry=>{const parts=entry.trim().split(/\s+as\s+/);return `${JSON.stringify(parts[1]||parts[0])}:${parts[0]}`}).join(',');return{body:source.slice(0,match.index),object}};
let threeCore=await readFile(join(ROOT,'..','..','studio','node_modules','three','build','three.core.min.js'),'utf8'),three=await readFile(join(ROOT,'..','..','studio','node_modules','three','build','three.module.min.js'),'utf8');
const coreExport=exportObject(threeCore);threeCore=`(()=>{${coreExport.body}window.__THREE_CORE__={${coreExport.object}};})();`;
const coreImport=three.match(/import\{([^}]*)\}from"\.\/three\.core\.min\.js";/);if(!coreImport)throw new Error('Unable to convert local Three.js core import');
const destructured=coreImport[1].split(',').map(entry=>{const parts=entry.trim().split(/\s+as\s+/);return parts.length===2?`${parts[0]}:${parts[1]}`:parts[0]}).join(',');three=three.replace(coreImport[0],`const{${destructured}}=window.__THREE_CORE__;`).replace(/export\{[^}]*\}from"\.\/three\.core\.min\.js";/,'');
const threeExport=exportObject(three);three=threeCore+threeExport.body+`window.THREE=Object.assign(window.__THREE_CORE__,{${threeExport.object}});delete window.__THREE_CORE__;`;
let html=await readFile(join(source,'experience.html'),'utf8');
html=html.replace('/* MASTERPIECE_CSS */',()=>css).replace('/* THREE_RUNTIME */',()=>three).replace('/* GSAP_RUNTIME */',()=>gsap).replace('/* MASTERPIECE_RUNTIME */',()=>runtime);
await put(join(PKG,'experience.html'),html);
await cp(join(source,'assets','world-atlas.png'),join(PKG,'assets','images','world-atlas.png'));
await cp(join(source,'assets','exterior-panorama.png'),join(PKG,'assets','images','exterior-panorama.png'));
await cp(join(source,'assets','memory-ephemera-atlas.png'),join(PKG,'assets','images','memory-ephemera-atlas.png'));

const docs=['MASTERPIECE_AUDIT.md','CREATIVE_DIRECTION.md','TRACK_EXPERIENCE_TREATMENT.md','MOTION_LANGUAGE.md','CAMERA_LANGUAGE.md','TRANSITION_LANGUAGE.md','TYPOGRAPHY_SYSTEM.md','SOUND_DESIGN.md','PERFORMANCE_BUDGET.md','ACCESSIBILITY_EXPERIENCE.md','MASTERPIECE_ARCHITECTURE.md','MASTERPIECE_QA.md','WORLD_ASSET_BIBLE.md','FULL_WORLD_CREATIVE_DIRECTION.md','ENVIRONMENT_ARCHITECTURE.md','LIGHTING_SCRIPT.md','SPATIAL_AUDIO_DESIGN.md','MATERIAL_SYSTEM.md','SHADER_SYSTEM.md','WORLD_STATE_MODEL.md','PHOTOGRAPH_PORTAL_TECHNIQUE.md','FRAME_REVIEW.md','FULL_WORLD_PERFORMANCE_BUDGET.md','FULL_WORLD_ACCESSIBILITY.md','FULL_WORLD_QA.md'];
for(const file of docs)await cp(join(ROOT,file),join(PKG,'assets','documents',file));
await put(join(PKG,'timeline','masterpiece-vertical-slice.json'),json({schema_version:'0.2.0',master_clock:'audio.currentTime',track_id:'track-01',range_seconds:[0,84],reconstruction:'reduce latest cue at or before playhead',cues:[
  {time:0,phase:'dormant',shot:'Threshold Shot',action:'object.sealed'},
  {time:12,phase:'outline',shot:'Threshold Shot',action:'architecture.gather'},
  {time:24,phase:'breathing',shot:'Breathing Frame',action:'architecture.breathe'},
  {time:36,phase:'inscription',shot:'Memory Push',action:'lyric.condensation'},
  {time:47,phase:'key',shot:'Recognition Close-Up',action:'object.reveal',target:'returned-key'},
  {time:63,phase:'photograph',shot:'Memory Push',action:'photograph.develop'},
  {time:72,phase:'passage',shot:'Photograph Entry',action:'transition.photograph-entry'},
  {time:82,phase:'complete',shot:'Witness Shot',action:'slice.hold'}
]}));

const manifest=JSON.parse(await readFile(join(PKG,'manifest.json'),'utf8'));
manifest.experience={entry:'experience.html',schema:'3.1.0',template:'masterpiece-vertical-slice-0.1',type:'sentient-architectural-memory',default_mode:'guided',timeline:'timeline/masterpiece-vertical-slice.json',fallback_mode:'essential-paper-stage',reduced_motion_supported:true,navigation:'music-directed',vertical_slice:{track_id:'track-01',start_seconds:0,end_seconds:84,gate:2}};
manifest.extensions['org.noizes.immersive']={version:'0.3.0',stage:'masterpiece-vertical-slice'};
manifest.created_at=new Date().toISOString();

const experience=await readFile(join(PKG,'experience.html'));
const ledger=JSON.parse(await readFile(join(PKG,'metadata','asset-rights-ledger.json'),'utf8'));
ledger.push({asset_id:'gsap-runtime-inline',local_path:'experience.html',title:'GSAP runtime',creator:'GreenSock / Webflow',performer:'',source_institution:'GSAP npm distribution',source_page:'https://www.npmjs.com/package/gsap',direct_download_source:'Locally bundled from repository dependency',work_status:'Third-party software',lyrics_status:'Not applicable',recording_status:'Not applicable',artwork_status:'Not applicable',license:'GSAP Standard License',license_url:'https://gsap.com/standard-license/',attribution_required:false,attribution_text:'GSAP is bundled as the deterministic choreography runtime.',modification_allowed:true,commercial_use_allowed:true,territorial_notes:'Use subject to the bundled dependency license.',verification_date:'2026-08-01',verification_evidence:'The local gsap npm distribution is inlined at package build time; no CDN or network dependency is used.',sha256:sha(experience)});
ledger.push({asset_id:'three-runtime-inline',local_path:'experience.html',title:'Three.js runtime',creator:'Three.js authors',performer:'',source_institution:'Three.js npm distribution',source_page:'https://threejs.org/',direct_download_source:'Locally bundled from repository dependency',work_status:'Third-party software',lyrics_status:'Not applicable',recording_status:'Not applicable',artwork_status:'Not applicable',license:'MIT',license_url:'https://github.com/mrdoob/three.js/blob/dev/LICENSE',attribution_required:true,attribution_text:'Three.js is bundled locally as the spatial rendering runtime.',modification_allowed:true,commercial_use_allowed:true,territorial_notes:'MIT license.',verification_date:'2026-08-01',verification_evidence:'The local Three.js module distribution is converted to a package-local global at build time; no CDN is used.',sha256:sha(experience)});
const atlasBytes=await readFile(join(PKG,'assets','images','world-atlas.png'));ledger.push({asset_id:'masterpiece-world-atlas',local_path:'assets/images/world-atlas.png',title:'Masterpiece world material and memory atlas',creator:'OpenAI image generation directed for the Noizes Masterpiece build',performer:'',source_institution:'Original commissioned demonstration asset',source_page:'Project source: masterpiece/assets/world-atlas.png',direct_download_source:'Not applicable',work_status:'Original generated work',lyrics_status:'Not applicable',recording_status:'Not applicable',artwork_status:'Original fictional textures and environments created for this demonstration',license:'Project demonstration asset',license_url:'Not applicable',attribution_required:false,attribution_text:'No external source image used.',modification_allowed:true,commercial_use_allowed:true,territorial_notes:'Original fictional content.',verification_date:'2026-08-01',verification_evidence:'Generated specifically as a coherent 3x3 archival material atlas; no real historical person is depicted.',sha256:sha(atlasBytes)});
for(const [assetId,file,title,evidence] of [['masterpiece-exterior-panorama','exterior-panorama.png','Moonlit exterior environment panorama','Generated as an original fictional panoramic environment; no source image or real place was used.'],['masterpiece-memory-ephemera','memory-ephemera-atlas.png','Fictional hall photographs and ephemera atlas','Generated as an original fictional 4x2 archival atlas; no real person or historical document is represented.']]){const bytes=await readFile(join(PKG,'assets','images',file));ledger.push({asset_id:assetId,local_path:`assets/images/${file}`,title,creator:'OpenAI image generation directed for the Noizes Masterpiece build',performer:'',source_institution:'Original commissioned demonstration asset',source_page:`Project source: masterpiece/assets/${file}`,direct_download_source:'Not applicable',work_status:'Original generated work',lyrics_status:'Not applicable',recording_status:'Not applicable',artwork_status:'Original fictional environment and archival material',license:'Project demonstration asset',license_url:'Not applicable',attribution_required:false,attribution_text:'No external source image used.',modification_allowed:true,commercial_use_allowed:true,territorial_notes:'Original fictional content.',verification_date:'2026-08-01',verification_evidence:evidence,sha256:sha(bytes)})}
await put(join(PKG,'metadata','asset-rights-ledger.json'),json(ledger));
await put(join(PKG,'edition.json'),json({edition_id:'masterpiece-vertical-slice-001',name:'Masterpiece Edition — Threshold Vertical Slice',copy:'001 / 001',purpose:'Gate 2 creative and technical quality proof',transferable:false,simulation:true,scope:{track_id:'track-01',seconds:[0,84]}}));
await put(join(PKG,'experience.json'),json({schema_version:'3.1.0',type:'sentient-architectural-memory',default_mode:'guided',fallback_mode:'essential-paper-stage',reduced_motion_supported:true,timeline:'timeline/masterpiece-vertical-slice.json',gate:2,scope:'84-second final-quality vertical slice',principle:'Music awakens memory. Memory reconstructs space. Space reveals history. History becomes an object.'}));
await put(join(PKG,'technical.json'),json({packager:'Noizes Masterpiece vertical-slice builder 0.1.0',built_at:new Date().toISOString(),offline:true,runtime_dependencies:[{name:'GSAP',delivery:'locally bundled inline',role:'audio-reconciled choreography'}],renderer:'custom WebGL + Canvas 2D + semantic DOM',quality_profiles:['cinematic','balanced','lite','essential'],performance_governor:true,developer_cue_inspector:'?debug=1',fallback:'Essential paper stage and semantic guide'}));

const componentFor=path=>manifest.components.find(component=>component.path===path);
const refresh=async path=>{const bytes=await readFile(join(PKG,path));let component=componentFor(path);if(!component){const image=/\.(png|jpe?g|webp)$/i.test(path);component={component_id:`component-${manifest.components.length+1}`,scope:'release',type:path.endsWith('.md')?'document':path.endsWith('.json')?'timeline':image?'image':'experience',role:path==='experience.html'?'masterpiece_runtime':path.includes('timeline/')?'vertical_slice_timeline':image?'world_texture_atlas':'creative_direction',path};manifest.components.push(component)}component.size=bytes.length;component.sha256=sha(bytes)};
await refresh('experience.html');
await refresh('assets/images/world-atlas.png');
await refresh('assets/images/exterior-panorama.png');
await refresh('assets/images/memory-ephemera-atlas.png');
await refresh('timeline/masterpiece-vertical-slice.json');
for(const file of docs)await refresh(`assets/documents/${file}`);
await refresh('metadata/asset-rights-ledger.json');
await put(join(PKG,'manifest.json'),json(manifest));

const inventory=manifest.components.map(component=>`${component.path}:${component.sha256}:${component.size}`).sort().join('\n');
await put(join(PKG,'authenticity.json'),json({method:'sha256-component-inventory',hash:sha(Buffer.from(inventory)),signed:false,release_id:manifest.release.release_id,edition_id:'masterpiece-vertical-slice-001',development_signature:{status:'placeholder',statement:'Unsigned Gate 2 reference build'},components:manifest.components.map(({component_id,path,sha256,size})=>({component_id,path,sha256,size}))}));
const archive=JSON.parse(await readFile(join(PKG,'archive.json'),'utf8'));archive.package_contents=manifest.components;archive.masterpiece={gate:2,scope:'Track One, 00:00–01:24',status:'vertical slice for creative approval'};await put(join(PKG,'archive.json'),json(archive));
await put(join(PKG,'README-OFFLINE.txt'),'NOIZES MASTERPIECE EDITION — GATE 2\n\nThis package contains the 84-second Threshold vertical slice. It deliberately does not propagate the new visual language across all five tracks. Open the intact .nz in the Noizes viewer. No network is required.\n');
await rm(OUT,{force:true});
execFileSync('zip',['-q','-r',OUT,'.'],{cwd:PKG});
console.log(`Built ${OUT}`);
