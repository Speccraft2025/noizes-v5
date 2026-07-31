const MB = 1024 * 1024;
const GB = 1024 * MB;

function assetSize(asset) {
  return Math.max(0, Number(asset?.size ?? asset?.file?.size) || 0);
}

function assetRecord(asset, scope, trackId = '') {
  const size = assetSize(asset);
  return {
    asset_id: asset.asset_id || asset.id || '',
    scope,
    track_id: trackId || asset.track_id || '',
    role: asset.role || 'supporting',
    type: asset.type || asset.file?.type?.split('/')[0] || 'unknown',
    filename: asset.filename || asset.name || asset.file?.name || '',
    mime: asset.mime || asset.file?.type || '',
    size,
    data_uri_size: size ? Math.ceil(size / 3) * 4 : 0,
  };
}

export function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

export function estimatePackageSize(project = {}, extras = {}) {
  const assets = [
    ...(project.release_assets || []).map((asset) => assetRecord(asset, 'release')),
    ...(project.audio_assets || []).map((asset) => assetRecord(asset, asset.scope || (asset.track_id ? 'track' : 'release'), asset.track_id)),
    ...(project.track_assets || []).map((asset) => assetRecord(asset, 'track', asset.track_id)),
    ...((extras.pdfs || []).map((pdf) => assetRecord({ ...pdf, type: 'document', role: 'notes', filename: pdf.name }, 'release'))),
  ];
  const originalBytes = assets.reduce((total, asset) => total + asset.size, 0);
  const dataUriBytes = assets.reduce((total, asset) => total + asset.data_uri_size, 0);
  const perTrack = (project.tracks || []).map((track) => {
    const trackAssets = assets.filter((asset) => asset.track_id === track.track_id);
    return {
      track_id: track.track_id,
      title: track.title || '',
      size: trackAssets.reduce((total, asset) => total + asset.size, 0),
      asset_count: trackAssets.length,
      stem_size: trackAssets.filter((asset) => asset.role === 'stem').reduce((total, asset) => total + asset.size, 0),
    };
  });
  const releaseBytes = assets.filter((asset) => asset.scope === 'release').reduce((total, asset) => total + asset.size, 0);
  // JSZip holds input bytes, generated output, and compression buffers while
  // compiling. This is deliberately conservative and is shown as an estimate.
  const browserMemoryEstimate = Math.ceil(originalBytes * 2.35 + 24 * MB);
  const warnings = [];
  const add = (severity, code, message) => warnings.push({ severity, code, message });
  if (originalBytes >= GB) add('critical', 'package_over_1gb', 'This package exceeds 1 GB. Compilation and copy personalization may fail on memory-constrained browsers.');
  else if (originalBytes >= 500 * MB) add('high', 'package_over_500mb', 'This package exceeds 500 MB. Use a desktop browser with ample free memory.');
  else if (originalBytes >= 100 * MB) add('notice', 'package_over_100mb', 'Large package: compilation and offline opening will take longer.');
  if (browserMemoryEstimate >= GB) add('high', 'browser_memory_over_1gb', `Estimated compilation working memory is ${formatBytes(browserMemoryEstimate)}.`);
  for (const asset of assets.filter((item) => item.type === 'video' || item.mime.startsWith('video/'))) {
    add(asset.size >= 250 * MB ? 'high' : 'notice', 'video_asset', `Video “${asset.filename || asset.role}” adds ${formatBytes(asset.size)} and may strain mobile playback.`);
  }
  for (const track of perTrack.filter((item) => item.stem_size >= 100 * MB)) {
    add(track.stem_size >= 500 * MB ? 'high' : 'notice', 'large_stems', `Stems for “${track.title || track.track_id}” total ${formatBytes(track.stem_size)}.`);
  }
  if (dataUriBytes - originalBytes >= 25 * MB) {
    add('notice', 'data_uri_expansion', `Embedding every asset would add about ${formatBytes(dataUriBytes - originalBytes)} before HTML overhead; Noizes keeps masters as archive files instead.`);
  }
  return {
    original_bytes: originalBytes,
    estimated_archive_bytes: originalBytes,
    all_assets_data_uri_bytes: dataUriBytes,
    data_uri_expansion_bytes: Math.max(0, dataUriBytes - originalBytes),
    browser_memory_estimate_bytes: browserMemoryEstimate,
    release_bytes: releaseBytes,
    per_track: perTrack,
    assets,
    warnings,
  };
}
