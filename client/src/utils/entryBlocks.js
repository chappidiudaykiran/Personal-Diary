// Entry content is an ordered list of blocks so media can sit between
// paragraphs, e.g. text -> photo -> text -> video.
// The whole list is JSON-stringified and then encrypted like the old
// plain-text content, so the server format does not change.
// Serialized shape: [{ "t": "text", "v": "..." }, { "t": "media", "id": "<mediaId>", "layout": "aside", "w": 38 }]
// Media layout: "aside" = media beside text on the right side (flex row),
//   width controls how wide the media column is (20-60%).
// "block" (default) = full-width media with text below it.
// "inline" is legacy alias for "aside" kept for backwards compat.
// Legacy entries (plain text, not JSON) load as a single text block.

let counter = 0;

export function newBlockKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  counter += 1;
  return `block_${Date.now()}_${counter}`;
}

export function createTextBlock(text = '') {
  return { type: 'text', key: newBlockKey(), text };
}

const DEFAULT_ASIDE_WIDTH = 38;
const MIN_ASIDE_WIDTH = 22;
const MAX_ASIDE_WIDTH = 60;

export function clampAsideWidth(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_ASIDE_WIDTH;
  return Math.min(MAX_ASIDE_WIDTH, Math.max(MIN_ASIDE_WIDTH, Math.round(n)));
}

export function normalizeLayout(layout) {
  if (layout === 'aside' || layout === 'inline') return 'aside';
  return 'block';
}

export function createMediaBlock({ mediaId = null, file = null, layout = 'block', width } = {}) {
  const normalized = normalizeLayout(layout);
  return {
    type: 'media',
    key: newBlockKey(),
    mediaId,
    // Temporary id used in the serialized draft before the file is uploaded
    tempId: file ? newBlockKey() : null,
    file,
    layout: normalized,
    width: normalized === 'aside' ? clampAsideWidth(width ?? DEFAULT_ASIDE_WIDTH) : undefined,
  };
}

/** Parse decrypted entry content into blocks. Handles legacy plain text. */
export function parseEntryContent(plaintext) {
  if (!plaintext) return [createTextBlock('')];

  const trimmed = plaintext.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const valid =
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (b) =>
            (b?.t === 'text' && typeof b.v === 'string') ||
            (b?.t === 'media' && typeof b.id === 'string')
        );
      if (valid) {
        return parsed.map((b) =>
          b.t === 'text'
            ? createTextBlock(b.v)
            : createMediaBlock({ mediaId: b.id, layout: b.layout, width: b.w ?? b.width })
        );
      }
    } catch (_) {
      // Not JSON blocks — fall through to legacy plain text
    }
  }

  return [createTextBlock(plaintext)];
}

/** Serialize blocks for encryption. Whitespace-only text blocks are dropped. */
export function serializeBlocks(blocks) {
  const out = [];
  for (const block of blocks || []) {
    if (block.type === 'text') {
      const v = (block.text || '').trim();
      if (v) out.push({ t: 'text', v });
    } else if (block.type === 'media') {
      const id = block.mediaId || block.tempId;
      if (id) {
        const layout = normalizeLayout(block.layout);
        const item = { t: 'media', id };
        if (layout === 'aside') {
          item.layout = 'aside';
          item.w = clampAsideWidth(block.width);
        }
        out.push(item);
      }
    }
  }
  return JSON.stringify(out);
}

export function blocksToPlainText(blocks) {
  return (blocks || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('\n')
    .trim();
}

export function countBlockWords(blocks) {
  const text = blocksToPlainText(blocks);
  return text ? text.split(/\s+/).length : 0;
}

export function hasBlockContent(blocks) {
  return (blocks || []).some(
    (b) => (b.type === 'text' && b.text?.trim()) || b.type === 'media'
  );
}

export function referencedMediaIds(blocks) {
  return new Set(
    (blocks || []).filter((b) => b.type === 'media' && b.mediaId).map((b) => b.mediaId)
  );
}

/** Ensure there is always a text block to type in, including after the last media block. */
export function normalizeBlocks(blocks) {
  const list = [...(blocks || [])];
  if (list.length === 0) list.push(createTextBlock(''));
  if (list[list.length - 1].type === 'media') list.push(createTextBlock(''));
  return list;
}

export function cloneBlocks(blocks) {
  return (blocks || []).map((b) => ({ ...b }));
}
