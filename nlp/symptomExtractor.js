/**
 * Astra A0 — Symptom Extractor
 * Extracts symptoms from multilingual input using n-gram sliding window + fuzzy matching.
 */

const { normalizeText, matchSymptom, getStopwords } = require('./normalizer');
const { detectLanguage } = require('./languageDetector');

/**
 * Extract symptoms from user input in any supported language.
 * @param {string} rawInput - User's raw message
 * @param {string} [langHint] - Optional language hint from session
 * @returns {{ symptoms: string[], language: string, confidence: number, rawInput: string }}
 */
function extractSymptoms(rawInput, langHint) {
    if (!rawInput || typeof rawInput !== 'string') {
        return { symptoms: [], language: 'english', confidence: 0, rawInput: '' };
    }

    // Detect language
    const langResult = detectLanguage(rawInput);
    const language = langHint || langResult.language;

    // Normalize text
    const normalized = normalizeText(rawInput);
    if (!normalized) {
        return { symptoms: [], language, confidence: 0, rawInput };
    }

    const stopwords = getStopwords(language);

    // Split into content words (remove stopwords)
    const allWords = normalized.split(/\s+/).filter(w => w.length > 1);
    const filteredWords = allWords.filter(w => !stopwords.has(w));

    // Collect all candidate matches with their span [start, end) and confidence
    const candidates = [];
    const maxN = Math.min(4, filteredWords.length);

    for (let n = maxN; n >= 1; n--) {
        for (let i = 0; i <= filteredWords.length - n; i++) {
            const phrase = filteredWords.slice(i, i + n).join(' ');
            const match = matchSymptom(phrase);
            if (match && match.confidence >= 0.62) {
                candidates.push({ symptom: match.symptom, confidence: match.confidence, start: i, end: i + n, n });
            }
        }
    }

    // Greedy selection: pick highest-confidence, longest, non-overlapping spans
    candidates.sort((a, b) => b.confidence - a.confidence || b.n - a.n);
    const consumed = new Set();
    const foundSymptoms = new Map();

    for (const cand of candidates) {
        // Check no overlap
        let overlap = false;
        for (let k = cand.start; k < cand.end; k++) {
            if (consumed.has(k)) { overlap = true; break; }
        }
        if (overlap) continue;

        // Accept this candidate
        if (!foundSymptoms.has(cand.symptom) || cand.confidence > foundSymptoms.get(cand.symptom)) {
            foundSymptoms.set(cand.symptom, cand.confidence);
        }
        for (let k = cand.start; k < cand.end; k++) consumed.add(k);
    }

    // Convert symptom keys to English standard names
    const symptoms = Array.from(foundSymptoms.keys()).map(key => key.replace(/_/g, ' '));

    return {
        symptoms,
        language,
        confidence: langResult.confidence,
        rawInput
    };
}

module.exports = { extractSymptoms };
