// ─── cryptoUtils.js ────────────────────────────────────────────────────────────
// All encryption/decryption happens HERE — in the browser.
// The server and database NEVER see plaintext diary content.
//
// Algorithm: AES-256-GCM (authenticated encryption)
// Key Derivation: PBKDF2 with SHA-256 (100,000 iterations)
// ──────────────────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256; // bits
const SALT_BYTES = 32;

/**
 * Derive an AES-256-GCM CryptoKey from the user's password and a hex salt.
 * This key is used to encrypt/decrypt diary entries.
 * The key is NEVER sent to the server or stored anywhere.
 *
 * @param {string} password - The user's plain password
 * @param {string} saltHex  - The encSalt from the server (hex string)
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, saltHex) {
  const enc = new TextEncoder();
  const salt = hexToBytes(saltHex);

  // Import the raw password as a base key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive an AES-GCM key using PBKDF2
  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false, // not extractable — key cannot be exported or read
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Encrypt a plaintext string using the derived AES-256-GCM key.
 * A unique random IV is generated for every encryption call.
 *
 * @param {CryptoKey} key   - The AES-GCM key from deriveKey()
 * @param {string} plaintext - The diary content to encrypt
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 *          Both values are base64-encoded strings safe for JSON/DB storage.
 */
export async function encrypt(key, plaintext) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64(iv),
  };
}

/**
 * Decrypt a base64-encoded ciphertext using the derived AES-256-GCM key.
 * Authentication tag is verified automatically — any tampering will throw.
 *
 * @param {CryptoKey} key        - The AES-GCM key from deriveKey()
 * @param {string} ciphertext    - Base64 ciphertext
 * @param {string} iv            - Base64 IV
 * @returns {Promise<string>}    - The decrypted plaintext
 */
export async function decrypt(key, ciphertext, iv) {
  const dec = new TextDecoder();

  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );

  return dec.decode(plaintextBuffer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64) {
  return new Uint8Array(
    atob(base64)
      .split('')
      .map((c) => c.charCodeAt(0))
  );
}
