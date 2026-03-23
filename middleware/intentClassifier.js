/**
 * Astra A0 — Intent Classifier
 * Classifies user input into: GREETING, GENERAL, CLINICAL, EMERGENCY
 */

const { detectLanguage } = require('../nlp/languageDetector');

// Multi-language greeting keywords
const GREETING_KEYWORDS = [
    'hi', 'hello', 'hey', 'namaste', 'namaskar', 'namasthe', 'vanakkam',
    'sat sri akal', 'kem cho', 'kemon acho', 'nomoshkar', 'pranam',
    'good morning', 'good evening', 'good afternoon', 'good night',
    'suprabhat', 'shubh sandhya', 'howdy', 'hola',
    'नमस्ते', 'नमस्कार', 'वणक्कम', 'kem cho', 'কেমন আছো'
];

// General / non-medical queries
const GENERAL_KEYWORDS = [
    'who are you', 'what are you', 'what is astra', 'what can you do',
    'help', 'how to use', 'how does this work', 'about', 'info',
    'thank you', 'thanks', 'dhanyavaad', 'shukriya', 'nandri',
    'bye', 'goodbye', 'alvida', 'ok', 'okay', 'theek hai', 'accha',
    'version', 'credits', 'contact', 'kya kar sakte ho', 'tum kaun ho',
    'tumhara naam kya hai', 'app kya hai', 'ye kya hai',
    'reset', 'start over', 'new session', 'clear', 'naya shuru karo'
];

// Emergency indicators (MUST be checked first)
const EMERGENCY_KEYWORDS = {
    english: ['chest pain', 'heart attack', 'cant breathe', 'cannot breathe', 'unconscious',
              'seizure', 'stroke', 'severe bleeding', 'choking', 'collapsed',
              'not breathing', 'stopped breathing', 'no pulse', 'suicide',
              'paralysis', 'sudden numbness', 'unresponsive'],
    hindi: ['seene me dard', 'saans nahi aa rahi', 'behosh', 'behoshi',
            'heart attack', 'dam ghut raha', 'khoon beh raha', 'besudh',
            'सीने में दर्द', 'सांस नहीं आ रही', 'बेहोश', 'दम घुट रहा'],
    gujarati: ['chhati ma dukhavo', 'shvas nathi aavto', 'behosh',
               'છાતીમાં દુખાવો', 'શ્વાસ નથી આવતો'],
    tamil: ['nenjhu vali', 'moochhu varavillai', 'mayakkam',
            'நெஞ்சு வலி', 'மூச்சு வரவில்லை', 'மயக்கம்'],
    telugu: ['gundelo noppi', 'swasa andaledu', 'spruha tappindi',
             'గుండెలో నొప్పి', 'శ్వాస అందలేదు'],
    bengali: ['buke byatha', 'shwash nite parchi na', 'gyan haranor',
              'বুকে ব্যথা', 'শ্বাস নিতে পারছি না'],
    marathi: ['chhatit dukhte', 'shvas ghenyla trass', 'beshudh',
              'छातीत दुखतंय', 'श्वास घेण्यास त्रास'],
    punjabi: ['chaati dard', 'saah nahi aa rahi', 'behosh',
              'ਛਾਤੀ ਦਰਦ', 'ਸਾਹ ਨਹੀਂ ਆ ਰਹੀ']
};

// Clinical indicator keywords (indicates health/symptom intent)
const CLINICAL_INDICATORS = [
    'pain', 'dard', 'ache', 'hurt', 'sick', 'ill', 'unwell',
    'fever', 'bukhar', 'cough', 'khansi', 'cold', 'zukaam',
    'vomit', 'ulti', 'diarrhea', 'dast', 'rash', 'itch',
    'weakness', 'kamzori', 'tired', 'thakan', 'dizzy', 'chakkar',
    'swelling', 'bleeding', 'infection', 'nausea', 'burning',
    'symptom', 'disease', 'doctor', 'medicine', 'treatment', 'remedy',
    'bimari', 'ilaj', 'dawai', 'upchar', 'upay', 'lakshan',
    'problem', 'taklif', 'takleef', 'pareshani', 'bimaari',
    'dukhay', 'dukhte', 'vali', 'noppi', 'byatha', 'novu', 'vedi',
    'diagnosis', 'check', 'test', 'scan', 'examine',
    'kaichal', 'irumal', 'jvaram', 'jor',
    // Hindi phrases
    'tabiyat kharab', 'body dard', 'health issue',
    'kya bimari', 'kya problem', 'kya ho raha'
];

/**
 * Classify user intent.
 * @param {string} text - User input
 * @returns {{ intent: string, confidence: number, emergencyDetected: boolean, isReset: boolean }}
 */
function classifyIntent(text) {
    if (!text || typeof text !== 'string') {
        return { intent: 'GENERAL', confidence: 0.5, emergencyDetected: false, isReset: false };
    }

    const lower = text.toLowerCase().trim();

    // Check for session reset
    const resetKeywords = ['reset', 'start over', 'new session', 'clear', 'naya shuru', 'phir se'];
    const isReset = resetKeywords.some(k => lower.includes(k));

    // 1. EMERGENCY check (highest priority)
    for (const keywords of Object.values(EMERGENCY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lower.includes(keyword.toLowerCase())) {
                return { intent: 'EMERGENCY', confidence: 0.95, emergencyDetected: true, isReset };
            }
        }
    }

    // 2. GREETING check (exact or near-exact)
    for (const greeting of GREETING_KEYWORDS) {
        if (lower === greeting || lower.startsWith(greeting + ' ') || lower.endsWith(' ' + greeting)) {
            // If greeting also contains clinical words, prefer CLINICAL
            const hasClinical = CLINICAL_INDICATORS.some(c => lower.includes(c));
            if (hasClinical) break;
            return { intent: 'GREETING', confidence: 0.9, emergencyDetected: false, isReset };
        }
    }

    // 3. GENERAL check
    for (const general of GENERAL_KEYWORDS) {
        if (lower.includes(general)) {
            const hasClinical = CLINICAL_INDICATORS.some(c => lower.includes(c));
            if (!hasClinical) {
                return { intent: 'GENERAL', confidence: 0.8, emergencyDetected: false, isReset };
            }
        }
    }

    // 4. CLINICAL check (symptom/health keywords)
    let clinicalScore = 0;
    for (const indicator of CLINICAL_INDICATORS) {
        if (lower.includes(indicator)) clinicalScore++;
    }

    if (clinicalScore > 0) {
        const confidence = Math.min(0.95, 0.6 + clinicalScore * 0.1);
        return { intent: 'CLINICAL', confidence, emergencyDetected: false, isReset };
    }

    // 5. If text is short and doesn't match anything, assume CLINICAL (user might just type symptoms)
    const words = lower.split(/\s+/);
    if (words.length <= 4) {
        return { intent: 'CLINICAL', confidence: 0.5, emergencyDetected: false, isReset };
    }

    return { intent: 'GENERAL', confidence: 0.4, emergencyDetected: false, isReset };
}

module.exports = { classifyIntent };
