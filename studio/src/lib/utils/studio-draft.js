const DB_NAME = 'noizes-studio';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DRAFT_VERSION = 1;

function draftKey(userId) {
  const scopedUser = String(userId || '').trim();
  if (!scopedUser) throw new Error('A signed-in creator is required to save a Studio draft.');
  return `active:${scopedUser}`;
}

function isBlob(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

export function sanitizeDraftForJson(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (isBlob(value)) return null;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return null;
  seen.add(value);
  const sanitized = Array.isArray(value)
    ? value.map((entry) => sanitizeDraftForJson(entry, seen))
    : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeDraftForJson(entry, seen)]));
  seen.delete(value);
  return sanitized;
}

function envelope(snapshot, savedAt = new Date().toISOString()) {
  return { draft_version: DRAFT_VERSION, saved_at: savedAt, snapshot };
}

function defaultBrowserStorage(name) {
  try { return globalThis[name] || null; } catch { return null; }
}

function openDatabase(indexedDBRef) {
  return new Promise((resolve, reject) => {
    const request = indexedDBRef.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open Studio draft storage.'));
  });
}

async function idbSet(indexedDBRef, key, value) {
  const db = await openDatabase(indexedDBRef);
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save Studio draft.'));
      transaction.onabort = () => reject(transaction.error || new Error('Studio draft save was interrupted.'));
    });
  } finally {
    db.close();
  }
}

async function idbGet(indexedDBRef, key) {
  const db = await openDatabase(indexedDBRef);
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Could not restore Studio draft.'));
    });
  } finally {
    db.close();
  }
}

export async function saveStudioDraft(userId, snapshot, options = {}) {
  const key = draftKey(userId);
  const record = envelope(snapshot, options.savedAt);
  const indexedDBRef = Object.hasOwn(options, 'indexedDBRef') ? options.indexedDBRef : defaultBrowserStorage('indexedDB');
  const storage = Object.hasOwn(options, 'storage') ? options.storage : defaultBrowserStorage('localStorage');
  const driver = options.driver;
  let durableFiles = false;
  let recoverySaved = false;

  if (driver) {
    await driver.set(key, record);
    durableFiles = true;
  } else if (indexedDBRef) {
    try {
      await idbSet(indexedDBRef, key, record);
      durableFiles = true;
    } catch {
      durableFiles = false;
    }
  }

  try {
    storage?.setItem(`noizes:${key}`, JSON.stringify(envelope(sanitizeDraftForJson(snapshot), record.saved_at)));
    recoverySaved = Boolean(storage);
  } catch {
    // IndexedDB remains authoritative when localStorage is full or disabled.
  }

  if (!durableFiles && !recoverySaved) throw new Error('This browser does not provide persistent draft storage.');
  return { savedAt: record.saved_at, durableFiles, storage: durableFiles ? 'indexeddb' : 'localstorage' };
}

export async function loadStudioDraft(userId, options = {}) {
  const key = draftKey(userId);
  const indexedDBRef = Object.hasOwn(options, 'indexedDBRef') ? options.indexedDBRef : defaultBrowserStorage('indexedDB');
  const storage = Object.hasOwn(options, 'storage') ? options.storage : defaultBrowserStorage('localStorage');
  const driver = options.driver;

  if (driver) {
    const record = await driver.get(key);
    if (record?.snapshot) return { ...record, storage: 'indexeddb', durableFiles: true };
  } else if (indexedDBRef) {
    try {
      const record = await idbGet(indexedDBRef, key);
      if (record?.snapshot) return { ...record, storage: 'indexeddb', durableFiles: true };
    } catch {
      // Fall through to the metadata-only recovery copy.
    }
  }

  try {
    const record = JSON.parse(storage?.getItem(`noizes:${key}`) || 'null');
    return record?.snapshot ? { ...record, storage: 'localstorage', durableFiles: false } : null;
  } catch {
    return null;
  }
}
