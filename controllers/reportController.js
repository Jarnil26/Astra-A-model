/**
 * Astra R0.0 — Report Controller
 * Orchestrates file → Python engine → response sanitization → JSON reply
 */

const fs = require('fs');
const { analyzeWithPython } = require('../services/pythonClient');
const { sanitizeReportResponse } = require('../utils/parser');

/**
 * POST /upload-report
 * Handles the file, calls the Python microservice, and returns structured JSON.
 */
async function analyzeReport(req, res) {
    const filePath = req.file?.path;

    if (!filePath) {
        return res.status(400).json({
            error: 'No file uploaded. Please attach a file with field name "file".',
        });
    }

    try {
        const { gender = '', age = '' } = req.body;

        // Call Python engine
        const rawResult = await analyzeWithPython(filePath, {
            gender: gender.trim(),
            age: age.trim(),
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
        });

        // Sanitize / guarantee shape
        const result = sanitizeReportResponse(rawResult);

        return res.json({
            success: true,
            ...result,
        });

    } catch (err) {
        console.error('❌ R0 Controller Error:', err.message);

        // Differentiate known Python errors from unexpected ones
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            error: err.message || 'Report analysis failed.',
            hint: err.hint || null,
        });

    } finally {
        // Always clean up temp file
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
        }
    }
}

module.exports = { analyzeReport };
