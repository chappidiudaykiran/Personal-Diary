// IndexedDB store for a custom wallpaper image (too big for localStorage).

const DB_NAME = 'diary-settings';
const STORE = 'wallpapers';
const VERSION = 1;
const CUSTOM_KEY = 'custom';

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

/** Persist the custom wallpaper blob: { blob, name, type }. */
export async function saveCustomWallpaper(file) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(
        { blob: file, name: file.name || 'wallpaper', type: file.type || '' },
        CUSTOM_KEY
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB write failed'));
    });
  } finally {
    try { db.close(); } catch (_) {}
  }
}

/** Load the custom wallpaper record, or null. */
export async function loadCustomWallpaper() {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(CUSTOM_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IDB read failed'));
    });
  } finally {
    try { db.close(); } catch (_) {}
  }
}

/** Delete the custom wallpaper blob. */
export async function clearCustomWallpaper() {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(CUSTOM_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB delete failed'));
    });
  } finally {
    try { db.close(); } catch (_) {}
  }
}
