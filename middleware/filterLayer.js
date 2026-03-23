/**
 * Astra A0 — Multilingual Clinical Filter Layer
 * Main orchestrator: language detection → intent classification → symptom extraction
 *   → session memory → API call → response formatting → translation
 */

const { extractSymptoms } = require('../nlp/symptomExtractor');
const { detectLanguage } = require('../nlp/languageDetector');
const { classifyIntent } = require('./intentClassifier');
const sessionManager = require('../memory/sessionManager');
const { predict } = require('../api/clinicalClient');
const {
    formatResponse, formatGreeting, formatNeedMoreSymptoms,
    formatNoSymptoms, formatReset, formatError
} = require('../utils/responseFormatter');

// Minimum symptoms to trigger API call
const MIN_SYMPTOMS_FOR_PREDICTION = 1;

/**
 * Process a user chat message through the full clinical filter pipeline.
 * 
 * @param {Object} params
 * @param {string} params.message - User's raw message
 * @param {string} params.sessionId - Session identifier
 * @param {string} [params.apiBaseUrl] - Override prediction API URL
 * @returns {Promise<Object>} Response object
 */
async function processMessage({ message, sessionId, apiBaseUrl }) {
    const startTime = Date.now();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return buildResponse('Please enter a message.', null, 'english', startTime);
    }

    if (!sessionId) {
        sessionId = 'default_' + Date.now();
    }

    const trimmed = message.trim();

    // Step 1: Detect language
    const langResult = detectLanguage(trimmed);
    const language = langResult.language;

    // Update session language
    const sessionLang = sessionManager.getLanguage(sessionId);
    const effectiveLang = sessionLang !== 'english' ? sessionLang : language;

    // Step 2: Classify intent
    const intentResult = classifyIntent(trimmed);

    // Step 3: Handle session reset
    if (intentResult.isReset) {
        sessionManager.reset(sessionId);
        const response = formatReset(effectiveLang);
        sessionManager.addToHistory(sessionId, 'user', trimmed);
        sessionManager.addToHistory(sessionId, 'assistant', response.text);
        return buildResponse(response.text, response.structured, effectiveLang, startTime);
    }

    // Step 4: Handle greeting
    if (intentResult.intent === 'GREETING') {
        const response = formatGreeting(effectiveLang);
        sessionManager.addToHistory(sessionId, 'user', trimmed);
        sessionManager.addToHistory(sessionId, 'assistant', response.text);
        return buildResponse(response.text, response.structured, effectiveLang, startTime);
    }

    // Step 5: Handle general queries
    if (intentResult.intent === 'GENERAL' && intentResult.confidence > 0.7) {
        const response = formatGreeting(effectiveLang); // Use greeting as general response
        sessionManager.addToHistory(sessionId, 'user', trimmed);
        sessionManager.addToHistory(sessionId, 'assistant', response.text);
        return buildResponse(response.text, response.structured, effectiveLang, startTime);
    }

    // Step 6: Extract symptoms (CLINICAL or EMERGENCY path)
    const extraction = extractSymptoms(trimmed, effectiveLang);

    // Step 7: Merge with session memory
    if (extraction.symptoms.length > 0) {
        sessionManager.addSymptoms(sessionId, extraction.symptoms, effectiveLang);
    }

    const allSymptoms = sessionManager.getSymptoms(sessionId);
    const finalLang = sessionManager.getLanguage(sessionId) || effectiveLang;

    // Log to history
    sessionManager.addToHistory(sessionId, 'user', trimmed);

    // Step 8: If no symptoms found at all (not in this message, not in session)
    if (allSymptoms.length === 0) {
        const response = formatNoSymptoms(finalLang);
        sessionManager.addToHistory(sessionId, 'assistant', response.text);
        return buildResponse(response.text, response.structured, finalLang, startTime);
    }

    // Step 9: If we have new symptoms but total is still low, ask for more
    if (allSymptoms.length < MIN_SYMPTOMS_FOR_PREDICTION && extraction.symptoms.length > 0) {
        const response = formatNeedMoreSymptoms(finalLang, allSymptoms);
        sessionManager.addToHistory(sessionId, 'assistant', response.text);
        return buildResponse(response.text, response.structured, finalLang, startTime);
    }

    // Step 10: Call prediction API
    const apiResult = await predict(allSymptoms, apiBaseUrl);

    if (!apiResult.success) {
        console.error('❌ Clinical API failed:', apiResult.error);
        const response = formatError(finalLang);
        sessionManager.addToHistory(sessionId, 'assistant', response.text);
        return buildResponse(response.text, response.structured, finalLang, startTime);
    }

    // Step 11: Format response with translation
    const isEmergency = intentResult.intent === 'EMERGENCY' || intentResult.emergencyDetected;
    const response = formatResponse(apiResult.data, finalLang, allSymptoms, isEmergency);

    sessionManager.addToHistory(sessionId, 'assistant', response.text);

    return buildResponse(response.text, response.structured, finalLang, startTime, {
        symptomsExtracted: extraction.symptoms,
        allSymptoms,
        intent: intentResult.intent,
        apiAttempts: apiResult.attempt,
        turnCount: sessionManager.getTurnCount(sessionId)
    });
}

/**
 * Build standard response envelope.
 */
function buildResponse(text, structured, language, startTime, meta = {}) {
    return {
        reply: text,
        language,
        structured: structured || null,
        processing_time_ms: Date.now() - startTime,
        meta: {
            ...meta,
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Express middleware factory for the /chat endpoint.
 */
function createChatMiddleware(apiBaseUrl) {
    return async (req, res) => {
        try {
            const { message, session_id } = req.body;

            if (!message) {
                return res.status(400).json({
                    error: 'Missing "message" field in request body'
                });
            }

            const result = await processMessage({
                message,
                sessionId: session_id || req.headers['x-session-id'] || ('auto_' + Date.now()),
                apiBaseUrl
            });

            res.json(result);
        } catch (err) {
            console.error('❌ Filter Layer Error:', err);
            res.status(500).json({
                error: 'Internal processing error',
                message: err.message
            });
        }
    };
}

/**
 * Get session info endpoint handler.
 */
function createSessionInfoHandler() {
    return (req, res) => {
        const sessionId = req.params.sessionId || req.query.session_id;
        if (!sessionId) {
            return res.json(sessionManager.getStats());
        }
        res.json({
            symptoms: sessionManager.getSymptoms(sessionId),
            language: sessionManager.getLanguage(sessionId),
            history: sessionManager.getHistory(sessionId),
            turns: sessionManager.getTurnCount(sessionId)
        });
    };
}

module.exports = {
    processMessage,
    createChatMiddleware,
    createSessionInfoHandler,
    sessionManager
};
