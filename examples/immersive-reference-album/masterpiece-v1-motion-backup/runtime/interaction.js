(function(N){
  class InteractionManager{
    constructor(root,memory){this.root=root;this.memory=memory;this.pointer={x:0,y:0,nx:.5,ny:.5};this.holdTimer=0;this.object=document.querySelector('#memory-object');addEventListener('pointermove',e=>{this.pointer.nx=e.clientX/innerWidth;this.pointer.ny=e.clientY/innerHeight;this.pointer.x=this.pointer.nx*2-1;this.pointer.y=this.pointer.ny*2-1},{passive:true});this.object.addEventListener('pointerdown',()=>this.startHold());this.object.addEventListener('pointerup',()=>this.cancelHold());this.object.addEventListener('pointercancel',()=>this.cancelHold());this.object.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.reveal()}})}
    startHold(){this.root.classList.add('holding');this.holdTimer=setTimeout(()=>this.reveal(),760)}
    cancelHold(){clearTimeout(this.holdTimer);this.root.classList.remove('holding')}
    reveal(){this.cancelHold();this.memory.discover('returned-key');this.root.classList.add('memory-open');document.querySelector('#object-description').textContent='The returned key was recovered. Its history is fictional and clearly labelled.';document.querySelector('#memory-close').focus()}
  }
  class ArchiveSystem{
    constructor(root){this.root=root;document.querySelector('#access').onclick=()=>this.open();document.querySelector('#guide-close').onclick=()=>this.close();document.querySelector('#memory-close').onclick=()=>{root.classList.remove('memory-open');document.querySelector('#memory-object').focus()}}
    open(){this.root.classList.add('guide-open');document.querySelector('#guide-close').focus()}
    close(){this.root.classList.remove('guide-open');document.querySelector('#access').focus()}
  }
  N.InteractionManager=InteractionManager;N.ArchiveSystem=ArchiveSystem;
})(window.NZM);
