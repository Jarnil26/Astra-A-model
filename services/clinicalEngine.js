/**
 * Astra R0.0 — Clinical Engine (Node.js)
 * 
 * Maps abnormal lab values → symptom strings, then
 * calls the existing Astra A0.0 /predict endpoint internally.
 * 
 * NO duplicate prediction logic — reuses the existing engine.
 */

const http = require('http');
const https = require('https');

const PREDICT_TIMEOUT_MS = 15000;

// ── Abnormality → Symptom Map ─────────────────────────────────────────────────
// Keys match normal_ranges.json canonical keys.
// Values are the English symptom terms understood by the A0.0 predict engine.

const SYMPTOM_MAP = {
    hemoglobin: {
        low:          ['fatigue', 'weakness', 'dizziness', 'loss of appetite'],
        critical_low: ['fatigue', 'weakness', 'dizziness', 'breathlessness', 'chest pain'],
        high:         ['headache', 'dizziness'],
    },
    wbc: {
        high:          ['fever', 'body aches', 'fatigue'],
        critical_high: ['fever', 'fatigue', 'body aches', 'sore throat'],
        low:           ['fatigue', 'weakness'],
        critical_low:  ['fatigue', 'weakness', 'fever'],
    },
    platelets: {
        low:          ['fatigue', 'weakness', 'dizziness'],
        critical_low: ['fatigue', 'weakness', 'dizziness', 'nausea'],
        high:         ['headache', 'dizziness'],
    },
    fasting_glucose: {
        high:          ['increased thirst', 'frequent urination', 'fatigue', 'blurred vision'],
        critical_high: ['increased thirst', 'frequent urination', 'fatigue', 'vomiting'],
        low:           ['dizziness', 'sweating', 'weakness', 'nausea'],
        critical_low:  ['dizziness', 'sweating', 'weakness', 'nausea', 'fatigue'],
    },
    random_glucose: {
        high:         ['increased thirst', 'frequent urination', 'fatigue'],
        critical_high:['increased thirst', 'frequent urination', 'fatigue', 'blurred vision'],
    },
    hba1c: {
        high:         ['fatigue', 'increased thirst', 'frequent urination', 'blurred vision'],
    },
    sgpt: {
        high:         ['fatigue', 'nausea', 'loss of appetite', 'stomach pain'],
        critical_high:['fatigue', 'nausea', 'vomiting', 'stomach pain', 'jaundice'],
    },
    sgot: {
        high:         ['fatigue', 'nausea', 'stomach pain'],
    },
    bilirubin_total: {
        high:         ['jaundice', 'fatigue', 'nausea', 'loss of appetite'],
        critical_high:['jaundice', 'fatigue', 'nausea', 'vomiting', 'abdominal pain'],
    },
    creatinine: {
        high:         ['fatigue', 'nausea', 'swelling', 'decreased urination'],
        critical_high:['fatigue', 'nausea', 'vomiting', 'swelling', 'shortness of breath'],
    },
    urea: {
        high:         ['fatigue', 'nausea', 'loss of appetite'],
        critical_high:['fatigue', 'nausea', 'vomiting', 'swelling'],
    },
    uric_acid: {
        high:         ['joint pain', 'swelling', 'redness'],
    },
    total_cholesterol: {
        high:         ['fatigue', 'chest tightness'],
    },
    ldl: {
        high:         ['chest tightness', 'fatigue'],
    },
    triglycerides: {
        high:         ['fatigue', 'abdominal pain'],
        critical_high:['fatigue', 'abdominal pain', 'nausea'],
    },
    tsh: {
        high:         ['fatigue', 'weight gain', 'cold intolerance', 'constipation'],
        low:          ['weight loss', 'palpitations', 'anxiety', 'sweating', 'tremors'],
    },
    vitamin_d: {
        low:          ['fatigue', 'bone pain', 'muscle weakness'],
        critical_low: ['fatigue', 'bone pain', 'muscle weakness', 'depression'],
    },
    vitamin_b12: {
        low:          ['fatigue', 'weakness', 'numbness', 'memory problems'],
        critical_low: ['fatigue', 'weakness', 'numbness', 'dizziness', 'memory problems'],
    },
    crp: {
        high:         ['fever', 'fatigue', 'body aches'],
        critical_high:['fever', 'fatigue', 'body aches', 'joint pain'],
    },
    esr: {
        high:         ['fatigue', 'fever', 'joint pain'],
    },
    ferritin: {
        low:          ['fatigue', 'weakness', 'dizziness'],
    },
    iron: {
        low:          ['fatigue', 'weakness', 'cold hands', 'brittle nails'],
    },
    urine_wbc: {
        high:         ['burning urination', 'frequent urination', 'lower back pain'],
    },
    urine_rbc: {
        high:         ['blood in urine', 'flank pain'],
    },
    urine_protein: {
        high:         ['swelling', 'fatigue', 'foamy urine'],
    },
    potassium: {
        low:          ['weakness', 'muscle cramps', 'fatigue'],
        critical_low: ['weakness', 'muscle cramps', 'palpitations', 'fatigue'],
        high:         ['nausea', 'weakness', 'palpitations'],
        critical_high:['palpitations', 'weakness', 'nausea', 'chest pain'],
    },
    sodium: {
        low:          ['headache', 'nausea', 'fatigue', 'confusion'],
        critical_low: ['headache', 'nausea', 'confusion', 'seizures'],
        high:         ['thirst', 'fatigue', 'confusion'],
    },
};

