const fs = require('fs');
const path = require('path');

class ClinicalEngine {
    constructor() {
        this.brain = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'clinical_brain.json'), 'utf8'));
        this.prevalence = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'disease_prevalence.json'), 'utf8'));
        
        // Normalized India-Specific Priority Boosts (LOWERCASE ONLY)
        this.INDIA_PRIORITY = {
            "dengue": 1.35, "malaria": 1.35, "typhoid": 1.3, "tuberculosis": 1.3,
            "viral fever": 1.25, "chikungunya": 1.3, "amebiasis": 0.3, "cholera": 1.2,
            "common cold": 5.0, "influenza": 5.0
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
            { name: "Respiratory Distress", symptoms: ["cough", "shortness of breath", "fatigue"], diseases: ["COVID-19", "Asthma", "Pneumonia", "Bronchitis"], boost: 1.8 },
            { name: "Diabetes Classic", symptoms: ["frequent urination", "increased thirst", "weight loss"], diseases: ["Diabetes"], boost: 2.0 },
            { name: "Digestive Distress", symptoms: ["abdominal pain", "diarrhea", "vomiting"], diseases: ["Gastroenteritis", "Food poisoning", "Gastritis", "IBS"], boost: 1.6 },
            { name: "Cardiac Emergency", symptoms: ["chest pain", "shortness of breath", "sweating"], diseases: ["Myocardial infarction", "Angina", "Coronary artery disease"], boost: 2.0 },
            { name: "Joint Inflammation", symptoms: ["joint pain", "stiffness", "swelling"], diseases: ["Rheumatoid arthritis", "Osteoarthritis", "Gout"], boost: 1.7 },
            { name: "Urinary Infection", symptoms: ["burning urination", "frequent urination", "lower abdominal pain"], diseases: ["Urinary tract infection", "Cystitis", "Prostatitis"], boost: 1.7 }
        ];

        // Global Clinical Protocol Fallbacks
        this.GLOBAL_PROTOCOLS = {
            "common cold": {
                home_remedies: ["Ginger Tea", "Honey & Pepper", "Salt water gargle", "Steam inhalation", "Turmeric Milk"],
                yoga: ["Pranayama (Nadi Shodhana)", "Surya Namaskar (Slow)", "Matsyasana", "Viparita Karani"],
                lifestyle: ["Avoid cold showers", "Drink warm water only", "Rest in a well-ventilated room", "Light diet (Kanji)"]
            },
            "fever": {
                home_remedies: ["Raisin & Ginger Paste", "Coriander seed water", "Basil (Tulsi) Tea", "Sandalwood paste on forehead"],
                yoga: ["Shitalii Pranayama", "Bhramari Pranayama", "Shavasana"],
                lifestyle: ["Complete bed rest", "Wipe body with warm water", "Avoid oily/heavy food", "Keep hydrated"]
            },
            "influenza": {
                home_remedies: ["Ginger & Tulsi decoction", "Garlic infused honey", "Cinnamon tea", "Warm salt water gargle"],
                yoga: ["Pranayama", "Adho Mukha Svanasana", "Setu Bandhasana"],
                lifestyle: ["Total isolation and rest", "Hydration with warm herbal teas", "Sattvic diet", "Avoid dairy"]
            }
        };
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
        // Normalize input
        const normalizedInput = inputSymptoms.map(s => s.toLowerCase().trim()).filter(s => s.length > 0);
        const potentialCandidates = new Map();
        const doshas = new Map();
        const remedies = { herbs: new Map(), home_remedies: new Map(), yoga: new Map(), lifestyle: new Map() };

        // 1. Detect Patterns
        const activePatterns = this.detectPatterns(normalizedInput);
        const patternBoostMap = new Map();
        
        for (let p of activePatterns) {
            for (let d of p.diseases) {
                const currentBoost = patternBoostMap.get(d.toLowerCase()) || 1.0;
                patternBoostMap.set(d.toLowerCase(), Math.max(currentBoost, p.boost));
            }
        }

        // 2. Score & Filter
        for (let res of retrievalResults) {
            const { record: rec, similarity: sim } = res;
            const disease = (rec.disease || "").trim();
            const lookup = disease.toLowerCase();
            
            // STRICT FILTERING
            if (!disease || disease.length < 3) continue;
            
            // Remove symptoms-as-diseases
            const symptomDiseases = ["fever", "cough", "pain", "headache", "nausea", "cold"];
            if (normalizedInput.includes(lookup) && symptomDiseases.includes(lookup)) continue;
            
            // Pattern Category Enforcement
            if (activePatterns.length > 0) {
                let isAllowed = false;
                for (let p of activePatterns) {
                    if (p.diseases.some(d => d.toLowerCase() === lookup)) {
                        isAllowed = true;
                        break;
                    }
                }
                if (!isAllowed && sim < 0.85) continue; 
            }

            const recSymptoms = rec.symptoms || (rec.input ? rec.input.symptoms : []);
            const matchScore = this.getMatchScore(recSymptoms, normalizedInput);
            
            const prevalenceVal = this.prevalence[disease] || (this.prevalence[lookup] || 0.05);
            const indiaBoost = this.INDIA_PRIORITY[lookup] || 1.0;
            const pattBoost = patternBoostMap.get(lookup) || 1.0;

            // Updated Formula: 0.4*sim + 0.2*prev + 0.15*match + 0.15*(pattBoost-1)
            const score = (0.4 * sim) + (0.2 * prevalenceVal) + (0.15 * matchScore) + (0.15 * (pattBoost - 1.0));
            const finalScore = score * indiaBoost;

            if (!potentialCandidates.has(disease) || finalScore > potentialCandidates.get(disease).score) {
                potentialCandidates.set(disease, { 
                    disease, 
                    score: finalScore, 
                    matchScore, 
                    prevalence: prevalenceVal,
                    rec: rec
                });
            }
        }

        let sortedCandidates = Array.from(potentialCandidates.values())
            .filter(c => c.matchScore > 0.1)
            .sort((a, b) => b.score - a.score);

        // Inject Core Diseases if missing
        for (let p of activePatterns) {
            p.diseases.slice(0, 2).forEach(must => {
                if (!sortedCandidates.some(c => c.disease.toLowerCase() === must.toLowerCase())) {
                    sortedCandidates.push({ disease: must, score: 0.7, matchScore: 0.5, rec: null });
                }
            });
        }
        sortedCandidates.sort((a, b) => b.score - a.score);

        const topCandidates = sortedCandidates.slice(0, 5);

        // 3. Extract Remedies ONLY from Top Candidates
        function extractStrings(obj) {
            let result = [];
            if (typeof obj === 'string') {
                if (obj.includes(',') && obj.length < 100) {
                    obj.split(',').forEach(s => {
                        const clean = s.toLowerCase().trim();
                        if (clean.length > 2 && !["none", "n/a", "nil", "[object object]"].includes(clean)) result.push(clean);
                    });
                } else {
                    const clean = obj.toLowerCase().trim();
                    if (clean.length > 2 && !["none", "n/a", "nil", "[object object]"].includes(clean)) result.push(clean);
                }
            } else if (Array.isArray(obj)) {
                obj.forEach(item => result.push(...extractStrings(item)));
            } else if (typeof obj === 'object' && obj !== null) {
                Object.values(obj).forEach(val => result.push(...extractStrings(val)));
            }
            return result;
        }

        // We use the doshas and remedies maps created at the top of the function
        for (let c of topCandidates) {
            if (!c.rec) continue;
            const rec = c.rec;
            const ayur = rec.ayurveda || {};
            const treatment = rec.treatment || {};
            (ayur.doshas || rec.doshas || []).forEach(d => doshas.set(d, (doshas.get(d) || 0) + 1));
            
            const h = ayur.herbal_remedies || ayur.herbs || rec.herbal_remedies || rec.herbs || ayur.herbs_list || [];
            const hr = ayur.home_remedies || treatment.home_remedies || rec.home_remedies || rec.remedies || ayur.formulation || ayur.home_remedy || rec.home_remedy || ayur.ayurvedic_remedies || [];
            const y = ayur.yoga || treatment.yoga || ayur.yoga_poses || rec.yoga || rec.yoga_poses || rec.yoga_list || ayur.asana || [];
            const l = ayur.lifestyle_recommendations || ayur.diet_lifestyle_recommendations || treatment.lifestyle || ayur.lifestyle_advice || rec.diet_lifestyle || rec.lifestyle_advice || ayur.diet_lifestyle || ayur.dietary_advice || [];

            const map = { herbs: h, home_remedies: hr, yoga: y, lifestyle: l };

            for (let [key, items] of Object.entries(map)) {
                const extracted = extractStrings(items);
                extracted.forEach(cleanItem => {
                    // Boost based on candidate rank so top diseases dominate
                    const baseWeight = c.score * 10;
                    remedies[key].set(cleanItem, (remedies[key].get(cleanItem) || 0) + baseWeight);
                });
            }
        }

        // 4. GLOBAL PROTOCOL INJECTION (Fallback for missing data like Dengue and Malaria)
        const activeProtocolKeys = new Set();
        if (topCandidates.length > 0) activeProtocolKeys.add(topCandidates[0].disease.toLowerCase());
        for (let p of activePatterns) {
            if (p.name === "Infectious Fever") activeProtocolKeys.add("fever");
            if (p.name === "Common Cold") activeProtocolKeys.add("common cold");
            if (p.name === "Respiratory Distress") activeProtocolKeys.add("influenza");
        }

        for (let pKey of activeProtocolKeys) {
            if (this.GLOBAL_PROTOCOLS[pKey]) {
                const protocol = this.GLOBAL_PROTOCOLS[pKey];
                for (let [key, items] of Object.entries(protocol)) {
                     if (!remedies[key] || remedies[key].size < 2) {
                         if (!remedies[key]) remedies[key] = new Map();
                         items.forEach(item => remedies[key].set(item.toLowerCase().trim(), 100)); // Max priority
                     }
                }
            }
        }

        return {
            predictions: this.calibrate(topCandidates),
            dosha: Array.from(doshas.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]),
            remedies: this.getTopRemedies(remedies),
            active_patterns: activePatterns.map(p => p.name),
            status: topCandidates.length > 0 ? "Success" : "More symptoms required."
        };
    }

    detectPatterns(inputSymptoms) {
        const inputSet = new Set(inputSymptoms.map(s => s.toLowerCase().trim()));
        return this.PATTERNS.filter(p => {
            const pSymptSet = new Set(p.symptoms.map(s => s.toLowerCase().trim()));
            const intersection = Array.from(pSymptSet).filter(x => inputSet.has(x));
            return intersection.length >= 2 || (intersection.length / pSymptSet.size) >= 0.6;
        });
    }

    calibrate(candidates) {
        if (candidates.length === 0) return [];
        const scores = candidates.map(c => c.score);
        const maxScore = Math.max(...scores);
        const temp = 0.1;
        
        const exps = scores.map(s => Math.exp((s - maxScore) / temp));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        const softProbs = exps.map(e => e / sumExps);

        return candidates.map((c, i) => {
            let conf = softProbs[i];
            conf = Math.min(Math.max(conf, 0.5), 0.9);
            if (i === 0) conf = Math.max(conf, 0.76);
            
            return {
                disease: c.disease,
                confidence: Number(conf.toFixed(2))
            };
        }).map((c, i, arr) => {
            if (i > 0 && c.confidence >= arr[i-1].confidence) {
                c.confidence = Number((arr[i-1].confidence - 0.03).toFixed(2));
            }
            return c;
        });
    }

    getTopRemedies(remedyPool) {
        const final = {};
        for (let type in remedyPool) {
            final[type] = Array.from(remedyPool[type].entries())
                .sort((a, b) => b[1] - a[1])
                .map(x => x[0])
                .filter(item => item.length > 2 && !["none", "n/a"].includes(item.toLowerCase()))
                .slice(0, 5);
        }
        return final;
    }
}

module.exports = new ClinicalEngine();
