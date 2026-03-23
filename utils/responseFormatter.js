/**
 * Astra A0 — Response Formatter
 * Converts API JSON into human-friendly responses, translated to user's language.
 */

const { t } = require('./translator');

/**
 * Format prediction API response into human-readable text.
 * @param {Object} apiData - Raw API response from /predict
 * @param {string} language - User's detected language
 * @param {string[]} allSymptoms - All accumulated symptoms
 * @param {boolean} emergencyDetected - Whether emergency was flagged
 * @returns {{ text: string, structured: Object }}
 */
function formatResponse(apiData, language, allSymptoms, emergencyDetected) {
    const lang = language || 'english';
    const lines = [];

    // Emergency warning (top priority)
    if (emergencyDetected) {
        lines.push(t('emergency_warning', lang));
        lines.push('');
    }

    // Symptoms confirmation
    if (allSymptoms && allSymptoms.length > 0) {
        lines.push(t('symptoms_noted', lang) + allSymptoms.join(', '));
        lines.push('');
    }

    // If no API data, return basic response
    if (!apiData) {
        lines.push(t('api_error', lang));
        return { text: lines.join('\n'), structured: null };
    }

    // Diagnosis Results
    if (apiData.predictions && apiData.predictions.length > 0) {
        lines.push(t('diagnosis_header', lang));
        lines.push('─'.repeat(30));

        apiData.predictions.forEach((pred, i) => {
            const pct = Math.round((pred.confidence || 0) * 100);
            const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
            const marker = i === 0 ? ' ⭐' : '';
            lines.push(`  ${i + 1}. ${pred.disease} — ${pct}% ${bar}${marker}`);
        });
        lines.push('');
    }

    // Dosha info
    if (apiData.dosha && apiData.dosha.length > 0) {
        lines.push(`🔮 Dosha: ${apiData.dosha.join(', ')}`);
        lines.push('');
    }

    // Remedies
    if (apiData.remedies) {
        const { herbs, home_remedies, yoga, lifestyle } = apiData.remedies;

        const hasAny = [herbs, home_remedies, yoga, lifestyle].some(a => a && a.length > 0);
        if (hasAny) {
            lines.push(t('remedies_header', lang));
            lines.push('─'.repeat(30));

            if (herbs && herbs.length > 0) {
                lines.push(`${t('herbs_label', lang)}: ${capitalize(herbs).join(', ')}`);
            }
            if (home_remedies && home_remedies.length > 0) {
                lines.push(`${t('home_remedies_label', lang)}: ${capitalize(home_remedies).join(', ')}`);
            }
            if (yoga && yoga.length > 0) {
                lines.push(`${t('yoga_label', lang)}: ${capitalize(yoga).join(', ')}`);
            }
            if (lifestyle && lifestyle.length > 0) {
                lines.push(`${t('lifestyle_label', lang)}: ${capitalize(lifestyle).join(', ')}`);
            }
            lines.push('');
        }
    }

    // Active patterns
    if (apiData.active_patterns && apiData.active_patterns.length > 0) {
        lines.push(`🔍 Pattern: ${apiData.active_patterns.join(', ')}`);
        lines.push('');
    }

    // Disclaimer
    lines.push(t('disclaimer', lang));

    // Build structured response
    const structured = {
        predictions: apiData.predictions || [],
        dosha: apiData.dosha || [],
        remedies: apiData.remedies || {},
        active_patterns: apiData.active_patterns || [],
        symptoms_used: allSymptoms || [],
        language: lang,
        emergency: emergencyDetected
    };

    return {
        text: lines.join('\n'),
        structured
    };
}

/**
 * Format a greeting response.
 */
function formatGreeting(language) {
    return { text: t('greeting_response', language || 'english'), structured: null };
}

/**
 * Format a "need more info" response.
 */
function formatNeedMoreSymptoms(language, currentSymptoms) {
    const lang = language || 'english';
    const lines = [];
    if (currentSymptoms && currentSymptoms.length > 0) {
        lines.push(t('symptoms_noted', lang) + currentSymptoms.join(', '));
    }
    lines.push(t('more_symptoms_prompt', lang));
    return { text: lines.join('\n'), structured: null };
}

/**
 * Format "no symptoms found" response.
 */
function formatNoSymptoms(language) {
    return { text: t('no_symptoms_found', language || 'english'), structured: null };
}

/**
 * Format session reset response.
 */
function formatReset(language) {
    return { text: t('session_reset', language || 'english'), structured: null };
}

/**
 * Format API error response.
 */
function formatError(language) {
    return { text: t('api_error', language || 'english'), structured: null };
}

// Helper: capitalize first letter of each item
function capitalize(arr) {
    return arr.map(s => s.charAt(0).toUpperCase() + s.slice(1));
}

module.exports = {
    formatResponse,
    formatGreeting,
    formatNeedMoreSymptoms,
    formatNoSymptoms,
    formatReset,
    formatError
};
