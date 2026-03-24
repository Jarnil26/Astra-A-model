"""
Astra R0.0 — Disease Predictor & Recommendation Generator
Rule-based mapping: abnormal lab patterns → diseases + confidence
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ─── DISEASE RULES ───────────────────────────────────────────────────────────
# Each rule: { conditions, disease, confidence, recommendations }
# Conditions: { test_key: [list of matching statuses] }

DISEASE_RULES = [
    {
        "disease": "Iron Deficiency Anemia",
        "conditions": {"hemoglobin": ["low", "critical_low"]},
        "bonus": {"mcv": ["low"], "mch": ["low"], "iron": ["low"], "ferritin": ["low"]},
        "base_confidence": 0.65,
        "recommendations": {
            "doctor": "Consult a hematologist or general physician within 1–2 weeks.",
            "diet": ["Iron-rich foods: spinach, lentils, red meat, tofu, fortified cereals",
                     "Pair iron with Vitamin C (citrus, tomatoes) for better absorption",
                     "Avoid tea/coffee immediately after meals (reduces iron absorption)"],
            "lifestyle": ["Moderate physical activity; avoid exhausting exertion until levels improve",
                          "Address any sources of blood loss"],
            "warning": None,
        }
    },
    {
        "disease": "Severe Anemia",
        "conditions": {"hemoglobin": ["critical_low"]},
        "bonus": {},
        "base_confidence": 0.90,
        "recommendations": {
            "doctor": "⚠️ URGENT: Seek immediate medical attention — hemoglobin critically low.",
            "diet": ["Increase dietary iron immediately"],
            "lifestyle": ["Limit physical exertion", "Rest is imperative"],
            "warning": "Critically low hemoglobin — may require blood transfusion.",
        }
    },
    {
        "disease": "Bacterial Infection / Sepsis Risk",
        "conditions": {"wbc": ["high", "critical_high"]},
        "bonus": {"neutrophils": ["high"], "crp": ["high"], "esr": ["high"]},
        "base_confidence": 0.70,
        "recommendations": {
            "doctor": "Consult a physician promptly to rule out active infection.",
            "diet": ["Stay hydrated", "Avoid cold/raw foods if immune compromised"],
            "lifestyle": ["Rest", "Monitor for fever, chills, and swelling"],
            "warning": None,
        }
    },
    {
        "disease": "Possible Viral Infection / Immune Suppression",
        "conditions": {"wbc": ["low", "critical_low"]},
        "bonus": {"lymphocytes": ["low"]},
        "base_confidence": 0.65,
        "recommendations": {
            "doctor": "Consult a physician — low WBC may indicate viral illness or immune disorder.",
            "diet": ["Antioxidant-rich diet: berries, greens, nuts"],
            "lifestyle": ["Avoid crowded places", "Maintain hygiene to prevent secondary infections"],
            "warning": None,
        }
    },
    {
        "disease": "Dengue / Thrombocytopenia",
        "conditions": {"platelets": ["low", "critical_low"]},
        "bonus": {"wbc": ["low"]},
        "base_confidence": 0.65,
        "recommendations": {
            "doctor": "Consult doctor urgently if platelet count < 100,000.",
            "diet": ["Papaya leaf extract (may help platelet recovery)", "Pomegranate juice", "Avoid aspirin/NSAIDs"],
            "lifestyle": ["Complete rest", "Monitor for bruising or unusual bleeding"],
            "warning": "Low platelets: risk of bleeding — avoid physical trauma.",
        }
    },
    {
        "disease": "Type 2 Diabetes / Pre-Diabetes",
        "conditions": {"fasting_glucose": ["high", "critical_high"]},
        "bonus": {"hba1c": ["high"], "postprandial_glucose": ["high"]},
        "base_confidence": 0.75,
        "recommendations": {
            "doctor": "Consult an endocrinologist or diabetologist.",
            "diet": ["Low glycemic index foods", "Limit refined sugars and white rice",
                     "Increase fibre intake (vegetables, oats, legumes)"],
            "lifestyle": ["30 minutes of brisk walking daily",
                          "Maintain healthy weight",
                          "Monitor blood sugar regularly"],
            "warning": None,
        }
    },
    {
        "disease": "Hypoglycemia",
        "conditions": {"fasting_glucose": ["low", "critical_low"]},
        "bonus": {},
        "base_confidence": 0.80,
        "recommendations": {
            "doctor": "Consult a physician to rule out insulin overuse or metabolic disorder.",
            "diet": ["Small frequent meals", "Avoid prolonged fasting"],
            "lifestyle": ["Carry glucose tablets/snacks"],
            "warning": "Critically low blood sugar — risk of hypoglycemic episode.",
        }
    },
    {
        "disease": "Elevated HbA1c / Chronic Hyperglycemia",
        "conditions": {"hba1c": ["high", "critical_high"]},
        "bonus": {},
        "base_confidence": 0.80,
        "recommendations": {
            "doctor": "See a diabetologist — HbA1c suggests 3-month blood sugar elevation.",
            "diet": ["Strictly limit sugar, refined grains", "More vegetables, protein"],
            "lifestyle": ["Daily exercise", "Stress management"],
            "warning": None,
        }
    },
    {
        "disease": "Hypothyroidism",
        "conditions": {"tsh": ["high", "critical_high"]},
        "bonus": {"t3": ["low"], "t4": ["low"], "free_t4": ["low"]},
        "base_confidence": 0.75,
        "recommendations": {
            "doctor": "Consult an endocrinologist for thyroid function evaluation.",
            "diet": ["Iodine-rich foods: seafood, dairy, iodized salt",
                     "Brazil nuts (selenium)", "Avoid excessive raw goitrogenic foods"],
            "lifestyle": ["Regular exercise helps metabolism", "Screen for depression"],
            "warning": None,
        }
    },
    {
        "disease": "Hyperthyroidism",
        "conditions": {"tsh": ["low", "critical_low"]},
        "bonus": {"t3": ["high"], "t4": ["high"], "free_t4": ["high"]},
        "base_confidence": 0.75,
        "recommendations": {
            "doctor": "Urgent endocrinology consult — hyperthyroid risk.",
            "diet": ["Limit iodine intake", "Eat calcium-rich foods for bone protection"],
            "lifestyle": ["Beta blockers may help symptoms pending diagnosis",
                          "Avoid caffeine and stimulants"],
            "warning": None,
        }
    },
    {
        "disease": "Liver Disease / Hepatitis",
        "conditions": {"sgpt": ["high", "critical_high"]},
        "bonus": {"sgot": ["high"], "bilirubin_total": ["high"]},
        "base_confidence": 0.70,
        "recommendations": {
            "doctor": "Consult a gastroenterologist or hepatologist.",
            "diet": ["Avoid alcohol completely", "Low fat diet", "Adequate hydration",
                     "Turmeric in small amounts may help"],
            "lifestyle": ["Avoid hepatotoxic medications (e.g. NSAIDs) without advice",
                          "Monitor for jaundice"],
            "warning": None,
        }
    },
    {
        "disease": "Jaundice",
        "conditions": {"bilirubin_total": ["high", "critical_high"]},
        "bonus": {"bilirubin_direct": ["high"]},
        "base_confidence": 0.75,
        "recommendations": {
            "doctor": "Immediate consultation — bilirubin elevation may indicate liver or bile duct issues.",
            "diet": ["Light meals, easy to digest", "Avoid fatty and spicy foods"],
            "lifestyle": ["Rest", "Complete abstinence from alcohol"],
            "warning": "Critical bilirubin — risk of severe liver damage." if True else None,
        }
    },
    {
        "disease": "Chronic Kidney Disease",
        "conditions": {"creatinine": ["high", "critical_high"]},
        "bonus": {"urea": ["high"], "uric_acid": ["high"]},
        "base_confidence": 0.70,
        "recommendations": {
            "doctor": "Consult a nephrologist.",
            "diet": ["Low protein diet", "Low potassium and phosphorus foods",
                     "Limit salt intake"],
            "lifestyle": ["Stay hydrated", "Control blood pressure",
                          "Avoid NSAIDs and nephrotoxic drugs"],
            "warning": None,
        }
    },
    {
        "disease": "Dyslipidemia / Cardiovascular Risk",
        "conditions": {"total_cholesterol": ["high"]},
        "bonus": {"ldl": ["high"], "triglycerides": ["high"], "hdl": ["low"]},
        "base_confidence": 0.70,
        "recommendations": {
            "doctor": "Consult a cardiologist or physician for lipid-lowering therapy evaluation.",
            "diet": ["Avoid saturated fats and trans fats",
                     "Increase omega-3 (fish, walnuts, flaxseed)",
                     "Oats, beans, fruits for soluble fibre"],
            "lifestyle": ["30+ minutes aerobic exercise 5x/week",
                          "Quit smoking", "Maintain healthy weight"],
            "warning": None,
        }
    },
    {
        "disease": "High Triglycerides",
        "conditions": {"triglycerides": ["high", "critical_high"]},
        "bonus": {},
        "base_confidence": 0.75,
        "recommendations": {
            "doctor": "Cardiologist or physician consult recommended.",
            "diet": ["Avoid sugar, alcohol, refined carbs", "Increase omega-3 intake"],
            "lifestyle": ["Regular exercise", "Weight reduction"],
            "warning": None,
        }
    },
    {
        "disease": "Vitamin D Deficiency",
        "conditions": {"vitamin_d": ["low", "critical_low"]},
        "bonus": {},
        "base_confidence": 0.85,
        "recommendations": {
            "doctor": "Physician can prescribe Vitamin D3 supplementation.",
            "diet": ["Fatty fish (salmon, tuna)", "Fortified dairy/milk",
                     "Egg yolks", "Mushrooms exposed to sunlight"],
            "lifestyle": ["20–30 minutes of morning sunlight daily",
                          "Supplementation typically 60,000 IU/week for 8 weeks"],
            "warning": None,
        }
    },
    {
        "disease": "Vitamin B12 Deficiency / Megaloblastic Anemia",
        "conditions": {"vitamin_b12": ["low", "critical_low"]},
        "bonus": {},
        "base_confidence": 0.85,
        "recommendations": {
            "doctor": "Physician can prescribe B12 injections or supplements.",
            "diet": ["Meat, fish, dairy, eggs",
                     "Fortified plant-based milks for vegetarians"],
            "lifestyle": ["B12 injections are fast for severe deficiency"],
            "warning": None,
        }
    },
    {
        "disease": "Urinary Tract Infection (UTI)",
        "conditions": {"urine_wbc": ["high"]},
        "bonus": {"urine_rbc": ["high"]},
        "base_confidence": 0.65,
        "recommendations": {
            "doctor": "Consult a physician — urine culture recommended.",
            "diet": ["Increase water intake (2–3L/day)",
                     "Cranberry juice (unsweetened)",
                     "Avoid caffeine and alcohol"],
            "lifestyle": ["Maintain hygiene", "Urinate after intercourse",
                          "Avoid holding urination for prolonged periods"],
            "warning": None,
        }
    },
    {
        "disease": "Gout / Hyperuricemia",
        "conditions": {"uric_acid": ["high"]},
        "bonus": {},
        "base_confidence": 0.75,
        "recommendations": {
            "doctor": "Consult a physician or rheumatologist.",
            "diet": ["Avoid organ meats, shellfish, alcohol",
                     "Increase cherries, low-fat dairy",
                     "Drink 2+ litres of water daily"],
            "lifestyle": ["Avoid fasting or crash diets",
                          "Maintain healthy weight"],
            "warning": None,
        }
    },
    {
        "disease": "Electrolyte Imbalance",
        "conditions": {"sodium": ["low", "high", "critical_low", "critical_high"]},
        "bonus": {"potassium": ["low", "high", "critical_low", "critical_high"]},
        "base_confidence": 0.70,
        "recommendations": {
            "doctor": "Immediate physician evaluation for electrolyte abnormalities.",
            "diet": ["Oral rehydration if sodium is low", "Potassium-rich foods if low (banana, potato)"],
            "lifestyle": ["Avoid excessive fluid or salt restriction without guidance"],
            "warning": "Severe electrolyte imbalance can cause cardiac arrhythmia.",
        }
    },
]


# ─── PUBLIC FUNCTION ─────────────────────────────────────────────────────────

def predict_diseases(classified: dict) -> dict:
    """
    Match classified lab values against disease rules.

    Returns:
    {
      "predictions": [ { disease, confidence, contributing_tests, urgent } ],
      "recommendations": { doctor, diet, lifestyle, warning },
      "is_urgent": bool
    }
    """
    abnormal = {
        k: v for k, v in classified.items()
        if v.get("status") not in ("normal",)
    }

    matched: list[dict] = []

    for rule in DISEASE_RULES:
        # Check primary conditions
        cond_match = _check_conditions(rule["conditions"], classified)
        if not cond_match:
            continue

        # Count bonus conditions
        bonus_count = sum(
            1 for t, statuses in rule["bonus"].items()
            if t in classified and classified[t]["status"] in statuses
        )
        total_bonus = len(rule["bonus"])

        # Confidence: base + up to 0.30 from bonus
        bonus_boost = (bonus_count / total_bonus * 0.30) if total_bonus > 0 else 0.0
        confidence = min(0.97, round(rule["base_confidence"] + bonus_boost, 2))

        has_critical = any(
            classified.get(t, {}).get("is_critical", False)
            for t in rule["conditions"]
        )

        rec = rule["recommendations"]
        matched.append({
            "disease": rule["disease"],
            "confidence": confidence,
            "contributing_tests": list(rule["conditions"].keys()),
            "urgent": bool(rec.get("warning") or has_critical),
            "recommendations": {
                "doctor": rec["doctor"],
                "diet": rec.get("diet", []),
                "lifestyle": rec.get("lifestyle", []),
                "warning": rec.get("warning"),
            }
        })

    # Sort by confidence descending
    matched.sort(key=lambda x: x["confidence"], reverse=True)

    # Build merged top-level recommendations from top-3
    merged_recs = _merge_recommendations(matched[:3])

    return {
        "predictions": matched[:5],  # Return top 5
        "recommendations": merged_recs,
        "is_urgent": any(m["urgent"] for m in matched),
    }


def _check_conditions(conditions: dict, classified: dict) -> bool:
    """Return True only if ALL primary conditions are met."""
    for test_key, required_statuses in conditions.items():
        if test_key not in classified:
            return False
        actual_status = classified[test_key]["status"]
        # Multi-status: any of the required statuses is acceptable
        if actual_status not in required_statuses:
            return False
    return True


def _merge_recommendations(predictions: list) -> dict:
    """Merge recommendations from top predictions, deduplicated."""
    doctor_msgs = []
    diet_items = []
    lifestyle_items = []
    warnings = []

    for pred in predictions:
        rec = pred.get("recommendations", {})
        if rec.get("doctor") and rec["doctor"] not in doctor_msgs:
            doctor_msgs.append(rec["doctor"])
        for item in rec.get("diet", []):
            if item not in diet_items:
                diet_items.append(item)
        for item in rec.get("lifestyle", []):
            if item not in lifestyle_items:
                lifestyle_items.append(item)
        if rec.get("warning") and rec["warning"] not in warnings:
            warnings.append(rec["warning"])

    return {
        "doctor": doctor_msgs[0] if doctor_msgs else "Consult your physician with this report.",
        "all_doctor_notes": doctor_msgs,
        "diet": diet_items[:6],
        "lifestyle": lifestyle_items[:5],
        "warnings": warnings,
    }
