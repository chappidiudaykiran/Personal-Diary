const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const Entry = require('../models/Entry');

// All entry routes require authentication
router.use(protect);

// ─── GET /api/entries ─────────────────────────────────────────────────────────
// Returns all encrypted entries for the logged-in user.
// The server only returns ciphertext — decryption happens on the client.
router.get('/', async (req, res) => {
  try {
    const entries = await Entry.find({ userId: req.user._id })
      .select('encryptedTitle iv ivContent mood wordCount createdAt updatedAt')
      .sort({ createdAt: -1 });

    res.json({ entries });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ message: 'Failed to fetch entries' });
  }
});

// ─── GET /api/entries/:id ─────────────────────────────────────────────────────
// Returns a single encrypted entry (includes encryptedContent for full view).
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid entry ID')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const entry = await Entry.findOne({ _id: req.params.id, userId: req.user._id });
      if (!entry) {
        return res.status(404).json({ message: 'Entry not found' });
      }
      res.json({ entry });
    } catch (error) {
      console.error('Get entry error:', error);
      res.status(500).json({ message: 'Failed to fetch entry' });
    }
  }
);

// ─── POST /api/entries ────────────────────────────────────────────────────────
// Save a new encrypted diary entry.
// The server receives ONLY ciphertext — it never sees the plaintext.
router.post(
  '/',
  [
    body('encryptedTitle').notEmpty().withMessage('encryptedTitle is required'),
    body('encryptedContent').notEmpty().withMessage('encryptedContent is required'),
    body('iv').notEmpty().withMessage('iv is required'),
    body('ivContent').notEmpty().withMessage('ivContent is required'),
    body('mood').optional().isIn(['happy', 'sad', 'angry', 'neutral', 'excited', 'anxious', 'grateful', '']),
    body('wordCount').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { encryptedTitle, encryptedContent, iv, ivContent, mood, wordCount } = req.body;

    try {
      const entry = await Entry.create({
        userId: req.user._id,
        encryptedTitle,
        encryptedContent,
        iv,
        ivContent,
        mood: mood || '',
        wordCount: wordCount || 0,
      });

      res.status(201).json({ message: 'Entry saved', entry });
    } catch (error) {
      console.error('Create entry error:', error);
      res.status(500).json({ message: 'Failed to save entry' });
    }
  }
);

// ─── PUT /api/entries/:id ─────────────────────────────────────────────────────
// Update an existing encrypted entry.
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid entry ID'),
    body('encryptedTitle').notEmpty().withMessage('encryptedTitle is required'),
    body('encryptedContent').notEmpty().withMessage('encryptedContent is required'),
    body('iv').notEmpty().withMessage('iv is required'),
    body('ivContent').notEmpty().withMessage('ivContent is required'),
    body('mood').optional().isIn(['happy', 'sad', 'angry', 'neutral', 'excited', 'anxious', 'grateful', '']),
    body('wordCount').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { encryptedTitle, encryptedContent, iv, ivContent, mood, wordCount } = req.body;

    try {
      const entry = await Entry.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { encryptedTitle, encryptedContent, iv, ivContent, mood: mood || '', wordCount: wordCount || 0 },
        { new: true, runValidators: true }
      );

      if (!entry) {
        return res.status(404).json({ message: 'Entry not found' });
      }

      res.json({ message: 'Entry updated', entry });
    } catch (error) {
      console.error('Update entry error:', error);
      res.status(500).json({ message: 'Failed to update entry' });
    }
  }
);

// ─── DELETE /api/entries/:id ──────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid entry ID')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const entry = await Entry.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
      if (!entry) {
        return res.status(404).json({ message: 'Entry not found' });
      }
      res.json({ message: 'Entry deleted' });
    } catch (error) {
      console.error('Delete entry error:', error);
      res.status(500).json({ message: 'Failed to delete entry' });
    }
  }
);

module.exports = router;
