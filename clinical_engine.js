const fs = require('fs');
const path = require('path');

class ClinicalEngine {
    constructor() {
        this.brain = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'clinical_brain.json'), 'utf8'));
        this.prevalence = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'disease_prevalence.json'), 'utf8'));
        
        // India-Specific Priority Boosts
        this.INDIA_PRIORITY = {
            "Dengue": 1.35, "Malaria": 1.35, "Typhoid": 1.3, "Tuberculosis": 1.3,
            "Viral Fever": 1.25, "Chikungunya": 1.3, "Amebiasis": 1.2, "Cholera": 1.2,
            "Common Cold": 1.1, "Influenza": 1.2
        };

        this.PATTERNS = [
            { name: "Infectious Fever", symptoms: ["fever", "headache", "nausea"], diseases: ["Dengue", "Malaria", "Viral Fever", "Typhoid"], boost: 1.6 },
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
        const results = [];
        for (let i = 0; i < this.brain.count; i++) {
            const sim = this.cosineSimilarity(queryEmbedding, this.brain.embeddings[i]);
            results.push({ record: this.brain.records[i], similarity: sim });
        }
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, k);
    }

    getMatchScore(recSymptoms, inputSymptoms) {
        if (!recSymptoms || !inputSymptoms) return 0;
        const inputSet = new Set(inputSymptoms.map(s => s.toLowerCase().trim()));
        const recSet = new Set(recSymptoms.map(s => s.toLowerCase().trim()));
        let matches = 0;
        for (let s of inputSet) {
            if (recSet.has(s)) matches++;
        }
        return matches / inputSet.size;
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
            const recSymptoms = rec.symptoms || [];
            const disease = rec.disease;
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

            // Remedies & Doshas
            const ayur = rec.ayurveda || {};
            (ayur.doshas || []).forEach(d => doshas.set(d, (doshas.get(d) || 0) + 1));
            
            const rems = ayur.herbal_remedies || ayur.herbs || [];
            rems.forEach(r => remedies.herbs.set(r, (remedies.herbs.get(r) || 0) + 1));
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
        const maxScore = candidates[0].score;
        return candidates.map((c, i) => {
            let conf = Math.exp((c.score - maxScore) / 0.1);
            conf = Math.min(Math.max(conf, 0.5), 0.9);
            if (i === 0) conf = Math.max(conf, 0.82);
            return {
                disease: c.disease,
                confidence: Math.round(conf * 100) / 100
            };
        });
    }

    getTopRemedies(remedyPool) {
        const final = {};
        for (let type in remedyPool) {
            final[type] = Array.from(remedyPool[type].entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(x => x[0]);
        }
        return final;
    }
}

module.exports = new ClinicalEngine();
