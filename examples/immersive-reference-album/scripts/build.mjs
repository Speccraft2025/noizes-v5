import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const PKG = join(ROOT, 'build', 'The-House-That-Remembered-Us');
const OUT = join(ROOT, 'dist', 'The-House-That-Remembered-Us.nz');
const VERIFIED = '2026-08-01';
const tracks = [
  { id:'track-01', title:'Home, Sweet Home', room:'The Front Hall', loc:'jukebox-3500', performer:'Harry Macdonough; Charles D’Almaine', creators:'Henry R. Bishop; John Howard Payne', date:'1902-01-23', vocal:true, lyrics:["'Mid pleasures and palaces though we may roam","Be it ever so humble, there's no place like home","A charm from the skies seems to hallow us there","Which, seek through the world, is ne'er met with elsewhere","Home, home, sweet, sweet home","There's no place like home"] },
  { id:'track-02', title:'Old Folks at Home', room:'The Parlour', loc:'jukebox-131451', performer:'Elsie Baker', creators:'Stephen Collins Foster; George Rosey', date:'1912-03-04', vocal:true, lyrics:['Way down upon the Swanee River','Far, far away','There is where my heart is turning ever','There is where the voices call','All the world is sad and dreary','Everywhere I roam'] },
  { id:'track-03', title:'Auld Lang Syne', room:'The Kitchen', loc:'jukebox-647677', performer:'Columbia Mixed Chorus', creators:'Traditional; Robert Burns', date:'1912-10-07', vocal:true, lyrics:['Should auld acquaintance be forgot','And never brought to mind','Should auld acquaintance be forgot','And days of auld lang syne','For auld lang syne, my dear','For auld lang syne','We’ll take a cup of kindness yet','For auld lang syne'] },
  { id:'track-04', title:'Nearer, My God, to Thee', room:'The Locked Room', loc:'jukebox-133256', performer:'John McCormack', creators:'Lowell Mason; Sarah Flower Adams', date:'1913-05-01', vocal:true, lyrics:['Nearer, my God, to thee','Nearer to thee','E’en though it be a cross','That raiseth me','Still all my song shall be','Nearer, my God, to thee'] },
  { id:'track-05', title:'Auld Lang Syne — Instrumental', room:'The Garden at Dawn', loc:'jukebox-243247', performer:'Christopher H. H. Booth', creators:'Traditional; Robert Burns', date:'1904-06-13', vocal:false, lyrics:[] }
];
const sha = b => createHash('sha256').update(b).digest('hex');
const json = v => JSON.stringify(v, null, 2) + '\n';
async function put(path, value){ await mkdir(dirname(path),{recursive:true}); await writeFile(path,value); }
function sh(cmd,args){ return execFileSync(cmd,args,{encoding:'utf8'}); }

await rm(join(ROOT,'build'),{recursive:true,force:true});
await mkdir(join(ROOT,'dist'),{recursive:true});
for(const dir of ['audio','lyrics','timeline','scenes/rooms','scenes/objects','assets/images','assets/documents','metadata']) await mkdir(join(PKG,dir),{recursive:true});

