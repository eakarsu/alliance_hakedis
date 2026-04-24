const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/connection');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = path.join(uploadsDir, req.body.related_type || 'general');
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Block executable files
    const blocked = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error('File type not allowed'));
    }
    cb(null, true);
  },
});

// GET /api/attachments?related_type=X&related_id=Y
router.get('/', async (req, res) => {
  try {
    const { related_type, related_id } = req.query;
    if (!related_type || !related_id) {
      return res.status(400).json({ error: 'related_type and related_id are required' });
    }

    const result = await pool.query(
      `SELECT a.*, u.full_name AS uploaded_by_name
       FROM attachments a
       LEFT JOIN users u ON u.id = a.uploaded_by_user_id
       WHERE a.related_type = $1 AND a.related_id = $2
       ORDER BY a.created_at DESC`,
      [related_type, related_id]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Error fetching attachments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attachments - upload a file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { related_type, related_id, visibility_level, description } = req.body;
    if (!related_type || !related_id) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'related_type and related_id are required' });
    }

    const storagePath = path.relative(uploadsDir, req.file.path);

    const result = await pool.query(
      `INSERT INTO attachments (related_type, related_id, file_name, original_name, file_type, file_size, storage_path, uploaded_by_user_id, visibility_level, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        related_type, related_id,
        req.file.filename, req.file.originalname,
        req.file.mimetype, req.file.size,
        storagePath, req.user.id,
        visibility_level || 'team', description || null,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Error uploading attachment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attachments/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attachments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];
    const filePath = path.join(uploadsDir, attachment.storage_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(filePath, attachment.original_name);
  } catch (err) {
    console.error('Error downloading attachment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/attachments/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attachments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];

    // Only uploader or governance can delete
    const isGovernance = ['founding_orchestrator', 'pmo_coordinator'].includes(req.user.role);
    if (attachment.uploaded_by_user_id !== req.user.id && !isGovernance) {
      return res.status(403).json({ error: 'Only the uploader or governance can delete attachments' });
    }

    // Delete file from disk
    const filePath = path.join(uploadsDir, attachment.storage_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM attachments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error('Error deleting attachment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
