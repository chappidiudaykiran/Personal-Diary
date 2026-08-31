const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username: 3–30 chars'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
      // Check for existing user
      const existing = await User.findOne({ $or: [{ email }, { username }] });
      if (existing) {
        return res.status(409).json({
          message: existing.email === email ? 'Email already registered' : 'Username taken',
        });
      }

      // Generate a random salt for client-side key derivation (PBKDF2).
      // This salt is NOT used for bcrypt — bcrypt manages its own salt internally.
      // The encSalt is used ONLY on the client to derive the AES encryption key.
      const encSalt = crypto.randomBytes(32).toString('hex');

      // Create user (passwordHash field receives the plain password;
      // the pre-save hook hashes it with bcrypt)
      const user = await User.create({
        username,
        email,
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
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Find user (include passwordHash for comparison)
      const user = await User.findOne({ email }).select('+passwordHash +refreshTokens +encSalt');
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
