const mongoose = require('mongoose');

// Media is stored ZERO-KNOWLEDGE, same as entry text:
// - data:          AES-256-GCM ciphertext of the raw file bytes (encrypted in the browser)
// - iv:            IV for `data` (base64, not secret)
// - encryptedName: AES-256-GCM ciphertext of the original filename
// - encryptedMime: AES-256-GCM ciphertext of the original MIME type
// The server never sees the plaintext file, its name, or its type.
const mediaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Entry',
      required: true,
      index: true,
    },
    // Encrypted file bytes
    data: {
      type: Buffer,
      required: true,
    },
    // IV used to encrypt `data` (base64)
    iv: {
      type: String,
      required: true,
    },
    // Encrypted original filename + its IV
    encryptedName: {
      type: String,
      required: true,
    },
    nameIv: {
      type: String,
      required: true,
    },
    // Encrypted original MIME type + its IV
    encryptedMime: {
      type: String,
      required: true,
    },
    mimeIv: {
      type: String,
      required: true,
    },
    // Size of the ciphertext in bytes (plaintext size + 16-byte GCM tag)
    size: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

mediaSchema.index({ entryId: 1, createdAt: 1 });

module.exports = mongoose.model('Media', mediaSchema);
