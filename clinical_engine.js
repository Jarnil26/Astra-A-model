const fs = require('fs');
const path = require('path');

class ClinicalEngine {
    constructor() {
        this.brain = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'clinical_brain.json'), 'utf8'));
        this.prevalence = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'disease_prevalence.json'), 'utf8'));
        
        // India-Specific Priority Boosts (High-Accuracy Production Tuning)
        this.INDIA_PRIORITY = {
            "Dengue": 1.35, "Malaria": 1.35, "Typhoid": 1.3, "Tuberculosis": 1.3,
            "Viral Fever": 1.25, "Chikungunya": 1.3, "Amebiasis": 1.1, "Cholera": 1.2,
            "Common Cold": 2.5, "Influenza": 2.5
        };

        // symptom expansion (Colloquial -> Clinical)
        this.SYMPTOM_EXPANSION = {
            "cold": ["coryza", "runny nose", "sneezing", "congestion"],
            "cough": ["bronchitis", "phlegm", "dry cough"],
            "fever": ["pyrexia", "high temperature", "chills"],
            "body pain": ["myalgia", "joint pain", "malaise"]
        };

        this.PATTERNS = [
            { name: "Infectious Fever", symptoms: ["fever", "headache", "nausea", "chills"], diseases: ["Dengue", "Malaria", "Viral Fever", "Typhoid", "Influenza"], boost: 2.0 },
            { name: "Common Cold", symptoms: ["cold", "sneezing", "coryza", "runny nose"], diseases: ["Common Cold", "Influenza", "Allergic Rhinitis"], boost: 2.5 },
            { name: "Respiratory Distress", symptoms: ["cough", "shortness of breath", "fatigue"], diseases: ["COVID-19", "Asthma", "Pneumonia", "Bronchitis"], boost: 1.8 }
        ];
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    search(queryEmbedding, k = 10) {
        if (!queryEmbedding || queryEmbedding.every(v => v === 0)) return [];
        const results = [];
        for (let i = 0; i < this.brain.count; i++) {
            const emb = this.brain.embeddings[i];
            if (!emb) continue;
            const sim = this.cosineSimilarity(queryEmbedding, emb);
            results.push({ record: this.brain.records[i], similarity: isNaN(sim) ? 0 : sim });
        }
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, k);
    }

    getMatchScore(recSymptoms, inputSymptoms) {
        if (!recSymptoms || !inputSymptoms) return 0;
        
        // Expand input symptoms
        let expanded = [...inputSymptoms];
        inputSymptoms.forEach(s => {
            const extra = this.SYMPTOM_EXPANSION[s.toLowerCase().trim()] || [];
            expanded = expanded.concat(extra);
        });

        const inputSet = new Set(expanded.map(s => s.toLowerCase().trim()));
        const recSet = new Set(recSymptoms.map(s => s.toLowerCase().trim()));
        
        let matches = 0;
        const targetSet = new Set(inputSymptoms.map(s => s.toLowerCase().trim()));
        for (let s of targetSet) {
            // Check direct match
            if (recSet.has(s)) {
                matches++;
                continue;
            }
            // Check expanded match
            const extras = this.SYMPTOM_EXPANSION[s] || [];
            if (extras.some(ex => recSet.has(ex))) {
                matches += 0.8; // Partial credit for expanded match
            }
        }
        return matches / targetSet.size;
    }

    aggregate(retrievalResults, inputSymptoms) {
        const potentialCandidates = new Map();
        const doshas = new Map();
        const remedies = { herbs: new Map(), home_remedies: new Map(), yoga: new Map(), lifestyle: new Map() };

        // 1. Detect Patterns
        const activePatterns = this.detectPatterns(inputSymptoms);
        const patternBoostMap = new Map();
        for (let p of activePatterns) {
            for (let d of p.diseases) {
                patternBoostMap.set(d, p.boost);
            }
        }

        // 2. Score
        for (let res of retrievalResults) {
            const { record: rec, similarity: sim } = res;
            const disease = (rec.disease || "").trim();
            
            // SKIP EMPTY OR INVALID DISEASES
            if (!disease || disease.length < 2) continue;
            
            const recSymptoms = rec.symptoms || [];
            const matchScore = this.getMatchScore(recSymptoms, inputSymptoms);
            
            const prev = this.prevalence[disease] || 0.05;
            const pattBoost = patternBoostMap.get(disease) || 1.0;
            const indiaBoost = this.INDIA_PRIORITY[disease] || 1.0;

            // Scoring Logic Parity with Python
            const score = (0.4 * sim) + (0.2 * prev) + (0.15 * matchScore) + (0.15 * (pattBoost - 1.0));
            const finalScore = score * indiaBoost;

            if (!potentialCandidates.has(disease) || finalScore > potentialCandidates.get(disease).score) {
                potentialCandidates.set(disease, { 
                    disease, 
                    score: finalScore, 
                    matchScore, 
                    prevalence: prev 
                });
            }

            // Remedies & Doshas (EXHAUSTIVE LOCATIONAL EXTRACTION)
            const ayur = rec.ayurveda || {};
            const treatment = rec.treatment || {};
            
            (ayur.doshas || rec.doshas || []).forEach(d => doshas.set(d, (doshas.get(d) || 0) + 1));
            
            // Map every possible dataset locational key
            const map = {
                herbs: ayur.herbal_remedies || ayur.herbs || rec.herbs || rec.herbal_remedies || [],
                home_remedies: ayur.home_remedies || treatment.home_remedies || ayur.treatment?.home_remedies || rec.home_remedies || [],
                yoga: ayur.yoga || treatment.yoga || ayur.treatment?.yoga || rec.yoga || rec.yoga_poses || [],
                lifestyle: ayur.lifestyle || treatment.lifestyle || ayur.treatment?.lifestyle || rec.lifestyle || rec.lifestyle_advice || []
            };

            for (let [key, items] of Object.entries(map)) {
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        remedies[key].set(item, (remedies[key].get(item) || 0) + 1);
                    });
                }
            }
        }

        const sortedCandidates = Array.from(potentialCandidates.values())
            .filter(c => inputSymptoms.length > 2 ? c.matchScore >= 0.4 : c.matchScore >= 0.1)
            .sort((a, b) => b.score - a.score);

        return {
            predictions: this.calibrate(sortedCandidates.slice(0, 5)),
            dosha: Array.from(doshas.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]),
            remedies: this.getTopRemedies(remedies),
            status: sortedCandidates.length > 0 ? "Success" : "More symptoms required."
        };
    }

    detectPatterns(inputSymptoms) {
        const inputSet = new Set(inputSymptoms.map(s => s.toLowerCase().trim()));
        return this.PATTERNS.filter(p => {
            const pSymptSet = new Set(p.symptoms.map(s => s.toLowerCase().trim()));
            const intersection = Array.from(pSymptSet).filter(x => inputSet.has(x));
            return intersection.length >= 2 || (intersection.length / pSymptSet.size) >= 0.7;
        });
    }

    calibrate(candidates) {
        if (candidates.length === 0) return [];
        const maxScore = candidates[0].score || 0.1;
        
        return candidates.map((c, i) => {
            const currentScore = c.score || 0;
            // Numerical stability: Clamp score diff
            let diff = (currentScore - maxScore) / 0.1;
            if (isNaN(diff)) diff = -10;
            
            let conf = Math.exp(diff);
            
            // Clamp and bias
            conf = Math.min(Math.max(conf, 0.4), 0.95);
            if (i === 0) conf = Math.max(conf, 0.85);
            
            // Boost for high clinical matches
            if (c.matchScore >= 0.8) conf = Math.max(conf, 0.9);
            
            return {
                disease: c.disease,
                confidence: Number(conf.toFixed(2))
            };
        });
    }

    getTopRemedies(remedyPool) {
        const final = {};
        for (let type in remedyPool) {
            final[type] = Array.from(remedyPool[type].entries())
                .sort((a, b) => b[1] - a[1])
                .map(x => x[0].toLowerCase().trim())
                .filter(item => {
                    // FILTER OUT GENERIC PLACEHOLDERS
                    const generic = ["none", "none specific", "n/a", "no", "nil", "void", "none."];
                    return item.length > 2 && !generic.includes(item);
                })
                .slice(0, 5);
        }
        return final;
    }
}

module.exports = new ClinicalEngine();
