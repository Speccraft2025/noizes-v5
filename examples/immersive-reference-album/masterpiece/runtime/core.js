window.NZM=window.NZM||{};
(function(N){
  class MemoryState{
    constructor(){this.discovered=new Set();this.phase='dormant';this.sliceComplete=false}
    discover(id){this.discovered.add(id)}
    has(id){return this.discovered.has(id)}
    reset(){this.discovered.clear();this.phase='dormant';this.sliceComplete=false}
  }
  class AudioClock{
    constructor(audio){this.audio=audio;this.listeners=new Set();this.duration=84;this.previewTime=null;this.frame=this.frame.bind(this);this.raf=0}
    setSource(path){this.audio.src=window.NZ_RESOURCE_URLS?.[path]||path;this.audio.load()}
    async start(){this.previewTime=null;await this.audio.play();this.raf=requestAnimationFrame(this.frame)}
    frame(){const time=this.previewTime??this.time;for(const fn of this.listeners)fn(time,this.previewTime===null?this.audio.paused:true);this.raf=requestAnimationFrame(this.frame)}
    onFrame(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
    get time(){return Math.min(this.duration,Number.isFinite(this.audio.currentTime)?this.audio.currentTime:0)}
    seek(time){this.audio.currentTime=Math.max(0,Math.min(this.duration,time));for(const fn of this.listeners)fn(this.time,this.audio.paused)}
    preview(time){this.previewTime=Math.max(0,Math.min(this.duration,time));this.audio.pause();for(const fn of this.listeners)fn(this.previewTime,true)}
    toggle(){this.previewTime=null;return this.audio.paused?this.audio.play():this.audio.pause()}
    destroy(){cancelAnimationFrame(this.raf);this.listeners.clear()}
  }
  class CueEngine{
    constructor(){this.cues=[
      {at:0,phase:'object',description:'A sealed archival album object floats in a dark conservation space. Its surface contains the outline of a house.'},
      {at:12,phase:'fall',description:'The object unfolds into architectural planes. The listener falls through enlarged paper fibers into darkness.'},
      {at:24,phase:'reconstruction',description:'Stone steps, porch, walls, windows and a distant hallway gather into a full-scale house around the listener.'},
      {at:38,phase:'breath',description:'The house flexes subtly. Windows tremble, timber settles and moonlit dust is displaced.'},
      {at:50,phase:'inscription',description:'Condensation forms on real window glass. The first lyric clears through its surface.',lyric:'’Mid pleasures and palaces though we may roam'},
      {at:62,phase:'key',description:'An oxidized brass key settles with weight onto the hallway table.',object:'The returned key is ready to reach toward.'},
      {at:72,phase:'photograph',description:'A physical photograph beside the door develops, gains depth and begins matching the hallway behind it.'},
      {at:78,phase:'passage',description:'The camera crosses the photograph frame. Exterior sound is filtered as the remembered hall opens around the listener.'},
      {at:82,phase:'complete',description:'The listener stands inside the remembered front hall. The world continues beyond the creative gate.'}
    ]}
    resolve(time){let cue=this.cues[0];for(const candidate of this.cues){if(candidate.at<=time)cue=candidate;else break}return cue}
  }
  class PerformanceGovernor{
    constructor(root){this.root=root;this.profiles=['cinematic','balanced','lite','essential'];this.index=matchMedia('(max-width:700px)').matches?1:0;this.samples=[];this.last=performance.now();this.manual=false;this.apply()}
    sample(now){const dt=now-this.last;this.last=now;if(dt>0&&dt<250){this.samples.push(dt);if(this.samples.length>120)this.samples.shift()}if(!this.manual&&this.samples.length===120){const avg=this.samples.reduce((a,b)=>a+b,0)/this.samples.length;if(avg>30&&this.index<2){this.index++;this.apply();this.samples=[]}}}
    cycle(){this.manual=true;this.index=(this.index+1)%this.profiles.length;this.apply();return this.profile}
    apply(){this.profile=this.profiles[this.index];this.root.dataset.quality=this.profile;this.root.style.setProperty('--render-scale',[2,1.5,1,1][this.index])}
    get particles(){return [120,70,35,0][this.index]}
  }
  class AccessibilityController{
    constructor(root){this.root=root;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.root.dataset.motion=this.reduced?'reduced':'full';this.highContrast=false}
    toggleMotion(){this.reduced=!this.reduced;this.root.dataset.motion=this.reduced?'reduced':'full';return this.reduced}
    toggleContrast(){this.highContrast=!this.highContrast;this.root.dataset.contrast=this.highContrast?'high':'standard';return this.highContrast}
  }
  class SpatialAudioSystem{
    constructor(audio){this.audio=audio;this.ready=false;this.emitters=0;this.lastCue=''}
    async start(){if(this.ready){await this.context.resume();return}const A=window.AudioContext||window.webkitAudioContext;if(!A)return;this.context=new A();this.master=this.context.createGain();this.musicBus=this.context.createGain();this.worldBus=this.context.createGain();this.objectBus=this.context.createGain();this.transitionBus=this.context.createGain();this.musicBus.gain.value=1;this.worldBus.gain.value=.06;this.objectBus.gain.value=.12;this.transitionBus.gain.value=.08;for(const bus of [this.musicBus,this.worldBus,this.objectBus,this.transitionBus])bus.connect(this.master);this.master.connect(this.context.destination);this.source=this.context.createMediaElementSource(this.audio);this.source.connect(this.musicBus);this.outside=this.noiseEmitter(-4,2,-6,.028,480);this.house=this.noiseEmitter(0,1,-10,.018,115);this.emitters=2;this.ready=true;await this.context.resume()}
    noiseEmitter(x,y,z,level,cutoff){const length=this.context.sampleRate*2,buffer=this.context.createBuffer(1,length,this.context.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<length;i++){last=last*.94+(Math.random()*2-1)*.06;data[i]=last}const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;const gain=this.context.createGain();gain.gain.value=level;const pan=this.context.createStereoPanner();pan.pan.value=Math.max(-1,Math.min(1,x/8));source.connect(filter).connect(gain).connect(pan).connect(this.worldBus);source.start();return{source,filter,gain,pan,position:{x,y,z}}}
    update(time,cue){if(!this.ready)return;const inside=Math.max(0,Math.min(1,(time-76)/7));this.outside.filter.frequency.setTargetAtTime(480-inside*330,this.context.currentTime,.15);this.outside.gain.gain.setTargetAtTime(.028*(1-inside*.7),this.context.currentTime,.2);this.house.gain.gain.setTargetAtTime(.01+.025*Math.max(0,Math.min(1,(time-36)/8)),this.context.currentTime,.2);if(cue.phase==='key'&&this.lastCue!=='key')this.keyChime();this.lastCue=cue.phase}
    keyChime(){const now=this.context.currentTime,osc=this.context.createOscillator(),gain=this.context.createGain(),pan=this.context.createStereoPanner();osc.type='sine';osc.frequency.setValueAtTime(1460,now);osc.frequency.exponentialRampToValueAtTime(720,now+.42);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.045,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.65);pan.pan.value=.35;osc.connect(gain).connect(pan).connect(this.objectBus);osc.start(now);osc.stop(now+.7)}
  }
  N.MemoryState=MemoryState;N.AudioClock=AudioClock;N.CueEngine=CueEngine;N.PerformanceGovernor=PerformanceGovernor;N.AccessibilityController=AccessibilityController;N.SpatialAudioSystem=SpatialAudioSystem;
})(window.NZM);
