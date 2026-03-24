/**
 * Astra R0.0 — Report Route
 * POST /upload-report
 * Accepts PDF and common image types up to 20MB.
 * Uses multer MEMORY storage (no temp file on disk, better for Render).
 */

const express  = require('express');
const multer   = require('multer');
const { analyzeReport } = require('../controllers/reportController');

const router = express.Router();

const ALLOWED_MIMES = new Set([
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png',
    'image/bmp',  'image/tiff', 'image/webp',
]);

// ── Memory storage (no temp files) ───────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIMES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported type "${file.mimetype}". Upload PDF, JPG, or PNG.`));
        }
    },
});

router.post(
    '/',
    (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, error: 'File exceeds 20MB limit.' });
            }
            if (err) {
                return res.status(400).json({ success: false, error: err.message });
            }
            next();
        });
    },
    analyzeReport
);

module.exports = router;
