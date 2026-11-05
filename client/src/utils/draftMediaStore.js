// IndexedDB store for draft image/video blobs.
// File objects cannot be JSON-serialized into localStorage, so pending
// media attached to an unsaved entry is persisted here, keyed by draft.
// Values are stored as { id, blob, name, type } — File is structured-cloneable.

const DB_NAME = 'diary-drafts';
const STORE = 'media';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    } catch (_) {
      return reject(new Error('IndexedDB unavailable'));
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IDB open failed'));
  });
}

function keyFor(draftKey, id) {
  return `${draftKey}::${id}`;
}

function rangeFor(draftKey) {
  // All keys for this draft sort between these bounds ('::' prefix is fixed)
  return IDBKeyRange.bound(`${draftKey}::`, `${draftKey}::\uffff`);
}

/** Persist the current set of pending files (rewrites the whole set). */
export async function saveDraftBlobs(draftKey, entries) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(rangeFor(draftKey));
      for (const e of entries || []) {
        if (!e?.id || !e?.file) continue;
        store.put(
          { id: e.id, blob: e.file, name: e.file.name || 'file', type: e.file.type || '' },
          keyFor(draftKey, e.id)
        );
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB write failed'));
    });
  } finally {
    try { db.close(); } catch (_) {}
  }
}

/** Load all persisted blobs for a draft. Returns [{ id, blob, name, type }]. */
export async function loadDraftBlobs(draftKey) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll(rangeFor(draftKey));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('IDB read failed'));
    });
  } finally {
    try { db.close(); } catch (_) {}
  }
}

/** Delete all persisted blobs for a draft (call on save / discard). */
export async function clearDraftBlobs(draftKey) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(rangeFor(draftKey));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB delete failed'));
    });
  } finally {
    try { db.close(); } catch (_) {}
  }
}
