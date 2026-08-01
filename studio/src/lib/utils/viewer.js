import JSZip from 'jszip';
import { validateNzArchive } from '../domain/package-validation.js';

const MIME_BY_EXTENSION = Object.freeze({
  mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4', ogg: 'audio/ogg',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf',
});

// The package runs in an opaque sandbox so untrusted experience scripts can
// never inherit the signed-in Noizes origin. Chromium blocks Blob URLs created
// by the parent from that opaque document, so validated component bytes cross
// the boundary once and become Blob URLs inside the sandbox itself.
export const VIEWER_FRAME_BOOTSTRAP = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<script>
(function(){
  window.addEventListener('message', function receive(event){
    var message=event.data;
    if(event.source!==parent||!message||message.type!=='noizes:viewer:load') return;
    window.removeEventListener('message',receive);
    try{
      var html=String(message.html||'');
      var resourceUrls={};
      (message.resources||[]).forEach(function(resource){
        var url=URL.createObjectURL(new Blob([resource.bytes],{type:resource.mime||'application/octet-stream'}));
        resourceUrls[resource.path]=url;
        html=html.split('src="'+resource.path+'"').join('src="'+url+'"');
        html=html.split('href="'+resource.path+'"').join('href="'+url+'"');
        html=html.split('"'+resource.path+'"').join('"'+url+'"');
        html=html.split("'"+resource.path+"'").join("'"+url+"'");
        html=html.split('\u0060'+resource.path+'\u0060').join('\u0060'+url+'\u0060');
      });
      var resourceScript='<scr'+'ipt>window.NZ_RESOURCE_URLS='+JSON.stringify(resourceUrls).replace(/</g,'\\u003c')+';</scr'+'ipt>';
      html=html.indexOf('</head>')>=0?html.replace('</head>',resourceScript+'</head>'):resourceScript+html;
      document.open();document.write(html);document.close();
    }catch(error){
      parent.postMessage({type:'noizes:viewer:error',message:error&&error.message||'Experience could not start.'},'*');
    }
  });
})();
</script></body></html>`;

async function readJson(zip, path) {
  const entry = zip.file(path);
  if (!entry) return {};
  try {
    return JSON.parse(await entry.async('string'));
  } catch {
    return {};
  }
}

function readStorage(storage, key) {
  if (!storage || !key) return null;
  try { return storage.getItem(key); } catch { return null; }
}

export async function prepareNzForViewer(file, options = {}) {
  // Normalizing browser File/Blob input to bytes also keeps this boundary
  // portable in runtimes whose JSZip adapter does not recognize native Blob.
  const source = typeof Blob !== 'undefined' && file instanceof Blob
    ? await file.arrayBuffer()
    : file;
  const zip = await JSZip.loadAsync(source);
  const validation = await validateNzArchive(zip, options.validationOptions);
  if (!validation.valid) {
    const failure = validation.checks.find((check) => check.status === 'fail');
    const error = new Error(`Package validation failed${failure ? `: ${failure.label} — ${failure.note}` : ''}`);
    error.validation = validation;
    throw error;
  }

  const entryPath = validation.manifest.experience?.entry || 'experience.html';
  const experience = zip.file(entryPath);
  if (!experience) throw new Error(`No ${entryPath} found. Is this a valid .nz file?`);
  let html = await experience.async('string');
  const edition = await readJson(zip, 'edition.json');
  const history = await readJson(zip, 'history.json');
  const releaseId = validation.manifest.release?.release_id || validation.manifest.release_id || 'unknown';
  const editionId = history.edition?.edition_id || edition.edition_id || edition.edition_name || 'edition';
  const copyId = history.copy?.copy_id || validation.manifest.delivery?.copy_id || 'open-copy';
  const resumeKey = `nz-release-resume:${releaseId}:${editionId}:${copyId}`;
  const noteKey = `nz-collector-note:${releaseId}:${editionId}:${copyId}`;
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  let resume = null;
  const storedResume = readStorage(storage, resumeKey);
  if (storedResume) {
    try { resume = JSON.parse(storedResume); } catch { resume = null; }
  }
  const viewerState = {
    resume,
    collector_note: readStorage(storage, noteKey) || '',
  };
  const stateScript = `window.NZ_VIEWER_STATE = ${JSON.stringify(viewerState).replace(/</g, '\\u003c')};\n`;
  const configAssignment = /window\.NZ_CONFIG\s*=/;
  html = configAssignment.test(html)
    ? html.replace(configAssignment, `${stateScript}window.NZ_CONFIG =`)
    : html.replace('</head>', `<script>${stateScript}</script></head>`);
  const resources = [];
  const declaredByPath = new Map((validation.manifest.components || []).map((component) => [component.path, component]));
  const packagePaths = new Set(declaredByPath.keys());
  zip.forEach((path, entry) => {
    if (!entry.dir && (path.startsWith('audio/') || path.startsWith('release/') || /^tracks\/[^/]+\//.test(path))) packagePaths.add(path);
  });

  for (const path of packagePaths) {
    const entry = zip.file(path);
    if (!entry) continue;
    const buffer = await entry.async('arraybuffer');
    const extension = path.split('.').pop().toLowerCase();
    const mime = declaredByPath.get(path)?.mime || MIME_BY_EXTENSION[extension] || 'application/octet-stream';
    resources.push({ path, mime, bytes: buffer });
  }

  return {
    html,
    resources,
    manifest: validation.manifest,
    validation,
    storageKeys: { resumeKey, noteKey },
  };
}
