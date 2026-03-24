/**
 * Astra R0.0 — Report Controller (Node.js Only)
 * Full pipeline: multer → OCR → parse → classify → predict → respond
 */

const fs = require('fs');
const { extractText }          = require('../services/ocrService');
const { extractPatientInfo, extractLabValues, classifyValues } = require('../services/parserService');
const { mapToSymptoms, callPredict, buildRecommendations }    = require('../services/clinicalEngine');

// The internal predict endpoint (same server)
const PORT = process.env.PORT || 10000;
const PREDICT_BASE_URL = process.env.PREDICT_API_URL || `http://localhost:${PORT}`;

async function analyzeReport(req, res) {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded. Use field name "file".' });
    }

    const { gender = '', age = '' } = req.body;
    let buffer;

    try {
        // multer memory storage → buffer already in req.file.buffer
        // multer disk storage → read from path
        if (req.file.buffer) {
            buffer = req.file.buffer;
        } else if (req.file.path) {
            buffer = fs.readFileSync(req.file.path);
            fs.unlinkSync(req.file.path); // cleanup temp file
        } else {
            return res.status(400).json({ success: false, error: 'File data not available.' });
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: `File read error: ${err.message}` });
    }

    const startMs = Date.now();

    try {
        // ── Step 1: OCR ──────────────────────────────────────────────────────
        let rawText;
        try {
            rawText = await extractText(buffer, req.file.mimetype);
        } catch (err) {
            return res.status(422).json({
                success: false,
                error: `Could not extract text: ${err.message}`,
                hint: 'Ensure PDF is not password-protected and images are clear.',
            });
        }

        if (!rawText || rawText.trim().length < 10) {
            return res.status(422).json({
                success: false,
                error: 'No readable text found in the uploaded file.',
                hint: 'Try a higher resolution scan or a digital (non-scanned) PDF.',
            });
        }

        // ── Step 2: Extract ──────────────────────────────────────────────────
        const patientRaw = extractPatientInfo(rawText);
        // Merge user-provided hints (override auto-detected)
        const patient = {
            ...patientRaw,
            gender: gender || patientRaw.gender,
            age:    age    ? parseInt(age, 10) : patientRaw.age,
        };

        const labValues  = extractLabValues(rawText);

        if (Object.keys(labValues).length === 0) {
            return res.status(422).json({
                success: false,
                error: 'No lab test values could be extracted.',
                hint: 'The report may be handwritten or not a standard lab report format.',
            });
        }

        // ── Step 3: Classify ─────────────────────────────────────────────────
        const classified = classifyValues(labValues, patient);

        // ── Step 4: Predict (via existing A0.0 engine) ───────────────────────
        const symptoms  = mapToSymptoms(classified);
        let predictions = [];
        let remedies    = {};

        if (symptoms.length > 0) {
            const predictResult = await callPredict(symptoms, PREDICT_BASE_URL);
            if (predictResult.success && predictResult.data) {
                predictions = predictResult.data.predictions || [];
                remedies    = predictResult.data.remedies    || {};
            } else {
                console.warn('[R0] Predict call failed:', predictResult.error);
            }
        }

        // ── Step 5: Build Response ────────────────────────────────────────────
        const recommendations = buildRecommendations(classified);
        const abnormalities = Object.entries(classified)
            .filter(([, v]) => v.status !== 'normal')
            .map(([key, v]) => ({
                test: key,
                displayName: v.originalName || key,
                value: v.value,
                unit: v.unit,
                status: v.status,
                referenceRange: v.referenceRange,
                deviationPct: v.deviationPct,
                isCritical: v.isCritical,
            }));

        const normalTests = Object.entries(classified)
            .filter(([, v]) => v.status === 'normal')
            .map(([key, v]) => ({
                test: key,
                displayName: v.originalName || key,
                value: v.value,
                unit: v.unit,
                referenceRange: v.referenceRange,
            }));

        const isUrgent = abnormalities.some(a => a.isCritical);

        const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);
        console.log(`[R0] ✅ Analyzed ${Object.keys(labValues).length} tests → ${abnormalities.length} abnormal | ${predictions.length} predictions | ${elapsed}s`);

        return res.json({
            success: true,
            patient,
            testsDetected: Object.keys(labValues).length,
            symptomsGenerated: symptoms,
            abnormalities,
            normalTests,
            predictions,
            remedies,
            recommendations,
            isUrgent,
            processingTimeS: parseFloat(elapsed),
            engine: 'Astra R0.0',
        });

    } catch (err) {
        console.error('[R0] ❌ Controller error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal error during report analysis.' });
    }
}

module.exports = { analyzeReport };
