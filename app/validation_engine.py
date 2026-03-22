import numpy as np

class ClinicalValidator:
    def __init__(self):
        # 1. Pattern Lock: Hard Domain Whitelists
        self.PATTERN_LOCKS = {
            "Infectious Fever": [
                "Dengue", "Malaria", "Viral Fever", "Typhoid", 
                "COVID-19", "Influenza", "Chikungunya", "Amebiasis", "Hepatitis"
            ],
            "Respiratory Distress": [
                "COVID-19", "Asthma", "Pneumonia", "Bronchitis", "COPD", "Tuberculosis"
            ],
            "Diabetes Classic": [
                "Diabetes", "Diabetes Mellitus", "Type 1 diabetes", "Type 2 diabetes", "Prediabetes"
            ],
            "Digestive Distress": [
                "Gastroenteritis", "Food poisoning", "Gastritis", "IBS", "Colitis", "Amebiasis"
            ],
            "Cardiac Emergency": [
                "Myocardial infarction", "Angina", "Coronary artery disease", "Arrhythmia", "Heart failure"
            ],
            "Joint Inflammation": [
                "Rheumatoid arthritis", "Osteoarthritis", "Gout", "Spondylosis", "Arthritis"
            ],
            "Urinary Infection": [
                "Urinary tract infection", "Cystitis", "Pyelonephritis", "Prostatitis", "UTI"
            ]
        }

        # 2. Critical Enforcement (Must-not-miss)
        self.MUST_NOT_MISS = {
            "Infectious Fever": ["Dengue", "Malaria", "Viral Fever", "Typhoid"],
            "Respiratory Distress": ["COVID-19", "Pneumonia", "Asthma", "Bronchitis"],
            "Diabetes Classic": ["Diabetes"],
            "Digestive Distress": ["Gastroenteritis", "Food poisoning"],
            "Cardiac Emergency": ["Myocardial infarction", "Angina"],
            "Joint Inflammation": ["Rheumatoid arthritis", "Osteoarthritis"],
            "Urinary Infection": ["Urinary tract infection"]
        }

        # 3. Elimination Filter: Systems to suppress
        self.IRRELEVANT_SYSTEMS = [
            "dermatology", "bone", "eye", "psychiatric", "genetic", "congenital",
            "eczema", "acne", "psoriasis", "arthrosis", "osteoporosis", "syndrome", "genetic", "rare"
        ]

    def validate_and_rank(self, candidates, symptoms, active_patterns):
        """
        candidates: list of {"disease": str, "score": float, "match_score": float, "prevalence": float}
        symptoms: list of input strings
        active_patterns: list of pattern names (from pattern_engine)
        """
        validated = []
        pattern_locked_results = []
        
        # --- STEP 1: Pattern Lock (Hard Constraint) ---
        if active_patterns:
            primary_pattern = active_patterns[0] # Focus on the dominant pattern
            allowed_list = self.PATTERN_LOCKS.get(primary_pattern, [])
            
            if allowed_list:
                for cand in candidates:
                    d_name = cand["disease"].lower()
                    if any(allowed.lower() in d_name for allowed in allowed_list):
                        pattern_locked_results.append(cand)
            else:
                pattern_locked_results = candidates
        else:
            pattern_locked_results = candidates

        # --- STEP 2 & 3: Elimination & Consistency ---
        for cand in pattern_locked_results:
            d_name = cand["disease"].lower()
            match_score = cand.get("match_score", 0)
            
            # Match Match Score Requirement (Step 3)
            if match_score < 0.4: continue
            
            # Hard Elimination Filter (Step 2)
            is_irrelevant = any(sys_name in d_name for sys_name in self.IRRELEVANT_SYSTEMS)
            if is_irrelevant and match_score < 0.9: # 90% threshold for rare/genetic bypass
                continue
            
            # Boosting (Step 3)
            if match_score >= 0.9:
                cand["score"] *= 1.5
            elif match_score >= 0.7:
                cand["score"] *= 1.25
                
            validated.append(cand)

        # --- STEP 4: Critical Enforcement (Mandatory Injection) ---
        for pattern in active_patterns:
            must_includes = self.MUST_NOT_MISS.get(pattern, [])
            for must in must_includes:
                # Check if already present
                if not any(must.lower() in v["disease"].lower() for v in validated):
                    # Add manually with moderate-high score
                    validated.append({
                        "disease": must,
                        "score": 0.7, # Base rank score
                        "match_score": 0.5,
                        "injected": True
                    })

        # --- STEP 5: Re-ranking ---
        # Sort by score primarily
        validated.sort(key=lambda x: x["score"], reverse=True)
        
        # Deduplicate
        seen = set()
        final_list = []
        for v in validated:
            d_clean = v["disease"].strip().lower()
            if d_clean not in seen:
                final_list.append(v)
                seen.add(d_clean)
        
        # Limit to 5 (Step 9)
        final_predictions = final_list[:5]

        # --- STEP 6: Confidence Rebuild (Softmax) ---
        if not final_predictions: return [], ""
        
        scores = np.array([f["score"] for f in final_predictions])
        temp = 0.1
        exp_scores = np.exp((scores - np.max(scores)) / temp)
        probs = exp_scores / np.sum(exp_scores)
        
        # Clamp and Rebuild (Step 6)
        results = []
        for i, (prob, cand) in enumerate(zip(probs, final_predictions)):
            conf = min(max(float(prob), 0.5), 0.9)
            
            # Enforce Top Disease >= 0.7
            if i == 0: conf = max(conf, 0.75)
            
            # Strong match boost
            if cand.get("match_score", 0) >= 0.9: conf = max(conf, 0.85)
            
            results.append({
                "disease": cand["disease"],
                "confidence": round(conf, 2)
            })

        # --- STEP 8: Clinical Notes ---
        notes = self._generate_notes(results, symptoms, active_patterns)

        return results, notes

    def _generate_notes(self, predictions, symptoms, active_patterns):
        if not predictions: return ""
        top = predictions[0]["disease"]
        
        if active_patterns:
            pattern = active_patterns[0]
            if "Fever" in pattern:
                return f"{', '.join(symptoms)} strongly indicates infectious etiology; {top} and common alternatives are most probable in endemic regions."
            if "Respiratory" in pattern:
                return f"Respiratory distress pattern detected; prioritizing {top} to ensure clinical safety."
            return f"Symptom cluster consistent with {pattern} pattern."
        
        return f"Clinical priority given to {top} based on symptom match strength and prevalence."
