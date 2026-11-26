const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Entry = require('../models/Entry');
const Media = require('../models/Media');
const { sendResetCode } = require('../config/mailer');

// Normalize email the same way express-validator's normalizeEmail() does on register.
// In particular, Gmail ignores dots and +subaddress, and validator strips them
// by default — so b.sailajanarayan17@gmail.com is stored as bsailajanarayan17@gmail.com.
// Login must apply the same transform or the lookup misses.
const normalizeEmailForLookup = (input) => {
  const lower = (input || '').trim().toLowerCase();
  const parts = lower.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return lower; // username, not an email
  let [local, domain] = parts;
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com' || domain === 'google.com') {
    local = local.split('+')[0].replace(/\./g, '');
  } else {
    // Match validator.js default: lowercase subaddress handling for other providers
    // is off, so keep local part as-is (already lowercased).
  }
  return `${local}@${domain}`;
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg,
        errors: errors.array() 
      });
    }

    const { username, email, password } = req.body;
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      // Check for existing user (case-insensitive)
      const existing = await User.findOne({
        $or: [
          { email: cleanEmail },
          { username: new RegExp(`^${cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ],
      });

      if (existing) {
        return res.status(409).json({
          message: existing.email.toLowerCase() === cleanEmail ? 'Email already registered' : 'Username taken',
        });
      }

      // Generate a random salt for client-side key derivation (PBKDF2).
      // This salt is NOT used for bcrypt — bcrypt manages its own salt internally.
      // The encSalt is used ONLY on the client to derive the AES encryption key.
      const encSalt = crypto.randomBytes(32).toString('hex');

      // Create user (passwordHash field receives the plain password;
      // the pre-save hook hashes it with bcrypt)
      const user = await User.create({
        username: cleanUsername,
        email: cleanEmail,
        passwordHash: password,
        encSalt,
      });

      const { accessToken, refreshToken } = generateTokens(user._id);

      // Store hashed refresh token
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      user.refreshTokens.push({ tokenHash: refreshTokenHash });
      await user.save();

      // Send encSalt back so client can derive the encryption key immediately
      res.status(201).json({
        message: 'Account created successfully',
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          encSalt: user.encSalt,
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg,
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;
    const cleanIdentifier = (email || '').trim();
    const normalizedEmail = normalizeEmailForLookup(cleanIdentifier);
    const rawEmailLower = cleanIdentifier.toLowerCase();

    try {
      // Find user by either email (case-insensitive + Gmail dot-normalized to match
      // register's normalizeEmail()) OR username (case-insensitive)
      const escapedIdentifier = cleanIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const user = await User.findOne({
        $or: [
          { email: normalizedEmail },
          // Fallback for accounts created before normalization / non-gmail variants
          ...(normalizedEmail !== rawEmailLower ? [{ email: rawEmailLower }] : []),
          { username: new RegExp(`^${escapedIdentifier}$`, 'i') },
        ],
      }).select('+passwordHash +refreshTokens +encSalt');

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const { accessToken, refreshToken } = generateTokens(user._id);

      // Clean up old refresh tokens (keep last 5) and add new one
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      user.refreshTokens = user.refreshTokens.slice(-4);
      user.refreshTokens.push({ tokenHash: refreshTokenHash });
      await user.save();

      // Return encSalt so client can derive the AES encryption key from the password
      res.json({
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          encSalt: user.encSalt,   // ← client uses this + password to derive key
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  }
);

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Verify token hash exists in the DB
    let validToken = false;
    for (const storedToken of user.refreshTokens) {
      const match = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (match) {
        validToken = true;
        break;
      }
    }
    if (!validToken) {
      return res.status(401).json({ message: 'Invalid or revoked refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    const newHash = await bcrypt.hash(newRefreshToken, 10);
    user.refreshTokens.push({ tokenHash: newHash });
    await user.save();

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        encSalt: req.user.encSalt,
        createdAt: req.user.createdAt,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
// Safe to change: username is not used for encryption (only password+encSalt).
router.put(
  '/profile',
  protect,
  [body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const cleanUsername = (req.body.username || '').trim();

    try {
      const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await User.findOne({
        _id: { $ne: req.user._id },
        username: new RegExp(`^${escaped}$`, 'i'),
      });
      if (existing) {
        return res.status(409).json({ message: 'Username taken' });
      }

      req.user.username = cleanUsername;
      await req.user.save();

      res.json({
        message: 'Profile updated',
        user: {
          id: req.user._id,
          username: req.user.username,
          email: req.user.email,
          encSalt: req.user.encSalt,
          createdAt: req.user.createdAt,
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Server error while updating profile' });
    }
  }
);

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
// Sends a 6-digit OTP to the user's email. Always returns generic success
// to avoid account enumeration.
router.post(
  '/forgot-password',
  [body('email').notEmpty().withMessage('Email is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const normalizedEmail = normalizeEmailForLookup(req.body.email);
    const rawEmailLower = (req.body.email || '').trim().toLowerCase();
    try {
      const user = await User.findOne({
        $or: [{ email: normalizedEmail }, ...(normalizedEmail !== rawEmailLower ? [{ email: rawEmailLower }] : [])],
      });
      // Generic response even if user not found.
      if (!user) {
        return res.json({ message: 'If an account exists for this email, a reset code was sent.' });
      }
      const code = crypto.randomInt(100000, 1000000).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      user.resetPasswordCodeHash = codeHash;
      user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save({ validateBeforeSave: false });
      try {
        await sendResetCode(user.email, code);
      } catch (mailErr) {
        console.error('Reset email failed:', mailErr.message);
        // Still return generic success; code is in logs only when SMTP missing.
      }
      return res.json({ message: 'If an account exists for this email, a reset code was sent.' });
    } catch (error) {
      console.error('Forgot-password error:', error);
      return res.status(500).json({ message: 'Server error, please try again' });
    }
  }
);

// ─── POST /api/auth/reset-password ────────────────────────────────────────
// Verifies OTP + sets a new password. Wipes encrypted diary data because the
// encryption key is derived from the old password and cannot be recovered.
router.post(
  '/reset-password',
  [
    body('email').notEmpty().withMessage('Email is required'),
    body('code').notEmpty().isLength({ min: 6, max: 6 }).withMessage('6-digit code required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const normalizedEmail = normalizeEmailForLookup(req.body.email);
    const rawEmailLower = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();
    try {
      const user = await User.findOne({
        $or: [{ email: normalizedEmail }, ...(normalizedEmail !== rawEmailLower ? [{ email: rawEmailLower }] : [])],
      }).select('+resetPasswordCodeHash +resetPasswordExpires +refreshTokens');
      if (!user || !user.resetPasswordCodeHash || !user.resetPasswordExpires) {
        return res.status(400).json({ message: 'Invalid or expired code' });
      }
      if (user.resetPasswordExpires.getTime() < Date.now()) {
        user.resetPasswordCodeHash = null;
        user.resetPasswordExpires = null;
        await user.save({ validateBeforeSave: false });
        return res.status(400).json({ message: 'Code expired, request a new one' });
      }
      const incomingHash = crypto.createHash('sha256').update(code).digest('hex');
      const a = Buffer.from(incomingHash, 'hex');
      const b = Buffer.from(user.resetPasswordCodeHash, 'hex');
      const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!valid) {
        return res.status(400).json({ message: 'Invalid or expired code' });
      }
      // Set new password (pre-save hook bcrypt-hashes it), rotate encSalt so the
      // new key can't decrypt old entries, clear sessions + reset OTP.
      user.passwordHash = req.body.newPassword;
      user.encSalt = crypto.randomBytes(32).toString('hex');
      user.resetPasswordCodeHash = null;
      user.resetPasswordExpires = null;
      user.refreshTokens = [];
      await user.save();
      // Wipe old encrypted data — unreadable with the new password.
      await Promise.all([
        Entry.deleteMany({ userId: user._id }),
        Media.deleteMany({ userId: user._id }),
      ]);
      return res.json({ message: 'Password reset successful. Your old encrypted entries were deleted.' });
    } catch (error) {
      console.error('Reset-password error:', error);
      return res.status(500).json({ message: 'Server error, please try again' });
    }
  }
);

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.id).select('+refreshTokens');
      if (user) {
        // Remove all stored refresh tokens (logout from all devices)
        user.refreshTokens = [];
        await user.save();
      }
    } catch (_) {
      // Token invalid — still return 200 (logout is best-effort)
    }
  }

  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