// ── HARD-CODED quick recommendations (supplement to A0.0 engine) ──────────────
const QUICK_RECS = {
    hemoglobin:      { diet: ['Iron-rich foods (spinach, lentils, red meat)', 'Vitamin C foods to boost absorption'], lifestyle: ['Moderate exercise', 'Avoid tea/coffee after meals'] },
    fasting_glucose: { diet: ['Low GI foods', 'More vegetables and whole grains', 'Limit refined sugar'], lifestyle: ['30 min daily walk', 'Monitor blood sugar regularly'] },
    hba1c:           { diet: ['Strict diabetic diet', 'Reduce carbohydrates'], lifestyle: ['Daily exercise', 'Stress management'] },
    sgpt:            { diet: ['Avoid alcohol completely', 'Low fat diet', 'Adequate hydration'], lifestyle: ['Avoid hepatotoxic medications without advice'] },
    creatinine:      { diet: ['Low protein diet', 'Low salt', 'Avoid NSAIDs'], lifestyle: ['Stay hydrated', 'Monitor blood pressure'] },
    total_cholesterol:{diet: ['Avoid saturated fats', 'Omega-3 fish, nuts, whole grains'], lifestyle: ['Aerobic exercise 5x/week', 'Quit smoking'] },
    tsh:             { diet: ['Iodine-rich foods (if high TSH)', 'Adequate selenium (Brazil nuts)'], lifestyle: ['Regular thyroid monitoring'] },
    vitamin_d:       { diet: ['Fatty fish, fortified dairy, egg yolks'], lifestyle: ['20-30 min morning sunlight daily'] },
    vitamin_b12:     { diet: ['Meat, fish, dairy, eggs', 'Fortified cereals for vegetarians'], lifestyle: ['B12 injections if severely deficient'] },
    platelets:       { diet: ['Papaya leaf, pomegranate juice (may help)'], lifestyle: ['Avoid aspirin/NSAIDs', 'Monitor for bruising'] },
    urine_wbc:       { diet: ['Drink 2-3L water daily', 'Cranberry juice (unsweetened)'], lifestyle: ['Maintain hygiene', 'Urinate frequently'] },
};

// ── PUBLIC: map classified values → unique symptom array ─────────────────────
function mapToSymptoms(classified) {
    const symptomSet = new Set();

    for (const [key, data] of Object.entries(classified)) {
        const statusMap = SYMPTOM_MAP[key];
        if (!statusMap) continue;
        const symptoms = statusMap[data.status] || [];
        symptoms.forEach(s => symptomSet.add(s));
    }

    return [...symptomSet].slice(0, 10); // cap at 10 to avoid noisy prediction
}

// ── PUBLIC: call the A0.0 /predict endpoint ───────────────────────────────────
async function callPredict(symptoms, baseUrl) {
    if (!symptoms || symptoms.length === 0) {
        return { success: false, data: null, error: 'No symptoms generated from abnormalities' };
    }

    const url = new URL('/predict', baseUrl);
    const lib = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ symptoms });

    return new Promise((resolve) => {
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
            timeout: PREDICT_TIMEOUT_MS,
        };

        const req = lib.request(options, (res) => {
            let chunks = '';
            res.on('data', c => { chunks += c; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(chunks);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, data: json });
                    } else {
                        resolve({ success: false, data: null, error: json.message || `HTTP ${res.statusCode}` });
                    }
                } catch {
                    resolve({ success: false, data: null, error: 'Invalid JSON from predict API' });
                }
            });
        });

        req.on('timeout', () => { req.destroy(); resolve({ success: false, data: null, error: 'Predict API timeout' }); });
        req.on('error', (e) => resolve({ success: false, data: null, error: e.message }));
        req.write(body);
        req.end();
    });
}

// ── PUBLIC: build per-test sub-recommendations ────────────────────────────────
function buildRecommendations(classified) {
    const diet = new Set();
    const lifestyle = new Set();
    const doctorNotes = [];
    const warnings = [];

    for (const [key, data] of Object.entries(classified)) {
        if (data.status === 'normal') continue;
        const rec = QUICK_RECS[key];
        if (rec) {
            (rec.diet || []).forEach(d => diet.add(d));
            (rec.lifestyle || []).forEach(l => lifestyle.add(l));
        }
        if (data.isCritical) {
            warnings.push(`⚠️ Critical ${data.status.replace('_', ' ')} in ${data.originalName || key} — immediate medical attention recommended.`);
        }
    }

    if (Object.values(classified).some(d => d.isCritical)) {
        doctorNotes.push('🚨 URGENT: Consult a physician immediately for critical values.');
    } else if (Object.values(classified).some(d => d.status !== 'normal')) {
        doctorNotes.push('Consult your physician with this report for proper evaluation and treatment.');
    }

    return {
        doctor: doctorNotes[0] || 'Report appears within normal limits. Continue routine checkups.',
        diet: [...diet].slice(0, 6),
        lifestyle: [...lifestyle].slice(0, 5),
        warnings,
    };
}

module.exports = { mapToSymptoms, callPredict, buildRecommendations };
