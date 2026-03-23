/**
 * Astra A0 — Filter Layer Test Suite
 * Tests all modules: language detection, symptom extraction, intent classification,
 * session memory, response formatting, and end-to-end pipeline.
 * 
 * Run: node tests/test_filter_layer.js
 */

const { detectLanguage } = require('../nlp/languageDetector');
const { normalizeText, matchSymptom } = require('../nlp/normalizer');
const { extractSymptoms } = require('../nlp/symptomExtractor');
const { classifyIntent } = require('../middleware/intentClassifier');
const sessionManager = require('../memory/sessionManager');
const { formatResponse, formatGreeting } = require('../utils/responseFormatter');
const { t } = require('../utils/translator');
const { processMessage } = require('../middleware/filterLayer');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${testName}`);
        failed++;
    }
}

// ═════════════════════════════════════════════
// TEST 1: Language Detection
// ═════════════════════════════════════════════
console.log('\n🌍 TEST 1: Language Detection');
console.log('─'.repeat(40));

const langTests = [
    { input: 'मुझे बुखार है', expected: 'hindi', desc: 'Hindi (Devanagari)' },
    { input: 'mujhe bukhar hai', expected: 'hindi', desc: 'Hindi (transliterated)' },
    { input: 'માથું દુખે છે', expected: 'gujarati', desc: 'Gujarati (native)' },
    { input: 'தலைவலி', expected: 'tamil', desc: 'Tamil (native)' },
    { input: 'I have a headache', expected: 'english', desc: 'English' },
    { input: 'fever ho raha hai', expected: 'hinglish', desc: 'Hinglish (mixed)' },
    { input: 'తలనొప్పి గా ఉంది', expected: 'telugu', desc: 'Telugu (native)' },
    { input: 'বুকে ব্যথা হচ্ছে', expected: 'bengali', desc: 'Bengali (native)' },
    { input: 'ਮੈਨੂੰ ਬੁਖਾਰ ਹੈ', expected: 'punjabi', desc: 'Punjabi (Gurmukhi)' },
    { input: 'डोक्यात दुखतंय', expected: 'marathi', desc: 'Marathi (Devanagari)' },
];

for (const test of langTests) {
    const result = detectLanguage(test.input);
    assert(result.language === test.expected, `${test.desc}: "${test.input}" → ${result.language} (expected: ${test.expected})`);
}

// ═════════════════════════════════════════════
// TEST 2: Symptom Matching (Normalizer)
// ═════════════════════════════════════════════
console.log('\n🔍 TEST 2: Symptom Matching');
console.log('─'.repeat(40));

const matchTests = [
    { input: 'bukhar', expected: 'fever', desc: 'Hindi transliterated' },
    { input: 'sar dard', expected: 'headache', desc: 'Hindi phrase' },
    { input: 'tav', expected: 'fever', desc: 'Gujarati' },
    { input: 'thalai vali', expected: 'headache', desc: 'Tamil transliterated' },
    { input: 'fever', expected: 'fever', desc: 'English exact' },
    { input: 'khansi', expected: 'cough', desc: 'Hindi cough' },
    { input: 'ulti', expected: 'vomiting', desc: 'Hindi vomiting' },
    { input: 'pet dard', expected: 'stomach_pain', desc: 'Hindi stomach pain' },
    { input: 'kamar dard', expected: 'back_pain', desc: 'Hindi back pain' },
    { input: 'chakkar', expected: 'dizziness', desc: 'Hindi dizziness' },
    { input: 'bukhaar', expected: 'fever', desc: 'Typo tolerance (bukhaar)' },
    { input: 'kabz', expected: 'constipation', desc: 'Hindi constipation' },
    { input: 'feeling weak', expected: 'fatigue', desc: 'English fatigue' },
];

for (const test of matchTests) {
    const result = matchSymptom(test.input);
    assert(result && result.symptom === test.expected, `${test.desc}: "${test.input}" → ${result?.symptom} (expected: ${test.expected})`);
}

// ═════════════════════════════════════════════
// TEST 3: Symptom Extraction (Full)
// ═════════════════════════════════════════════
console.log('\n🧬 TEST 3: Symptom Extraction');
console.log('─'.repeat(40));

const extractTests = [
    { input: 'mujhe bukhar aur sar dard hai', expectedMin: ['fever', 'headache'], desc: 'Hindi multi-symptom' },
    { input: 'I have fever and cough', expectedMin: ['fever', 'cough'], desc: 'English multi-symptom' },
    { input: 'pet dard aur ulti ho rahi hai', expectedMin: ['stomach pain', 'vomiting'], desc: 'Hindi stomach+vomit' },
    { input: 'feeling weak with headache', expectedMin: ['fatigue', 'headache'], desc: 'English fatigue+headache' },
    { input: 'bukhar', expectedMin: ['fever'], desc: 'Single symptom Hindi' },
];

for (const test of extractTests) {
    const result = extractSymptoms(test.input);
    const allFound = test.expectedMin.every(exp => result.symptoms.includes(exp));
    assert(allFound, `${test.desc}: found [${result.symptoms}] (expected includes: [${test.expectedMin}])`);
}

// ═════════════════════════════════════════════
// TEST 4: Intent Classification
// ═════════════════════════════════════════════
console.log('\n🧠 TEST 4: Intent Classification');
console.log('─'.repeat(40));

const intentTests = [
    { input: 'namaste', expected: 'GREETING', desc: 'Hindi greeting' },
    { input: 'hello', expected: 'GREETING', desc: 'English greeting' },
    { input: 'mujhe bukhar hai', expected: 'CLINICAL', desc: 'Clinical (Hindi fever)' },
    { input: 'I have headache and cough', expected: 'CLINICAL', desc: 'Clinical (English)' },
    { input: 'seene me dard ho raha hai', expected: 'EMERGENCY', desc: 'Emergency (chest pain Hindi)' },
    { input: 'chest pain and cant breathe', expected: 'EMERGENCY', desc: 'Emergency (English)' },
    { input: 'who are you', expected: 'GENERAL', desc: 'General question' },
    { input: 'thank you', expected: 'GENERAL', desc: 'Thanks (general)' },
];

for (const test of intentTests) {
    const result = classifyIntent(test.input);
    assert(result.intent === test.expected, `${test.desc}: "${test.input}" → ${result.intent} (expected: ${test.expected})`);
}

// ═════════════════════════════════════════════
// TEST 5: Session Memory
// ═════════════════════════════════════════════
console.log('\n💾 TEST 5: Session Memory');
console.log('─'.repeat(40));

const testSessionId = 'test_session_' + Date.now();

// Add symptoms incrementally
sessionManager.addSymptoms(testSessionId, ['fever'], 'hindi');
assert(sessionManager.getSymptoms(testSessionId).length === 1, 'First symptom added');

sessionManager.addSymptoms(testSessionId, ['headache'], 'hindi');
assert(sessionManager.getSymptoms(testSessionId).length === 2, 'Second symptom accumulated');

// Test deduplication
sessionManager.addSymptoms(testSessionId, ['fever'], 'hindi');
assert(sessionManager.getSymptoms(testSessionId).length === 2, 'Duplicate fever not added');

// Test language persistence
assert(sessionManager.getLanguage(testSessionId) === 'hindi', 'Language persisted');

// Test history
sessionManager.addToHistory(testSessionId, 'user', 'mujhe bukhar hai');
assert(sessionManager.getHistory(testSessionId).length === 1, 'History recorded');

// Test reset
sessionManager.reset(testSessionId);
assert(sessionManager.getSymptoms(testSessionId).length === 0, 'Session reset works');

// ═════════════════════════════════════════════
// TEST 6: Response Formatting
// ═════════════════════════════════════════════
console.log('\n📝 TEST 6: Response Formatting');
console.log('─'.repeat(40));

const mockApiData = {
    predictions: [
        { disease: 'Common Cold', confidence: 0.85 },
        { disease: 'Influenza', confidence: 0.62 }
    ],
    dosha: ['vata', 'kapha'],
    remedies: {
        herbs: ['giloy', 'tulsi'],
        home_remedies: ['ginger tea', 'honey'],
        yoga: ['pranayama'],
        lifestyle: ['bed rest', 'warm water']
    },
    active_patterns: ['Common Cold']
};

const enResponse = formatResponse(mockApiData, 'english', ['fever', 'cold'], false);
assert(enResponse.text.includes('Common Cold'), 'English response contains disease name');
assert(enResponse.text.includes('85%'), 'English response contains confidence %');
assert(enResponse.text.includes('giloy') || enResponse.text.includes('Giloy'), 'English response contains herbs');

const hiResponse = formatResponse(mockApiData, 'hindi', ['fever', 'cold'], false);
assert(hiResponse.text.includes('निदान'), 'Hindi response has Hindi header');

// Emergency response
const emergResponse = formatResponse(mockApiData, 'english', ['chest pain'], true);
assert(emergResponse.text.includes('EMERGENCY'), 'Emergency warning present');

// ═════════════════════════════════════════════
// TEST 7: Translation
// ═════════════════════════════════════════════
console.log('\n🌐 TEST 7: Translation');
console.log('─'.repeat(40));

assert(t('greeting_response', 'hindi').includes('अस्त्र'), 'Hindi greeting translation');
assert(t('greeting_response', 'tamil').includes('அஸ்ட்ரா'), 'Tamil greeting translation');
assert(t('emergency_warning', 'hindi').includes('आपातकाल'), 'Hindi emergency translation');
assert(t('greeting_response', 'english').includes('Astra'), 'English greeting');

// ═════════════════════════════════════════════
// TEST 8: End-to-End Pipeline (Mock)
// ═════════════════════════════════════════════
console.log('\n🔄 TEST 8: End-to-End Pipeline');
console.log('─'.repeat(40));

async function runE2ETests() {
    // Test greeting
    const greetResult = await processMessage({ message: 'namaste', sessionId: 'e2e_test_1' });
    assert(greetResult.reply.length > 0, 'Greeting produces reply');
    assert(greetResult.language !== undefined, 'Language detected in greeting');

    // Test clinical input (API will fail since server isn't running — we test the pipeline)
    const clinicalResult = await processMessage({
        message: 'mujhe bukhar aur sar dard hai',
        sessionId: 'e2e_test_2'
    });
    assert(clinicalResult.reply.length > 0, 'Clinical input produces reply');
    assert(clinicalResult.processing_time_ms !== undefined, 'Processing time tracked');

    // Test session accumulation
    await processMessage({ message: 'khansi bhi hai', sessionId: 'e2e_test_2' });
    const symptoms = sessionManager.getSymptoms('e2e_test_2');
    assert(symptoms.length >= 1, 'Session accumulates symptoms across turns');

    // Test reset
    const resetResult = await processMessage({ message: 'reset', sessionId: 'e2e_test_2' });
    assert(resetResult.reply.length > 0, 'Reset produces response');

    // Test emergency
    const emergResult = await processMessage({
        message: 'seene me dard ho raha hai saans nahi aa rahi',
        sessionId: 'e2e_test_3'
    });
    assert(emergResult.reply.length > 0, 'Emergency input produces reply');

    // Clean up
    sessionManager.reset('e2e_test_1');
    sessionManager.reset('e2e_test_2');
    sessionManager.reset('e2e_test_3');
}

// ═════════════════════════════════════════════
// TEST 9: Edge Cases
// ═════════════════════════════════════════════
console.log('\n⚡ TEST 9: Edge Cases');
console.log('─'.repeat(40));

// Empty input
const emptyLang = detectLanguage('');
assert(emptyLang.language === 'english', 'Empty input defaults to English');

const emptyExtract = extractSymptoms('');
assert(emptyExtract.symptoms.length === 0, 'Empty input extracts no symptoms');

const emptyIntent = classifyIntent('');
assert(emptyIntent.intent === 'GENERAL', 'Empty input classified as GENERAL');

// Gibberish
const gibberish = extractSymptoms('asdjfklasdjf');
assert(gibberish.symptoms.length === 0, 'Gibberish extracts no symptoms');

// Special characters
const special = extractSymptoms('!@#$%^&*()');
assert(special.symptoms.length === 0, 'Special chars extract no symptoms');

// Very long input
const longInput = 'bukhar '.repeat(50);
const longResult = extractSymptoms(longInput);
assert(longResult.symptoms.includes('fever'), 'Long input still works');

// ═════════════════════════════════════════════
// Run async tests and report
// ═════════════════════════════════════════════
runE2ETests().then(() => {
    console.log('\n' + '═'.repeat(40));
    console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('═'.repeat(40));

    if (failed > 0) {
        console.log('\n⚠️  Some tests failed. Review the output above.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    }
}).catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
