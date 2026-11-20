// ─── friendlyError.js ────────────────────────────────────────────────────────
// Never show coding words to users. Server messages sometimes contain
// technical terms (route, token, ObjectId, status codes…) — those get
// replaced with a plain fallback instead.

const TECHNICAL =
  /route|mongo|objectid|token|jwt|ecconn|econn|invalid|decrypt|encrypt|cipher|buffer|multer|payload|html|stack|exception|push|vapid|subscri|offline|network|fetch|sync|persist|localstorage|autosave|draft|\b500\b|\b404\b|\b401\b|\b413\b|\bID\b/i;

export function friendlyServerError(message, fallback) {
  if (!message || typeof message !== 'string') return fallback;
  return TECHNICAL.test(message) ? fallback : message;
}
