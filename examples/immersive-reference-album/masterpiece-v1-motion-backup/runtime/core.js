window.NZM=window.NZM||{};
(function(N){
  class MemoryState{
    constructor(){this.discovered=new Set();this.phase='dormant';this.sliceComplete=false}
    discover(id){this.discovered.add(id)}
    has(id){return this.discovered.has(id)}
    reset(){this.discovered.clear();this.phase='dormant';this.sliceComplete=false}
  }
  class AudioClock{
    constructor(audio){this.audio=audio;this.listeners=new Set();this.duration=84;this.frame=this.frame.bind(this);this.raf=0}
    setSource(path){this.audio.src=window.NZ_RESOURCE_URLS?.[path]||path;this.audio.load()}
    async start(){await this.audio.play();this.raf=requestAnimationFrame(this.frame)}
    frame(){for(const fn of this.listeners)fn(this.time,this.audio.paused);this.raf=requestAnimationFrame(this.frame)}
    onFrame(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
    get time(){return Math.min(this.duration,Number.isFinite(this.audio.currentTime)?this.audio.currentTime:0)}
    seek(time){this.audio.currentTime=Math.max(0,Math.min(this.duration,time));for(const fn of this.listeners)fn(this.time,this.audio.paused)}
    toggle(){return this.audio.paused?this.audio.play():this.audio.pause()}
    destroy(){cancelAnimationFrame(this.raf);this.listeners.clear()}
  }
  class CueEngine{
    constructor(){this.cues=[
      {at:0,phase:'dormant',label:'Dormant',line:'The recording has found the house. The house has not yet found itself.',description:'A sealed miniature house waits in darkness.'},
      {at:12,phase:'outline',label:'Pressure',line:'A melody presses against the architecture from the inside.',description:'Graphite edges gather into the outline of a front door.'},
      {at:24,phase:'breathing',label:'First breath',line:'The frame expands by less than an inch. The whole house inhales.',description:'The unfinished house takes one slow architectural breath.'},
      {at:36,phase:'inscription',label:'Inscription',line:'The voice leaves warmth on the cold glass.',description:'The first lyric forms as condensation on the door glass.',lyric:'’Mid pleasures and palaces though we may roam'},
      {at:47,phase:'key',label:'Recovered object',line:'Something brass remembers the shape of a hand.',description:'A returned brass key gathers from dust near the threshold.',object:'The returned key is ready to inspect.'},
      {at:63,phase:'photograph',label:'Recognition',line:'The key does not open the door. It opens the photograph.',description:'A photograph develops in front of the door and acquires impossible depth.'},
      {at:72,phase:'passage',label:'Photograph entry',line:'The image is no longer evidence of a room. It is the room.',description:'The camera passes through the photograph into the first remembered interior.'},
      {at:82,phase:'complete',label:'Gate 2',line:'The photograph remembers the room behind it.',description:'The vertical slice resolves inside the remembered front hall.'}
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
  N.MemoryState=MemoryState;N.AudioClock=AudioClock;N.CueEngine=CueEngine;N.PerformanceGovernor=PerformanceGovernor;N.AccessibilityController=AccessibilityController;
})(window.NZM);
