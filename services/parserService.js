/**
 * Astra R0.0 — Parser Service (Node.js)
 * 
 * extractPatientInfo(text)  → { name, age, gender, report_id, date }
 * extractLabValues(text)    → { canonical_key: { value, unit, raw } }
 * classifyValues(labValues, patient) → { canonical_key: { value, unit, status, ... } }
 */

const fs = require('fs');
const path = require('path');

// ── Load reference ranges ─────────────────────────────────────────────────────
const RANGES = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/normal_ranges.json'), 'utf8')
);

// Build alias → canonical key map (lower-cased)
const ALIAS_MAP = new Map();
for (const [key, info] of Object.entries(RANGES)) {
    if (key.startsWith('_')) continue;
    ALIAS_MAP.set(key.toLowerCase(), key);
    ALIAS_MAP.set(key.toLowerCase().replace(/_/g, ' '), key);
    for (const alias of (info.aliases || [])) {
        ALIAS_MAP.set(alias.toLowerCase(), key);
    }
}

// ── PATIENT INFO EXTRACTION ───────────────────────────────────────────────────

const PATIENT_PATTERNS = {
    name: [
        /(?:patient\s*(?:name|'s name)|name\s*of\s*patient|name)[:\s]+([A-Za-z][A-Za-z\s\.]{1,50})/i,
        /^(?:Mr|Mrs|Ms|Dr)\.?\s+([A-Za-z][A-Za-z\s\.]{1,50})/m,
    ],
    age: [
        /(?:age|patient\s*age)[:\s]+(\d{1,3})\s*(?:years?|yrs?|Y)?/i,
        /\b(\d{1,3})\s*(?:years?|yrs?)\s*(?:old|\/)/i,
    ],
    gender: [
        /(?:sex|gender)[:\s]+(male|female|m\b|f\b)/i,
        /\b(male|female)\b/i,
    ],
    report_id: [
        /(?:report\s*(?:id|no|number|#)|lab\s*(?:id|no)|sample\s*(?:id|no)|ref(?:erence)?\s*(?:no|#)?)[:\s#]*([A-Z0-9][A-Z0-9\-\/]{1,30})/i,
    ],
    date: [
        /(?:(?:report|collection|test(?:ed)?|sample|dated?)\s*(?:date|on))[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/,
    ],
};

function extractPatientInfo(text) {
    const info = { name: null, age: null, gender: null, report_id: null, date: null };

    for (const [field, patterns] of Object.entries(PATIENT_PATTERNS)) {
        for (const pat of patterns) {
            const match = text.match(pat);
            if (match) {
                let val = match[1].trim();
                if (field === 'age') val = parseInt(val, 10);
                if (field === 'gender') val = val.toLowerCase().startsWith('m') ? 'male' : 'female';
                // Sanity checks
                if (field === 'name' && val.length < 2) continue;
                info[field] = val;
                break;
            }
        }
    }

    return info;
}

// ── LAB VALUE EXTRACTION ──────────────────────────────────────────────────────
// Pattern: <test_name>  [:]  <number>  [unit]
// Also handles: <test_name> | <number> | <unit> | <ref range>  (table format)
const NUMERIC_LINE_RE = /^(?<test>[A-Za-z][A-Za-z0-9\s\(\)\.\-\/,]{1,50}?)\s*[:\|\t]\s*(?<value>[\d]+(?:\.\d+)?)\s*(?<unit>[A-Za-z\/µg%\^0-9\.\*\s]{0,20}?)\s*(?:[\d\.\-–]+\s*[\-–]\s*[\d\.]+)?$/;
const CATEGORICAL_LINE_RE = /^(?<test>[A-Za-z][A-Za-z0-9\s\(\)\.\-\/,]{1,50}?)\s*[:\|]\s*(?<val>negative|positive|trace|absent|present|nil)\b/i;

function extractLabValues(text) {
    const results = {};
    const lines = text.split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.length < 4) continue;

        // Try categorical first
        const catMatch = line.match(CATEGORICAL_LINE_RE);
        if (catMatch) {
            const canonical = resolveAlias(catMatch.groups.test);
            if (canonical) {
                results[canonical] = {
                    value: catMatch.groups.val.toLowerCase(),
                    unit: '',
                    raw: line,
                    originalName: catMatch.groups.test.trim(),
                    categorical: true,
                };
            }
            continue;
        }

        // Try numeric
        const numMatch = line.match(NUMERIC_LINE_RE);
        if (numMatch) {
            const canonical = resolveAlias(numMatch.groups.test);
            if (canonical) {
                const val = parseFloat(numMatch.groups.value);
                if (isNaN(val)) continue;
                // Don't overwrite with a worse match
                if (results[canonical] && !results[canonical].categorical) continue;
                results[canonical] = {
                    value: val,
                    unit: numMatch.groups.unit.trim(),
                    raw: line,
                    originalName: numMatch.groups.test.trim(),
                    categorical: false,
                };
            }
        }
    }

    return results;
}

// ── ALIAS RESOLUTION ──────────────────────────────────────────────────────────
function resolveAlias(rawName) {
    const cleaned = rawName.toLowerCase().trim().replace(/\s+/g, ' ');
    if (ALIAS_MAP.has(cleaned)) return ALIAS_MAP.get(cleaned);

    // Partial match (substring)
    for (const [alias, key] of ALIAS_MAP.entries()) {
        if (alias.length >= 4 && cleaned.includes(alias)) return key;
        if (cleaned.length >= 4 && alias.includes(cleaned)) return key;
    }
    return null;
}

// ── VALUE CLASSIFICATION ──────────────────────────────────────────────────────
function classifyValues(labValues, patientInfo = {}) {
    const gender = (patientInfo.gender || '').toLowerCase();
    const age = patientInfo.age;
    const isChild = typeof age === 'number' && age < 14;
    const classified = {};

    for (const [key, data] of Object.entries(labValues)) {
        const ref = RANGES[key];
        if (!ref) continue;

        const unit = data.unit || ref.unit || '';
        const originalName = data.originalName;

        // ── Categorical ──
        if (ref.categorical || data.categorical) {
            const allowed = ref.allowed || ['negative'];
            const val = String(data.value).toLowerCase();
            const status = allowed.includes(val) ? 'normal' : 'high';
            classified[key] = {
                value: data.value, unit,
                status,
                referenceRange: `Expected: ${allowed[0]}`,
                deviationPct: null,
                isCritical: status !== 'normal',
                originalName,
            };
            continue;
        }

        // ── Numeric ──
        const range = pickRange(ref, gender, isChild);
        if (!range || range.min == null) continue;

        const val = data.value;
        const { min, max } = range;
        const critLow = ref.critical_low ?? null;
        const critHigh = ref.critical_high ?? null;

        let status, isCritical;
        if (critLow !== null && val < critLow)      { status = 'critical_low';  isCritical = true; }
        else if (critHigh !== null && val > critHigh){ status = 'critical_high'; isCritical = true; }
        else if (val < min)                          { status = 'low';           isCritical = false; }
        else if (val > max)                          { status = 'high';          isCritical = false; }
        else                                         { status = 'normal';        isCritical = false; }

        let deviationPct = null;
        if (status.includes('low') && min > 0)       deviationPct = +((( min - val) / min * 100)).toFixed(1);
        else if (status.includes('high') && max > 0) deviationPct = +(((val - max) / max * 100)).toFixed(1);
        else                                          deviationPct = 0;

        classified[key] = {
            value: val, unit,
            status,
            referenceRange: `${min} – ${max} ${unit}`.trim(),
            deviationPct,
            isCritical,
            originalName,
        };
    }

    return classified;
}

function pickRange(ref, gender, isChild) {
    if (isChild && ref.child)          return ref.child;
    if (gender === 'female' && ref.female) return ref.female;
    if (gender === 'male'   && ref.male)   return ref.male;
    return ref.default || null;
}

module.exports = { extractPatientInfo, extractLabValues, classifyValues, resolveAlias };
