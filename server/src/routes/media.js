const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const Entry = require('../models/Entry');
const Media = require('../models/Media');

// Each file is encrypted in the browser before upload, so what arrives here
// is opaque ciphertext. We cap the ciphertext at 10 MB (MongoDB's 16 MB
// document limit leaves headroom for metadata) and 10 files per entry.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_ENTRY = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  // +1 KB headroom: ciphertext is plaintext + 16-byte GCM tag, plus multipart overhead
  limits: { fileSize: MAX_FILE_BYTES + 1024, files: 1 },
});

router.use(protect);

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── POST /api/media/entries/:entryId ─────────────────────────────────────────
// Upload one encrypted file to an entry. Multipart fields:
//   file (binary ciphertext), iv, encryptedName, nameIv, encryptedMime, mimeIv
router.post('/entries/:entryId', upload.single('file'), async (req, res) => {
  try {
    if (!isValidId(req.params.entryId)) {
      return res.status(400).json({ message: 'Invalid entry ID' });
    }

    const { iv, encryptedName, nameIv, encryptedMime, mimeIv } = req.body || {};
    if (!req.file || !iv || !encryptedName || !nameIv || !encryptedMime || !mimeIv) {
      return res.status(400).json({ message: 'Missing encrypted file or metadata' });
    }

    const entry = await Entry.findOne({ _id: req.params.entryId, userId: req.user._id }).select('_id');
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    const count = await Media.countDocuments({ entryId: entry._id, userId: req.user._id });
    if (count >= MAX_FILES_PER_ENTRY) {
      return res.status(400).json({ message: `Maximum ${MAX_FILES_PER_ENTRY} files per entry` });
    }

    const media = await Media.create({
      userId: req.user._id,
      entryId: entry._id,
      data: req.file.buffer,
      iv,
      encryptedName,
      nameIv,
      encryptedMime,
      mimeIv,
      size: req.file.size,
    });

    res.status(201).json({
      message: 'Media uploaded',
      media: {
        _id: media._id,
        entryId: media.entryId,
        iv: media.iv,
        encryptedName: media.encryptedName,
        nameIv: media.nameIv,
        encryptedMime: media.encryptedMime,
        mimeIv: media.mimeIv,
        size: media.size,
        createdAt: media.createdAt,
      },
    });
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ message: 'Failed to upload media' });
  }
});

// ─── GET /api/media/entries/:entryId ──────────────────────────────────────────
// List media metadata for an entry (no file bytes — client fetches each file).
router.get('/entries/:entryId', async (req, res) => {
  try {
    if (!isValidId(req.params.entryId)) {
      return res.status(400).json({ message: 'Invalid entry ID' });
    }

    const entry = await Entry.findOne({ _id: req.params.entryId, userId: req.user._id }).select('_id');
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    const media = await Media.find({ entryId: entry._id, userId: req.user._id })
      .select('iv encryptedName nameIv encryptedMime mimeIv size createdAt entryId')
      .sort({ createdAt: 1 })
      .lean();

    res.json({ media });
  } catch (error) {
    console.error('List media error:', error);
    res.status(500).json({ message: 'Failed to fetch media' });
  }
});

// ─── GET /api/media/:mediaId/file ─────────────────────────────────────────────
// Download the ciphertext bytes. Client decrypts them into a Blob.
router.get('/:mediaId/file', async (req, res) => {
  try {
    if (!isValidId(req.params.mediaId)) {
      return res.status(400).json({ message: 'Invalid media ID' });
    }

    const media = await Media.findOne({ _id: req.params.mediaId, userId: req.user._id }).select('data iv');
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': media.data.length,
      'X-Media-IV': media.iv,
      'Cache-Control': 'private, no-store',
    });
    res.send(media.data);
  } catch (error) {
    console.error('Download media error:', error);
    res.status(500).json({ message: 'Failed to download media' });
  }
});

// ─── DELETE /api/media/:mediaId ───────────────────────────────────────────────
router.delete('/:mediaId', async (req, res) => {
  try {
    if (!isValidId(req.params.mediaId)) {
      return res.status(400).json({ message: 'Invalid media ID' });
    }

    const media = await Media.findOneAndDelete({ _id: req.params.mediaId, userId: req.user._id });
    if (!media) {
      return res.status(404).json({ message: 'Media not found' });
    }

    res.json({ message: 'Media deleted' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ message: 'Failed to delete media' });
  }
});

// Multer errors (e.g. file too large) → 400 instead of 500
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10 MB)' : 'Upload failed: ' + err.message;
    return res.status(400).json({ message });
  }
  next(err);
});

module.exports = router;
module.exports.MAX_FILES_PER_ENTRY = MAX_FILES_PER_ENTRY;
module.exports.MAX_FILE_BYTES = MAX_FILE_BYTES;
