/**
 * Astra A0 — Text Normalizer with Fuzzy Matching
 * Handles typos, phonetic similarity, and local slang normalization.
 */

const fs = require('fs');
const path = require('path');

const symptomData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'dictionaries', 'symptomMap.json'), 'utf8')
);

// Build reverse lookup: every variant → standard symptom key
const reverseLookup = new Map();
const allStandardSymptoms = [];

for (const [symptomKey, langMap] of Object.entries(symptomData.symptoms)) {
    allStandardSymptoms.push(symptomKey);
    for (const [lang, variants] of Object.entries(langMap)) {
        if (lang === '_meta') continue;
        for (const variant of variants) {
            const normalized = variant.toLowerCase().trim();
            reverseLookup.set(normalized, symptomKey);
        }
    }
}

// Phonetic normalization rules for Indian transliterations
const PHONETIC_RULES = [
    [/ph/g, 'f'], [/th/g, 't'], [/dh/g, 'd'], [/bh/g, 'b'],
    [/kh/g, 'k'], [/gh/g, 'g'], [/chh/g, 'ch'], [/sh/g, 's'],
    [/aa/g, 'a'], [/ee/g, 'i'], [/oo/g, 'u'], [/ou/g, 'o'],
    [/ai/g, 'e'], [/au/g, 'o'], [/ey/g, 'e'], [/ay/g, 'e'],
];

function phoneticNormalize(text) {
    let result = text.toLowerCase().trim();
    for (const [pattern, replacement] of PHONETIC_RULES) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

// Levenshtein distance
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Clean and normalize raw text input.
 */
function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[^\w\s\u0900-\u0D7F]/g, ' ')  // keep alphabets + Indian scripts
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Try to match a token/phrase to a known symptom.
 * Returns { symptom, confidence } or null.
 */
function matchSymptom(phrase) {
    const clean = phrase.toLowerCase().trim();
    if (!clean || clean.length < 2) return null;

    // 1. Exact lookup
    if (reverseLookup.has(clean)) {
        return { symptom: reverseLookup.get(clean), confidence: 1.0 };
    }

    // 2. Phonetic normalized lookup
    const phonetic = phoneticNormalize(clean);
    for (const [variant, symptomKey] of reverseLookup.entries()) {
        if (phoneticNormalize(variant) === phonetic) {
            return { symptom: symptomKey, confidence: 0.9 };
        }
    }

    // 3. Fuzzy match (Levenshtein) — only for short phrases
    if (clean.length <= 25) {
        let bestMatch = null;
        let bestDist = Infinity;
        const threshold = clean.length <= 5 ? 1 : clean.length <= 10 ? 2 : 3;

        for (const [variant, symptomKey] of reverseLookup.entries()) {
            // Skip very long variants for performance
            if (Math.abs(variant.length - clean.length) > threshold) continue;
            const dist = levenshtein(clean, variant);
            if (dist <= threshold && dist < bestDist) {
                bestDist = dist;
                bestMatch = symptomKey;
            }
        }
        if (bestMatch) {
            const confidence = Math.max(0.6, 1.0 - (bestDist / clean.length));
            return { symptom: bestMatch, confidence };
        }
    }

    // 4. Substring / partial match
    for (const [variant, symptomKey] of reverseLookup.entries()) {
        if (variant.length >= 4 && clean.includes(variant)) {
            return { symptom: symptomKey, confidence: 0.7 };
        }
        if (clean.length >= 4 && variant.includes(clean)) {
            return { symptom: symptomKey, confidence: 0.65 };
        }
    }

    return null;
}

/**
 * Get stopwords for a given language.
 */
function getStopwords(language) {
    return new Set(symptomData.stopwords[language] || symptomData.stopwords.english || []);
}

module.exports = {
    normalizeText,
    matchSymptom,
    phoneticNormalize,
    levenshtein,
    getStopwords,
    reverseLookup,
    allStandardSymptoms
};