const fetched=[];
for(const [i,t] of tracks.entries()){
  const sourcePage=`https://www.loc.gov/item/${t.loc}/`;
  const snapshot=join(ROOT,'sources','original',`${t.loc}-source-page.html`);
  let html='';
  try { html=await readFile(snapshot,'utf8'); }
  catch {
    try { html=sh('curl',['-L','--fail','--retry','5','--retry-delay','3','--user-agent','NoizesReferenceBuilder/0.1','--silent','--max-time','90',`${sourcePage}?embed=resources`]); }
    catch { throw new Error(`Unable to preserve source evidence for ${t.loc}`); }
    await put(snapshot,html);
  }
  const urls=[...html.matchAll(/https:\/\/tile\.loc\.gov\/streaming-services\/[^"'<> ]+?default\.mp3/g)].map(m=>m[0].replaceAll('&amp;','&'));
  if(!urls.length) throw new Error(`No institutional MP3 download found for ${t.loc}`);
  const original=join(ROOT,'sources','original',`${t.loc}.mp3`);
  try { await access(original); }
  catch {
    try { sh('curl',['-L','--fail','--retry','5','--retry-delay','3','--user-agent','NoizesReferenceBuilder/0.1','--silent','--max-time','120',urls[0],'-o',original]); }
    catch { throw new Error(`Unable to download ${t.loc}`); }
  }
  const mp3=join(PKG,'audio',`${t.id}.mp3`), ogg=join(PKG,'audio',`${t.id}.ogg`);
  sh('ffmpeg',['-y','-loglevel','error','-i',original,'-map_metadata','-1','-ac','2','-ar','44100','-b:a','128k',mp3]);
  sh('ffmpeg',['-y','-loglevel','error','-i',original,'-map_metadata','-1','-ac','2','-ar','44100','-c:a','libvorbis','-q:a','4',ogg]);
  t.duration_ms=Math.round(Number(sh('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',mp3]).trim())*1000);
  if(t.vocal){
    const start=9000, usable=Math.max(20000,t.duration_ms-18000), step=usable/t.lyrics.length;
    const lrc=['[ar:'+t.performer+']','[ti:'+t.title+']','[by:Noizes reference synchronization — 2026]'];
    t.lyrics.forEach((line,n)=>{const sec=(start+n*step)/1000; const mm=Math.floor(sec/60),ss=(sec%60).toFixed(2).padStart(5,'0');lrc.push(`[${String(mm).padStart(2,'0')}:${ss}]${line}`)});
    await put(join(PKG,'lyrics',`${t.id}.lrc`),lrc.join('\n')+'\n');
  }
  const cueTimes=[0,.16,.38,.62,.82].map(x=>Math.round(t.duration_ms*x)/1000);
  await put(join(PKG,'timeline',`${t.id}.timeline.json`),json({schema_version:'0.1.0',track_id:t.id,duration_ms:t.duration_ms,cues:[
    {time:cueTimes[0],action:'scene.enter',target:t.room,duration:2,easing:'easeInOutCubic'},
    {time:cueTimes[1],action:'light.fade',target:'memory-light',value:.62,duration:4},
    {time:cueTimes[2],action:'object.reveal',target:['photograph','letter','watch','provenance-book','house-miniature'][i],duration:3},
    {time:cueTimes[3],action:'camera.move',target:'room-depth',duration:6,easing:'easeInOutCubic'},
    {time:cueTimes[4],action:'environment.change',target:i===4?'dawn':'memory-weather',duration:8}
  ]}));
  fetched.push({t,sourcePage,direct:urls[0],mp3,ogg,snapshot,original});
}

await copyFile(join(ROOT,'src','experience.html'),join(PKG,'experience.html'));
await copyFile(join(ROOT,'src','assets','cover.png'),join(PKG,'assets','images','cover.png'));
const narratives={prologue:'The demolition notice arrived before the key. At dusk, a fictional archivist enters a house that remembers its former occupants through rooms, recordings and ordinary things.',epilogue:'At dawn, the house is not rescued from time. It is made portable: a record of attention, context and care.',tracks:tracks.map((t,i)=>({track_id:t.id,room:t.room,introduction:['The threshold recognizes a melody before it recognizes you.','The parlour keeps warmth in the shape of dust.','A table recalls every cup raised and every chair left empty.','Behind the locked door, grief has rearranged the furniture.','Morning turns the building into an object small enough to preserve.'][i],object_history:['A key tagged RETURNED, though no one recorded by whom.','A photograph whose fictional sitters are deliberately unnamed.','A recipe card stained by imagined summers.','A stopped watch marking no historical event.','A provenance book distinguishing memory from ownership.'][i]}))};
await put(join(PKG,'narrative.json'),json(narratives));
await put(join(PKG,'edition.json'),json({edition_id:'archive-demo-001',name:'Archive Demonstration Edition',copy:'001 / 001',purpose:'Non-commercial reference object',transferable:false,simulation:true}));
await put(join(PKG,'provenance.json'),json({simulation:true,notice:'All events below are fictional demonstrations, not claims of ownership or institutional authentication.',events:['Created','Curated','Packaged','Validated','Exhibited','Preserved'].map((type,i)=>({event_id:`sim-${i+1}`,type,status:'SIMULATED',at:`2026-08-01T0${i}:00:00Z`}))}));
await put(join(PKG,'rights.json'),json({status:'public-domain-source-set',territorial_scope:'Verified for United States use. International users must assess local term rules.',credit_line:'Source recordings: Library of Congress, National Jukebox.',fictional_content:'Original Noizes demonstration narrative, dedicated to CC0 1.0.'}));
await put(join(PKG,'credits.json'),json({records:fetched.flatMap(({t})=>[{credit_id:`${t.id}-performer`,name:t.performer,role:'Performer',track_ids:[t.id]},{credit_id:`${t.id}-creator`,name:t.creators,role:'Composition / lyrics',track_ids:[t.id]}]).concat([{credit_id:'loc',name:'Library of Congress, National Jukebox',role:'Source institution',track_ids:tracks.map(t=>t.id)},{credit_id:'memory-choir',name:'The Memory Choir',role:'Fictional album artist and narrative identity',track_ids:tracks.map(t=>t.id)}]),tracks:tracks.map(t=>({track_id:t.id,linked_release_credit_ids:[`${t.id}-performer`,`${t.id}-creator`]}))}));
await put(join(PKG,'technical.json'),json({packager:'Noizes immersive reference builder 0.1.0',built_at:new Date().toISOString(),offline:true,runtime_dependencies:[],modes:['full','balanced','lite','accessible'],fallback:'Canvas 2D / semantic archive'}));
await put(join(PKG,'experience.json'),json({schema_version:'3.0.0',type:'guided-spatial-album',default_mode:'guided',fallback_mode:'cinematic-2d',reduced_motion_supported:true,timeline:'timeline/album.timeline.json',principle:'The Noizes experience amplifies the emotional arc of the work. It must never compete with the work for attention.'}));
await put(join(PKG,'timeline','album.timeline.json'),json({schema_version:'0.1.0',master_clock:'audio.currentTime',seek_policy:'reconstruct-latest-state',tracks:tracks.map(t=>({track_id:t.id,path:`timeline/${t.id}.timeline.json`,room:t.room})),transitions:tracks.slice(0,-1).map((t,i)=>({from:t.id,to:tracks[i+1].id,type:'continuous-dissolve',duration_ms:2500}))}));
await put(join(PKG,'scenes','house.scene.json'),json({scene_id:'memory-house',style:'archival-paper-theatre',continuous:true,rooms:tracks.map((t,i)=>({id:t.room,depth:i,track_id:t.id})),fallback:'semantic archive and CSS diorama'}));
await put(join(PKG,'scenes','objects','objects.json'),json({objects:['photograph','phonograph','letter','recipe','watch','drawing','window','mirror','suitcase','cabinet','sheet-music','programme','provenance-book'].map((id,i)=>({id,category:['NARRATIVE','MUSIC','ARCHIVAL','VISUAL','CREDITS','RIGHTS','PROVENANCE','TECHNICAL'][i%8],fictional:i<10}))}));
await put(join(PKG,'metadata','accessibility.json'),json({wcag_target:'2.2 AA',keyboard:true,touch:true,tv_remote:true,reduced_motion:true,high_contrast:true,pinned_lyrics:true,screen_reader_archive:true,no_flashing:true}));
await put(join(PKG,'metadata','track-notes.json'),json(narratives.tracks));
await put(join(PKG,'metadata','album-notes.json'),json({descriptor:'An archival journey through rooms, voices and objects left behind by people who once lived inside a disappearing house.',curatorial_statement:'This fictional memory-house places verified archival recordings inside an authored spatial narrative. The sources are real; the family and events are not.'}));

const components=[];
const addComponent=async(path,type,role,track_id)=>{const b=await readFile(join(PKG,path));components.push({component_id:`component-${components.length+1}`,scope:track_id?'track':'release',...(track_id?{track_id}:{}),type,role,path,size:b.length,sha256:sha(b)});};
for(const t of tracks){await addComponent(`audio/${t.id}.mp3`,'audio','primary_master',t.id);await addComponent(`audio/${t.id}.ogg`,'audio','fallback_master',t.id);if(t.vocal)await addComponent(`lyrics/${t.id}.lrc`,'lyrics','synchronized_lyrics',t.id);await addComponent(`timeline/${t.id}.timeline.json`,'timeline','authored_cues',t.id)}
for(const [path,type,role] of [['timeline/album.timeline.json','timeline','album_timeline'],['scenes/house.scene.json','scene','continuous_world'],['scenes/objects/objects.json','scene','interactive_objects']]) await addComponent(path,type,role);
await addComponent('assets/images/cover.png','image','cover_artwork');
const ledger=[];
for(const {t,sourcePage,direct,mp3,ogg} of fetched){for(const p of [mp3,ogg]){const b=await readFile(p);ledger.push({asset_id:`${t.id}-${basename(p).split('.').pop()}`,local_path:relative(PKG,p),title:t.title,creator:t.creators,performer:t.performer,source_institution:'Library of Congress, National Jukebox',source_page:sourcePage,direct_download_source:direct,work_status:'Public domain — published composition before 1929',lyrics_status:t.vocal?'Public domain — text first published before 1929':'Not applicable',recording_status:`Public domain in the United States — sound recording published ${t.date.slice(0,4)}, before 1923`,artwork_status:'Not applicable',license:'Public Domain (United States)',license_url:'https://www.loc.gov/collections/national-jukebox/about-this-collection/rights-and-access/',attribution_required:false,attribution_text:'Library of Congress, National Jukebox.',modification_allowed:true,commercial_use_allowed:true,territorial_notes:'U.S. determination under the Music Modernization Act; international status may differ.',verification_date:VERIFIED,verification_evidence:`LOC item page identifies recording date ${t.date}; LOC states pre-1923 recordings entered the U.S. public domain on 2022-01-01.`,sha256:sha(b)})}}
const coverBytes=await readFile(join(PKG,'assets','images','cover.png'));ledger.push({asset_id:'original-cover-art',local_path:'assets/images/cover.png',title:'The House That Remembered Us — cover',creator:'OpenAI image generation directed by Noizes reference build',performer:'',source_institution:'Original commissioned demonstration asset',source_page:'Project source: src/assets/cover.png',direct_download_source:'Not applicable',work_status:'Original work',lyrics_status:'Not applicable',recording_status:'Not applicable',artwork_status:'Original generated artwork dedicated to CC0 1.0 for this reference object',license:'CC0 1.0',license_url:'https://creativecommons.org/publicdomain/zero/1.0/',attribution_required:false,attribution_text:'No attribution required',modification_allowed:true,commercial_use_allowed:true,territorial_notes:'Worldwide CC0 dedication to the extent permitted by law.',verification_date:VERIFIED,verification_evidence:'Generated specifically for this fictional reference album; no external input image was used.',sha256:sha(coverBytes)});
await put(join(PKG,'metadata','asset-rights-ledger.json'),json(ledger));
await addComponent('metadata/asset-rights-ledger.json','metadata','rights_ledger');
const release={release_id:'nz-house-remembered-001',release_type:'album',title:'The House That Remembered Us',primary_artist:'The Memory Choir',year:'2026',genre:['Archival','Immersive'],language:['en'],track_count:tracks.length,disc_count:1,total_duration_ms:tracks.reduce((s,t)=>s+t.duration_ms,0),description:'An archival journey through rooms, voices and objects left behind by people who once lived inside a disappearing house.'};
const manifest={noizes_version:'1.0.0',format:'noizes',format_version:'5.0',package_type:'music_release',release,tracks:tracks.map((t,i)=>({track_id:t.id,disc_number:1,track_number:i+1,position:i+1,title:t.title,primary_artist:t.performer,primary_audio_component:components.find(c=>c.track_id===t.id&&c.role==='primary_master').component_id,duration_ms:t.duration_ms,hidden:false,bonus:false})),components,experience:{entry:'experience.html',schema:'3.0.0',template:'immersive-reference-0.1',type:'guided-spatial-album',default_mode:'guided',timeline:'timeline/album.timeline.json',fallback_mode:'cinematic-2d',reduced_motion_supported:true},edition:{path:'edition.json',edition_id:'archive-demo-001',applies_to:'release'},authenticity:{path:'authenticity.json',method:'sha256-component-inventory'},rights:{path:'rights.json'},archive:{path:'archive.json',schema:'1.0.0'},history:{path:'history.json',scope:'release_copy'},extensions:{'org.noizes.immersive':{version:'0.1.0'}},created_at:new Date().toISOString(),artist:release.primary_artist,title:release.title,release_id:release.release_id,year:release.year};
const inventory=components.map(c=>`${c.path}:${c.sha256}:${c.size}`).sort().join('\n');
await put(join(PKG,'authenticity.json'),json({method:'sha256-component-inventory',hash:sha(Buffer.from(inventory)),signed:false,release_id:release.release_id,development_signature:{status:'placeholder',statement:'Unsigned local reference build'},components:components.map(({component_id,path,sha256,size})=>({component_id,path,sha256,size}))}));
await put(join(PKG,'archive.json'),json({release,package_contents:components,notes:narratives,rights:'rights.json'}));
await put(join(PKG,'history.json'),json({copy:{copy_id:'archive-demo-copy-001',copy_number:1},scope:'release_copy',simulation:true,provenance:'provenance.json'}));
await put(join(PKG,'manifest.json'),json(manifest));
await put(join(PKG,'README-OFFLINE.txt'),'NOIZES .nz OFFLINE PACKAGE\n\nOpen the intact .nz in the Noizes /open viewer, or extract it and serve this folder with any local static server. experience.html remains the default entry point. No network is required.\n');
await rm(OUT,{force:true});
execFileSync('zip',['-q','-r',OUT,'.'],{cwd:PKG});
console.log(`Built ${OUT}`);
