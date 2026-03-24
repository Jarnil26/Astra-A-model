/**
 * Astra R0.0 — OCR Service (Node.js Only)
 * 
 * PDF  → pdf-parse (digital) → raw text
 * Image→ sharp (preprocess) → tesseract.js (WASM OCR) → raw text
 * 
 * LRU cache (50 files) based on file content hash to avoid re-processing.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Lazy-load heavy deps (avoid slowing server startup) ───────────────────────
let _pdfParse = null;
let _tesseract = null;
let _sharp = null;

function getPdfParse() {
    if (!_pdfParse) _pdfParse = require('pdf-parse');
    return _pdfParse;
}

function getSharp() {
    if (!_sharp) _sharp = require('sharp');
    return _sharp;
}

// tesseract.js createWorker is async so we maintain a pool of 1 worker
let _tesseractWorker = null;
let _tesseractReady = false;
let _tesseractQueue = [];

async function getTesseractWorker() {
    if (_tesseractReady && _tesseractWorker) return _tesseractWorker;

    if (!_tesseract) _tesseract = require('tesseract.js');

    if (!_tesseractWorker) {
        _tesseractWorker = await _tesseract.createWorker('eng', 1, {
            cacheMethod: 'none',
            logger: () => {}, // silence progress logs
        });
        _tesseractReady = true;
    }

    return _tesseractWorker;
}

// ── LRU Cache ─────────────────────────────────────────────────────────────────
const OCR_CACHE_SIZE = 50;
const _cache = new Map(); // hash → text

function cacheGet(hash) { return _cache.get(hash) || null; }
function cacheSet(hash, text) {
    if (_cache.size >= OCR_CACHE_SIZE) {
        const firstKey = _cache.keys().next().value;
        _cache.delete(firstKey);
    }
    _cache.set(hash, text);
}

function fileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

// ── PUBLIC: extract text from file buffer ─────────────────────────────────────
/**
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<string>} Extracted and cleaned text
 */
async function extractText(buffer, mimetype) {
    const hash = fileHash(buffer);
    const cached = cacheGet(hash);
    if (cached) {
        console.log(`[OCR] Cache hit for ${hash}`);
        return cached;
    }

    let rawText = '';

    if (mimetype === 'application/pdf') {
        rawText = await _extractFromPdf(buffer);
    } else if (mimetype.startsWith('image/')) {
        rawText = await _extractFromImage(buffer);
    } else {
        throw new Error(`Unsupported file type: ${mimetype}`);
    }

    const cleaned = cleanOcrText(rawText);
    cacheSet(hash, cleaned);
    console.log(`[OCR] Extracted ${cleaned.length} chars from ${mimetype} (hash ${hash})`);
    return cleaned;
}

// ── PDF Extraction ────────────────────────────────────────────────────────────
async function _extractFromPdf(buffer) {
    const pdfParse = getPdfParse();
    try {
        const result = await pdfParse(buffer, {
            // Don't load external fonts (faster, works on Render)
            max: 0,
        });
        return result.text || '';
    } catch (err) {
        throw new Error(`PDF extraction failed: ${err.message}`);
    }
}

// ── Image Extraction ──────────────────────────────────────────────────────────
async function _extractFromImage(buffer) {
    const sharp = getSharp();

    // Preprocess: grayscale → resize (min 1200px wide) → sharpen → high contrast
    let processedBuffer;
    try {
        const meta = await sharp(buffer).metadata();
        const targetWidth = Math.max(meta.width || 0, 1200);
        const scale = targetWidth / (meta.width || 1200);

        processedBuffer = await sharp(buffer)
            .resize(Math.round((meta.width || 1200) * scale), null, { kernel: 'lanczos3' })
            .grayscale()
            .sharpen({ sigma: 1.0 })
            .normalise()          // auto-contrast
            .png({ quality: 100 })
            .toBuffer();
    } catch (err) {
        console.warn('[OCR] Image preprocessing failed, using raw buffer:', err.message);
        processedBuffer = buffer;
    }

    // Run Tesseract
    const worker = await getTesseractWorker();
    try {
        const { data } = await worker.recognize(processedBuffer);
        return data.text || '';
    } catch (err) {
        throw new Error(`OCR (tesseract.js) failed: ${err.message}`);
    }
}

// ── Text Cleaning ─────────────────────────────────────────────────────────────
function cleanOcrText(text) {
    if (!text) return '';

    return text
        // Fix common OCR artifacts
        .replace(/[–—]/g, '-')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        // Remove form-feed characters
        .replace(/\f/g, '\n')
        // Normalize multiple spaces (but preserve newlines)
        .replace(/[ \t]+/g, ' ')
        // Collapse 3+ consecutive newlines to 2
        .replace(/\n{3,}/g, '\n\n')
        // Remove lines with only special chars / page numbers
        .split('\n')
        .filter(line => line.trim().length >= 2)
        .map(line => line.trim())
        .join('\n');
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function terminateWorker() {
    if (_tesseractWorker) {
        await _tesseractWorker.terminate();
        _tesseractWorker = null;
        _tesseractReady = false;
    }
}

process.on('exit', () => { if (_tesseractWorker) _tesseractWorker.terminate(); });

module.exports = { extractText, cleanOcrText, terminateWorker };
