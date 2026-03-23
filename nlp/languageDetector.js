/**
 * Astra A0 — Language Detection Module
 * Detects user language via Unicode script ranges, keyword fallback, and Hinglish patterns.
 */

const SCRIPT_RANGES = [
    { name: 'devanagari', range: [0x0900, 0x097F], languages: ['hindi', 'marathi'] },
    { name: 'gujarati',   range: [0x0A80, 0x0AFF], languages: ['gujarati'] },
    { name: 'gurmukhi',   range: [0x0A00, 0x0A7F], languages: ['punjabi'] },
    { name: 'tamil',      range: [0x0B80, 0x0BFF], languages: ['tamil'] },
    { name: 'telugu',     range: [0x0C00, 0x0C7F], languages: ['telugu'] },
    { name: 'bengali',    range: [0x0980, 0x09FF], languages: ['bengali'] },
    { name: 'kannada',    range: [0x0C80, 0x0CFF], languages: ['kannada'] },
    { name: 'malayalam',  range: [0x0D00, 0x0D7F], languages: ['malayalam'] },
];

const LANGUAGE_KEYWORDS = {
    hindi: ['mujhe','mera','mere','hai','hain','raha','rahi','aur','bahut','dard','bukhar','lagta','kya','kaise','kuch','zyada','thoda','nahi','haan','abhi','pet','sar','sir','kamar','gala','kaan','ankh','batao','bolo'],
    gujarati: ['mane','maara','che','hatu','thyu','dukhay','tav','lagvu','shakay','hoy','thay','ughres'],
    marathi: ['mala','mazha','ahe','hoyte','dukhte','khup','dokyat','kaay','aahe','sangaa'],
    tamil: ['enakku','ennoda','irukku','romba','vali','kaichhal','thalai','valikuthu','nalla'],
    telugu: ['naaku','naadi','undi','chaala','noppi','jvaram','untundi','baadhaga'],
    bengali: ['amar','aamar','achhe','khub','byatha','jor','hoyeche','lagche','matha'],
    punjabi: ['mainu','meri','bahut','dard','vich','lagda','hunda','pata']
};

const HINGLISH_PATTERNS = [
    /\b(ho\s+raha|ho\s+rahi|lag\s+raha|lag\s+rahi|aa\s+raha|aa\s+rahi)\b/i,
    /\b(nahi|bahut|thoda|zyada)\s+\w+/i,
    /\b\w+\s+(hai|hain|tha|thi|the)\b/i,
    /\b(feeling|pain|problem)\s+(hai|ho|aa)/i,
];

function detectLanguage(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { language: 'english', script: null, confidence: 0.5 };
    }
    text = text.trim();

    // Phase 1: Unicode script detection
    const scriptCounts = {};
    let totalNonAscii = 0;
    let latinChars = 0;
    for (const char of text) {
        const code = char.codePointAt(0);
        if (code <= 0x007F) { if (/[a-zA-Z]/.test(char)) latinChars++; continue; }
        totalNonAscii++;
        for (const script of SCRIPT_RANGES) {
            if (code >= script.range[0] && code <= script.range[1]) {
                scriptCounts[script.name] = (scriptCounts[script.name] || 0) + 1;
                break;
            }
        }
    }
    if (totalNonAscii > 0) {
        const dominant = Object.entries(scriptCounts).sort((a, b) => b[1] - a[1])[0];
        if (dominant) {
            const scriptDef = SCRIPT_RANGES.find(s => s.name === dominant[0]);
            if (scriptDef) {
                const confidence = Math.min(0.95, 0.7 + (dominant[1] / totalNonAscii) * 0.25);
                if (scriptDef.name === 'devanagari') {
                    const lang = disambiguateDevanagari(text);
                    return { language: lang, script: 'devanagari', confidence };
                }
                return { language: scriptDef.languages[0], script: scriptDef.name, confidence };
            }
        }
    }

    // Phase 2: Transliterated / Latin-script
    const words = text.toLowerCase().split(/\s+/);
    let hinglishScore = 0;
    for (const p of HINGLISH_PATTERNS) { if (p.test(text.toLowerCase())) hinglishScore += 2; }
    let englishWords = 0, hindiWords = 0;
    for (const w of words) {
        if (LANGUAGE_KEYWORDS.hindi.includes(w)) hindiWords++;
        if (/^[a-z]+$/.test(w) && !LANGUAGE_KEYWORDS.hindi.includes(w)) englishWords++;
    }
    if (hinglishScore >= 2 && hindiWords > 0 && englishWords > 0) {
        return { language: 'hinglish', script: null, confidence: 0.75 };
    }
    const langScores = {};
    for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
        let score = 0;
        for (const w of words) { if (keywords.includes(w)) score++; }
        if (score > 0) langScores[lang] = score;
    }
    if (Object.keys(langScores).length > 0) {
        const best = Object.entries(langScores).sort((a, b) => b[1] - a[1])[0];
        const confidence = Math.min(0.85, 0.5 + (best[1] / words.length) * 0.35);
        if (best[0] === 'hindi' && englishWords > 0 && hindiWords > 0) {
            return { language: 'hinglish', script: null, confidence };
        }
        return { language: best[0], script: null, confidence };
    }

    // Phase 3: Default English
    return { language: 'english', script: null, confidence: 0.6 };
}

function disambiguateDevanagari(text) {
    const marathiInd = ['आहे','नाही','माझा','माझ्या','दुखतंय','वाजणे'];
    const hindiInd = ['है','हैं','मेरा','मेरी','नहीं','हो रहा','लग रहा'];
    let m = 0, h = 0;
    for (const w of marathiInd) { if (text.includes(w)) m++; }
    for (const w of hindiInd) { if (text.includes(w)) h++; }
    return m > h ? 'marathi' : 'hindi';
}

module.exports = { detectLanguage };
