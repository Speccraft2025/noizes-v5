(function(N){
  class InteractionManager{
    constructor(root,memory){this.root=root;this.memory=memory;this.pointer={x:0,y:0,nx:.5,ny:.5};this.holdTimer=0;this.object=document.querySelector('#key-presence');addEventListener('pointermove',e=>{this.pointer.nx=e.clientX/innerWidth;this.pointer.ny=e.clientY/innerHeight;this.pointer.x=this.pointer.nx*2-1;this.pointer.y=this.pointer.ny*2-1},{passive:true});this.object.addEventListener('pointerdown',()=>this.startHold());this.object.addEventListener('pointerup',()=>this.cancelHold());this.object.addEventListener('pointercancel',()=>this.cancelHold());this.object.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.reveal()}});addEventListener('pointerdown',e=>this.disturb(e),{passive:true})}
    startHold(){this.root.classList.add('reaching');this.holdTimer=setTimeout(()=>this.reveal(),760)}
    cancelHold(){clearTimeout(this.holdTimer);this.root.classList.remove('reaching')}
    reveal(){this.cancelHold();this.memory.discover('returned-key');this.root.classList.add('memory-open');document.querySelector('#memory-description').textContent='The returned key has been recovered. Its engraving reads RETURNED; its owner and address are intentionally undocumented.';document.querySelector('#world-inscription').style.opacity='.8';setTimeout(()=>this.root.classList.remove('memory-open'),5200)}
    disturb(event){this.root.style.setProperty('--presence-x',`${event.clientX}px`);this.root.style.setProperty('--presence-y',`${event.clientY}px`)}
  }
  class ArchiveSystem{
    constructor(root){this.root=root;document.querySelector('#guide-open').onclick=()=>this.open();document.querySelector('#guide-close').onclick=()=>this.close()}
    open(){this.root.classList.add('guide-open');document.querySelector('#guide-close').focus()}
    close(){this.root.classList.remove('guide-open');document.querySelector('#guide-open').focus()}
  }
  N.InteractionManager=InteractionManager;N.ArchiveSystem=ArchiveSystem;
})(window.NZM);
