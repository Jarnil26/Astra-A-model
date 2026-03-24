/**
 * Astra R0.0 — Report Response Sanitizer
 * Guarantees the shape of the Python engine response before
 * sending it to the frontend. Fills missing fields with safe defaults.
 */

/**
 * @param {any} raw - Raw JSON from Python engine
 * @returns {Object} Sanitized response conforming to the R0.0 schema
 */
function sanitizeReportResponse(raw) {
    if (!raw || typeof raw !== 'object') {
        return _emptyResponse();
    }

    return {
        patient: _sanitizePatient(raw.patient),
        raw_text_length: typeof raw.raw_text_length === 'number' ? raw.raw_text_length : 0,
        tests_detected: typeof raw.tests_detected === 'number' ? raw.tests_detected : 0,
        abnormalities: Array.isArray(raw.abnormalities)
            ? raw.abnormalities.map(_sanitizeAbnormality)
            : [],
        normal_tests: Array.isArray(raw.normal_tests)
            ? raw.normal_tests.map(_sanitizeNormalTest)
            : [],
        predictions: Array.isArray(raw.predictions)
            ? raw.predictions.slice(0, 5).map(_sanitizePrediction)
            : [],
        recommendations: _sanitizeRecommendations(raw.recommendations),
        is_urgent: typeof raw.is_urgent === 'boolean' ? raw.is_urgent : false,
        processing_time_s: typeof raw.processing_time_s === 'number'
            ? raw.processing_time_s : null,
        engine: raw.engine || 'Astra R0.0',
    };
}

function _sanitizePatient(p) {
    if (!p) return { name: null, age: null, gender: null, report_id: null, date: null };
    return {
        name: typeof p.name === 'string' ? p.name.trim().substring(0, 100) : null,
        age: typeof p.age === 'number' ? p.age : null,
        gender: typeof p.gender === 'string' ? p.gender.toLowerCase() : null,
        report_id: typeof p.report_id === 'string' ? p.report_id.substring(0, 50) : null,
        date: typeof p.date === 'string' ? p.date.substring(0, 30) : null,
    };
}

function _sanitizeAbnormality(a) {
    return {
        test: String(a.test || ''),
        display_name: String(a.display_name || a.test || ''),
        value: a.value !== undefined ? a.value : null,
        unit: String(a.unit || ''),
        status: String(a.status || 'unknown'),
        reference_range: String(a.reference_range || ''),
        deviation_pct: typeof a.deviation_pct === 'number' ? a.deviation_pct : null,
        is_critical: Boolean(a.is_critical),
    };
}

function _sanitizeNormalTest(t) {
    return {
        test: String(t.test || ''),
        display_name: String(t.display_name || t.test || ''),
        value: t.value !== undefined ? t.value : null,
        unit: String(t.unit || ''),
        status: 'normal',
        reference_range: String(t.reference_range || ''),
    };
}

function _sanitizePrediction(p) {
    return {
        disease: String(p.disease || ''),
        confidence: typeof p.confidence === 'number'
            ? Math.round(p.confidence * 100) / 100 : 0,
        contributing_tests: Array.isArray(p.contributing_tests) ? p.contributing_tests : [],
        urgent: Boolean(p.urgent),
        recommendations: _sanitizeRecommendations(p.recommendations),
    };
}

function _sanitizeRecommendations(r) {
    if (!r) return { doctor: '', diet: [], lifestyle: [], warnings: [] };
    return {
        doctor: String(r.doctor || r.all_doctor_notes?.[0] || ''),
        all_doctor_notes: Array.isArray(r.all_doctor_notes) ? r.all_doctor_notes : [],
        diet: Array.isArray(r.diet) ? r.diet.slice(0, 6).map(String) : [],
        lifestyle: Array.isArray(r.lifestyle) ? r.lifestyle.slice(0, 5).map(String) : [],
        warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
    };
}

function _emptyResponse() {
    return {
        patient: { name: null, age: null, gender: null, report_id: null, date: null },
        raw_text_length: 0,
        tests_detected: 0,
        abnormalities: [],
        normal_tests: [],
        predictions: [],
        recommendations: { doctor: '', diet: [], lifestyle: [], warnings: [] },
        is_urgent: false,
        processing_time_s: null,
        engine: 'Astra R0.0',
    };
}

module.exports = { sanitizeReportResponse };
