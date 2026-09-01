// ─── cryptoUtils.js ────────────────────────────────────────────────────────────
// All cryptographic operations run strictly on the client.
// Algorithm: AES-256-GCM (authenticated encryption)
// Key Derivation: PBKDF2 with SHA-256 (100,000 iterations)
// ──────────────────────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256; // bits

/**
 * Derive an AES-256-GCM CryptoKey from the user's password and a hex salt.
 */
export async function deriveKey(password, saltHex) {
  if (!window?.crypto?.subtle) {
    throw new Error(
      'Web Crypto API is not available on this connection. Please use HTTPS or localhost.'
    );
  }

  if (!saltHex || typeof saltHex !== 'string') {
    throw new Error('Salt is missing or invalid.');
  }

  const enc = new TextEncoder();
  const salt = hexToBytes(saltHex.trim());

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 */
export async function encrypt(key, plaintext) {
  if (!window?.crypto?.subtle) {
    throw new Error('Web Crypto API is not available.');
  }

  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

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
 * Decrypt a base64-encoded ciphertext using AES-256-GCM.
 */
export async function decrypt(key, ciphertext, iv) {
  if (!window?.crypto?.subtle) {
    throw new Error('Web Crypto API is not available.');
  }

  const dec = new TextDecoder();

  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );

  return dec.decode(plaintextBuffer);
}

// ─── PIN Storage Helpers ──────────────────────────────────────────────────────

/**
 * Encrypt data (e.g. password) with a 4-digit PIN for quick local unlock.
 */
export async function encryptWithPin(pin, plaintext) {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const pinKeyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const pinKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 50000,
      hash: 'SHA-256',
    },
    pinKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    pinKey,
    enc.encode(plaintext)
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
  };
}

/**
 * Decrypt data using the 4-digit PIN. Throws on incorrect PIN.
 */
export async function decryptWithPin(pin, ciphertext, saltBase64, ivBase64) {
  const enc = new TextEncoder();
  const salt = base64ToBytes(saltBase64);
  const iv = base64ToBytes(ivBase64);

  const pinKeyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const pinKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 50000,
      hash: 'SHA-256',
    },
    pinKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    pinKey,
    base64ToBytes(ciphertext)
  );

  return new TextDecoder().decode(decryptedBuffer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const clean = hex.trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
