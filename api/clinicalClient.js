/**
 * Astra A0 — Clinical API Client
 * Wraps POST /predict with retry logic, timeout handling, and error formatting.
 */

const http = require('http');
const https = require('https');
const url = require('url');

const DEFAULT_BASE_URL = process.env.PREDICT_API_URL || 'http://localhost:10000';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 10000;
const RETRY_DELAYS = [500, 1500, 3000]; // Exponential backoff

/**
 * Make an HTTP/HTTPS request with timeout.
 */
function makeRequest(reqUrl, data, timeout) {
    return new Promise((resolve, reject) => {
        const parsed = new url.URL(reqUrl);
        const isHttps = parsed.protocol === 'https:';
        const lib = isHttps ? https : http;

        const body = JSON.stringify(data);
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout
        };

        const req = lib.request(options, (res) => {
            let chunks = '';
            res.on('data', (chunk) => { chunks += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(chunks);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        reject(new Error(`API returned status ${res.statusCode}: ${json.message || chunks}`));
                    }
                } catch (e) {
                    reject(new Error(`Invalid JSON response: ${chunks.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });

        req.write(body);
        req.end();
    });
}

/**
 * Call the clinical prediction API with retry logic.
 * @param {string[]} symptoms - Array of normalized English symptom strings
 * @param {string} [baseUrl] - Override base URL
 * @returns {Promise<Object>} API response
 */
async function predict(symptoms, baseUrl) {
    const apiUrl = (baseUrl || DEFAULT_BASE_URL) + '/predict';
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await makeRequest(apiUrl, { symptoms }, TIMEOUT_MS);
            return {
                success: true,
                data: result,
                attempt: attempt + 1
            };
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ API attempt ${attempt + 1}/${MAX_RETRIES} failed: ${err.message}`);
            if (attempt < MAX_RETRIES - 1) {
                await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
            }
        }
    }

    return {
        success: false,
        error: lastError?.message || 'Unknown API error',
        data: null,
        attempt: MAX_RETRIES
    };
}

/**
 * Check API health.
 */
async function checkHealth(baseUrl) {
    const healthUrl = (baseUrl || DEFAULT_BASE_URL) + '/health';
    try {
        const parsed = new url.URL(healthUrl);
        const isHttps = parsed.protocol === 'https:';
        const lib = isHttps ? https : http;

        return new Promise((resolve) => {
            const req = lib.get(healthUrl, { timeout: 5000 }, (res) => {
                let chunks = '';
                res.on('data', c => chunks += c);
                res.on('end', () => {
                    try { resolve({ healthy: true, data: JSON.parse(chunks) }); }
                    catch { resolve({ healthy: false, error: 'Invalid response' }); }
                });
            });
            req.on('error', (e) => resolve({ healthy: false, error: e.message }));
            req.on('timeout', () => { req.destroy(); resolve({ healthy: false, error: 'Timeout' }); });
        });
    } catch (e) {
        return { healthy: false, error: e.message };
    }
}

module.exports = { predict, checkHealth };
