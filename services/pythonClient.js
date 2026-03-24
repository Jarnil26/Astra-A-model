/**
 * Astra R0.0 — Python Client (HTTP)
 * Sends the uploaded file to the FastAPI engine on port 8001 for analysis.
 * Uses node-fetch or built-in form-data construction.
 * Falls back to spawn-based approach if HTTP microservice not running.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const REPORT_ENGINE_URL = process.env.REPORT_ENGINE_URL || 'http://localhost:8001';
const TIMEOUT_MS = 90_000; // 90s for OCR/large PDFs

/**
 * Send file to Python /analyze endpoint.
 * @param {string} filePath - Absolute path to temp file
 * @param {Object} meta - { gender, age, filename, mimetype }
 */
async function analyzeWithPython(filePath, meta = {}) {
    // Build multipart/form-data manually (no external dependency)
    const boundary = `------AstraR0Boundary${Date.now()}`;
    const fileBuffer = fs.readFileSync(filePath);
    const filename = meta.filename || path.basename(filePath);
    const mimetype = meta.mimetype || 'application/octet-stream';

    const parts = [];

    // file part
    parts.push(
        Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
            `Content-Type: ${mimetype}\r\n\r\n`
        ),
        fileBuffer,
        Buffer.from('\r\n')
    );

    // gender hint
    if (meta.gender) {
        parts.push(
            Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="gender"\r\n\r\n` +
                `${meta.gender}\r\n`
            )
        );
    }

    // age hint
    if (meta.age) {
        parts.push(
            Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="age"\r\n\r\n` +
                `${meta.age}\r\n`
            )
        );
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const parsed = new URL(REPORT_ENGINE_URL + '/analyze');
    const lib = parsed.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length,
            },
            timeout: TIMEOUT_MS,
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        const err = new Error(json.detail || json.error || `Python engine returned HTTP ${res.statusCode}`);
                        err.statusCode = res.statusCode === 422 ? 422 : 502;
                        err.hint = 'The report could not be processed. Check image quality.';
                        reject(err);
                    }
                } catch (e) {
                    const err = new Error(`Invalid response from report engine: ${data.substring(0, 200)}`);
                    err.statusCode = 502;
                    reject(err);
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            const err = new Error('Report analysis timed out (90s). Try a smaller or clearer file.');
            err.statusCode = 504;
            reject(err);
        });

        req.on('error', (e) => {
            const err = new Error(
                'Report engine is not available. ' +
                'Please ensure the Python service is running (python python_engine/app.py).'
            );
            err.statusCode = 503;
            reject(err);
        });

        req.write(body);
        req.end();
    });
}

module.exports = { analyzeWithPython };
