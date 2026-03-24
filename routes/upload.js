/**
 * Astra R0.0 — Upload Route
 * Multer middleware for multipart/form-data file upload.
 * Accepts PDF and common image formats up to 20MB.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const reportController = require('../controllers/reportController');

const router = express.Router();

// ── TEMP UPLOAD DIR ──────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(require('os').tmpdir(), 'astra-r0-uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── MULTER CONFIG ────────────────────────────────────────────────────────────
const ALLOWED_MIMES = new Set([
    'application/pdf',
    'image/jpeg', 'image/jpg',
    'image/png', 'image/bmp',
    'image/tiff', 'image/webp',
]);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const suffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `report-${suffix}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIMES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Upload PDF or image.`));
        }
    },
});

// ── ROUTES ───────────────────────────────────────────────────────────────────

/**
 * POST /upload-report
 * Body (multipart): file, gender (optional), age (optional)
 */
router.post(
    '/',
    (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File too large. Maximum allowed: 20MB.' });
            }
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            next();
        });
    },
    reportController.analyzeReport
);

module.exports = router;
