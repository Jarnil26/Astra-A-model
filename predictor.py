import numpy as np
import json
import os
from collections import Counter, defaultdict
from pattern_engine import PatternEngine
from validation_engine import ClinicalValidator

class AdvancedPredictor:
    def __init__(self, db_path="ayurveda_ai.db", prevalence_path="disease_prevalence.json", temperature=0.1):
        self.db_path = db_path
        self.temp = temperature
        self.prevalence = self._load_json(prevalence_path)
        self.pattern_engine = PatternEngine()
        self.validator = ClinicalValidator()
        
        # India-Specific Priority Boosts (Exhaustive Indian Diagnostic Context)
        self.INDIA_PRIORITY = {
            # Infectious & Tropical
            "Dengue": 1.35, "Malaria": 1.35, "Typhoid": 1.3, "Tuberculosis": 1.3, 
            "Viral Fever": 1.25, "Chikungunya": 1.3, "Amebiasis": 1.2, "Cholera": 1.2, 
            "Leptospirosis": 1.2, "Kala Azar": 1.2, "Japanese Encephalitis": 1.2,
            
            # Liver & Digestive
            "Jaundice": 1.25, "Hepatitis A": 1.25, "Hepatitis E": 1.25, "Fatty Liver": 1.2,
            "NAFLD": 1.15, "Cirrhosis": 1.15, "GERD": 1.2, "Acid Reflux": 1.2,
            "Gastritis": 1.2, "Piles": 1.2, "Hemorrhoids": 1.2, "Anal Fissure": 1.2,
            "Fistula": 1.2, "Gallstones": 1.15, "IBS": 1.15, "Peptic Ulcer": 1.2,
            
            # Metabolic & Hormonal
            "Diabetes": 1.25, "Type 2 Diabetes": 1.25, "PCOS": 1.2, "PCOD": 1.2,
            "Hypothyroidism": 1.2, "Hyperthyroidism": 1.2, "Obesity": 1.1,
            "Vitamin D Deficiency": 1.25, "Vitamin B12 Deficiency": 1.25,
            "Iron Deficiency Anemia": 1.25, "Dyslipidemia": 1.15, "Hypertension": 1.2,
            
            # Respiratory & ENT
            "Asthma": 1.2, "Bronchitis": 1.2, "Sinusitis": 1.2, "Allergic Rhinitis": 1.2,
            "Tonsillitis": 1.2, "Pharyngitis": 1.15, "Otitis Media": 1.15, "COPD": 1.15,
            
            # Orthopedic & Muscle
            "Osteoarthritis": 1.15, "Rheumatoid Arthritis": 1.15, "Gout": 1.2,
            "Cervical Spondylosis": 1.2, "Lumbar Spondylosis": 1.2, "Sciatica": 1.2,
            "Frozen Shoulder": 1.15, "Osteoporosis": 1.15,
            
            # Neurological & Mental
            "Migraine": 1.2, "Vertigo": 1.2, "Epilepsy": 1.15, "Depression": 1.15,
            "Anxiety": 1.15, "Insomnia": 1.15, "Tension Headache": 1.15,
            
            # Renal & Others
            "Kidney Stones": 1.2, "UTI": 1.25, "Cystitis": 1.2, "Heat Stroke": 1.3,
            "Conjunctivitis": 1.2, "Skin Allergy": 1.2, "Eczema": 1.15, "Psoriasis": 1.15,
            "Fungal Infection": 1.2, "Tinea": 1.2, "Scabies": 1.2, "Chickenpox": 1.2
        }

        # Legacy Rules (merged/fallback)
        self.RULES = [
            {"symptoms": ["fever", "headache", "joint pain"], "boost": ["Chikungunya", "Dengue"], "factor": 1.7},
            {"symptoms": ["fever", "chills", "sweating"], "boost": ["Malaria"], "factor": 1.7},
            {"symptoms": ["fever", "abdominal pain", "headache"], "boost": ["Typhoid", "Amebiasis"], "factor": 1.6},
            {"symptoms": ["yellow eyes", "dark urine", "nausea"], "boost": ["Jaundice", "Hepatitis"], "factor": 1.8},
            {"symptoms": ["increased thirst", "frequent urination", "weight loss"], "boost": ["Diabetes Mellitus"], "factor": 1.8},
            {"symptoms": ["red eyes", "watering", "itching"], "boost": ["Conjunctivitis"], "factor": 1.7}
        ]

    def _load_json(self, path):
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def get_match_score(self, rec_symptoms, input_symptoms):
        if not input_symptoms: return 0
        input_set = set(s.lower().strip() for s in input_symptoms if s.strip())
        rec_set = set(s.lower().strip() for s in rec_symptoms if s.strip())
        if not input_set: return 0
        matches = len(input_set.intersection(rec_set))
        return matches / len(input_set)

    def calibrate(self, scores):
        scores = np.array(scores)
        if len(scores) == 0: return []
        exp_scores = np.exp((scores - np.max(scores)) / self.temp)
        probs = exp_scores / np.sum(exp_scores)
        
        calibrated = []
        for p in probs:
            # Clamp to 0.85 max as requested
            c = min(float(p), 0.85)
            # Ensure a floor for strong matches in clinical look
            if p > 0.4: c = max(c, 0.65)
            calibrated.append(round(c, 2))
        return calibrated

    def aggregate(self, retrieval_results, input_symptoms):
        # Normalize symptoms immediately
        input_symptoms = [s.lower().strip() for s in input_symptoms if s.strip()]
        if not retrieval_results and not input_symptoms:
            return {"predictions": [], "status": "No symptoms provided."}

        # 1. Detect Patterns
        active_patterns = self.pattern_engine.detect_patterns(input_symptoms)
        
        # 2. Map Symptoms to Pattern Boosts
        pattern_booster = defaultdict(lambda: 1.0)
        for p in active_patterns:
            for d in p["diseases"]:
                pattern_booster[d] = max(pattern_booster[d], p["boost"])

        potential_candidates = []
        dosha_counts = Counter()
        remedy_pool = defaultdict(Counter)
        
        # 3. Process Retrieval Results
        for res in retrieval_results:
            sim = res["similarity"]
            rec = res["record"]
            # Flexible symptom lookup
            rec_symptoms = rec.get("symptoms", rec.get("input", {}).get("symptoms", []))
            
            match_score = self.get_match_score(rec_symptoms, input_symptoms)
            disease = rec.get("disease", "Unknown")
            
            if disease == "Unknown" or not disease: continue

            prev = self.prevalence.get(disease, 0.05)
            patt_boost = pattern_booster[disease]
            
            # Formula: 0.4*sim + 0.2*prev + 0.15*match + 0.15*(patt_boost-1) + 0.1*(rule_boost-1)
            # Rule boost is 1.0 (neutral) unless defined otherwise
            rule_boost = 1.0
            
            final_s = (0.4 * sim) + (0.2 * prev) + (0.15 * match_score) + (0.15 * (patt_boost - 1.0))
            
            potential_candidates.append({
                "disease": disease,
                "score": final_s,
                "match_score": match_score,
                "prevalence": prev
            })

            # Metadata aggregation
            dosha_counts.update(rec.get("knowledge", {}).get("dosha_imbalance", rec.get("doshas", [])))
            for rtype in ["herbs", "home_remedies", "yoga", "lifestyle"]:
                # Try multiple keys for remedies
                items = rec.get("remedies", {}).get(rtype, [])
                if not items:
                    items = rec.get("ayurveda", {}).get(rtype, []) or rec.get(rtype, [])
                
                if isinstance(items, list):
                    remedy_pool[rtype].update([str(i) for i in items if i])

        # --- FINAL STEP: CLINICAL VALIDATION ENGINE ---
        final_preds, clinical_notes = self.validator.validate_and_rank(
            potential_candidates, 
            input_symptoms, 
            [p["name"] for p in active_patterns]
        )

        # Remedy Diversification
        final_remedies = {}
        for rtype in ["herbs", "home_remedies", "yoga", "lifestyle"]:
            counts = remedy_pool[rtype]
            final_remedies[rtype] = [item for item, count in counts.most_common(5)]

        return {
            "predictions": final_preds,
            "dosha": [d for d, c in dosha_counts.most_common(2)],
            "remedies": final_remedies,
            "pattern_validated": True if active_patterns else False,
            "active_patterns": [p["name"] for p in active_patterns],
            "notes": clinical_notes,
            "status": "Success" if final_preds else "More symptoms required."
        }
