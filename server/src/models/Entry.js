const mongoose = require('mongoose');

// IMPORTANT: The server ONLY stores encrypted data.
// - encryptedContent: AES-256-GCM ciphertext of the diary entry body (base64)
// - encryptedTitle:   AES-256-GCM ciphertext of the entry title (base64)
// - iv:               Initialization Vector used during encryption (base64, not secret)
// Decryption ONLY happens on the client side using the user's derived key.
// Even the database admin cannot read the diary contents.

const entrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Encrypted title (AES-256-GCM ciphertext, base64 encoded)
    encryptedTitle: {
      type: String,
      required: true,
    },
    // Encrypted diary body (AES-256-GCM ciphertext, base64 encoded)
    encryptedContent: {
      type: String,
      required: true,
    },
    // IV used for encrypting the TITLE (base64). Each entry has a unique IV.
    iv: {
      type: String,
      required: true,
    },
    // IV used for encrypting the CONTENT (base64). Separate from title IV.
    ivContent: {
      type: String,
      required: true,
    },
    // Optional unencrypted metadata — user controls whether to fill this
    mood: {
      type: String,
      enum: ['happy', 'sad', 'angry', 'neutral', 'excited', 'anxious', 'grateful', ''],
      default: '',
    },
    // Approximate word count (computed client-side before encryption, for display)
    wordCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only access their own entries
entrySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Entry', entrySchema);
