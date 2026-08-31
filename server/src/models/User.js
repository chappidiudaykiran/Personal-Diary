const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    // passwordHash: used only for login authentication (bcrypt)
    // The actual diary encryption key is NEVER stored here —
    // it is derived from the user's password on the client side only.
    passwordHash: {
      type: String,
      required: true,
    },
    // encSalt: a random salt sent to the client so it can derive the
    // AES-256-GCM encryption key from the user's password via PBKDF2.
    // Storing the salt is safe — it's not a secret.
    encSalt: {
      type: String,
      required: true,
    },
    // refreshTokens: store hashed refresh tokens to allow logout/revocation
    refreshTokens: [
      {
        tokenHash: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    // Never return passwordHash or refreshTokens in API responses
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  // passwordHash field receives the plain password, we hash it here
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

// Compare password for login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
