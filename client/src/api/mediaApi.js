import apiClient from './apiClient.js';
import { encrypt, decrypt, encryptBytes, decryptBytes } from '../crypto/cryptoUtils.js';

// Keep in sync with server/src/routes/media.js (MongoDB 16 MB doc limit)
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_ENTRY = 10;

export const MEDIA_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip';

const DOC_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

const DOC_EXTS = new Set([
  'pdf', 'txt', 'md', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip',
]);

export function kindFromMime(mime = '', name = '') {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  return 'file';
}

export function isSupportedFile(file) {
  if (!file) return false;
  if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
    return true;
  }
  if (DOC_MIMES.has(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return DOC_EXTS.has(ext);
}

export function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Encrypt a File in the browser and upload only ciphertext to the server. */
export async function uploadMediaFile(cryptoKey, entryId, file) {
  const buffer = await file.arrayBuffer();
  const { ciphertext, iv } = await encryptBytes(cryptoKey, buffer);
  const encName = await encrypt(cryptoKey, file.name || 'file');
  const encMime = await encrypt(cryptoKey, file.type || 'application/octet-stream');

  const form = new FormData();
  form.append('file', new Blob([ciphertext], { type: 'application/octet-stream' }), 'blob');
  form.append('iv', iv);
  form.append('encryptedName', encName.ciphertext);
  form.append('nameIv', encName.iv);
  form.append('encryptedMime', encMime.ciphertext);
  form.append('mimeIv', encMime.iv);

  const { data } = await apiClient.post(`/media/entries/${entryId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.media;
}

// In-memory caches — revisits and re-renders are instant, no re-decrypt lag
const metaCache = new Map();
const blobCache = new Map();

export function clearMediaCache(mediaId) {
  if (mediaId) {
    metaCache.delete(mediaId);
    const hit = blobCache.get(mediaId);
    if (hit?.url) { try { URL.revokeObjectURL(hit.url); } catch (_) {} }
    blobCache.delete(mediaId);
  } else {
    metaCache.clear();
    blobCache.forEach((hit) => { try { URL.revokeObjectURL(hit.url); } catch (_) {} });
    blobCache.clear();
  }
}

export async function listMedia(entryId) {
  const { data } = await apiClient.get(`/media/entries/${entryId}`);
  const list = data.media || [];
  for (const m of list) {
    if (m?._id && !metaCache.has(m._id)) metaCache.set(m._id, m);
  }
  return list;
}

export async function getMediaMeta(mediaId) {
  if (metaCache.has(mediaId)) return metaCache.get(mediaId);
  const { data } = await apiClient.get(`/media/${mediaId}`);
  if (data.media?._id) metaCache.set(mediaId, data.media);
  return data.media;
}

/** Decrypt filename/MIME from metadata without downloading the file itself. */
export async function decryptMediaMeta(cryptoKey, media) {
  const [name, mime] = await Promise.all([
    decrypt(cryptoKey, media.encryptedName, media.nameIv).catch(() => 'Encrypted file'),
    decrypt(cryptoKey, media.encryptedMime, media.mimeIv).catch(() => 'application/octet-stream'),
  ]);
  return { ...media, name, mime, kind: kindFromMime(mime, name) };
}

/** Download ciphertext for one media item, decrypt it, and return an object URL. */
export async function fetchDecryptedMedia(cryptoKey, mediaWithMeta) {
  const cached = blobCache.get(mediaWithMeta._id);
  if (cached?.url) return { ...cached.meta, blob: cached.blob, url: cached.url };
  const { data } = await apiClient.get(`/media/${mediaWithMeta._id}/file`, {
    responseType: 'arraybuffer',
  });
  const plain = await decryptBytes(cryptoKey, new Uint8Array(data), mediaWithMeta.iv);
  const blob = new Blob([plain], { type: mediaWithMeta.mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  blobCache.set(mediaWithMeta._id, { meta: mediaWithMeta, blob, url });
  return { ...mediaWithMeta, blob, url };
}

export async function deleteMedia(mediaId) {
  await apiClient.delete(`/media/${mediaId}`);
}

export function downloadObjectUrl(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
