"""
Astra R0.0 — Value Normalizer
Compares extracted lab values against reference ranges from lab_ranges.json.
Classifies each result as: normal | low | high | critical_low | critical_high
"""

import json
import os
import logging

logger = logging.getLogger(__name__)

_RANGES_PATH = os.path.join(os.path.dirname(__file__), "lab_ranges.json")
with open(_RANGES_PATH, "r", encoding="utf-8") as f:
    _RANGES_DATA = json.load(f)


def classify_values(
    lab_values: dict,
    patient_info: dict | None = None
) -> dict:
    """
    For each extracted lab value, compute status and deviation.

    Returns dict:
    {
      canonical_key: {
        value, unit, status, reference_range,
        deviation_pct, is_critical, original_name
      }
    }
    """
    gender = (patient_info or {}).get("gender", "").lower()
    age = (patient_info or {}).get("age", None)
    is_child = isinstance(age, int) and age < 14

    classified = {}

    for key, data in lab_values.items():
        if key not in _RANGES_DATA["tests"]:
            continue

        ref = _RANGES_DATA["tests"][key]
        value = data["value"]
        original = data.get("original_name", key)
        unit = data.get("unit", ref.get("unit", ""))

        # --- Categorical values (negative/positive) ---
        if data.get("is_categorical"):
            expected = ref.get("default", {}).get("expected", "negative")
            allowed = ref.get("default", {}).get("allowed", ["negative"])
            status = "normal" if str(value).lower() in [a.lower() for a in allowed] else "high"
            classified[key] = {
                "value": value,
                "unit": unit,
                "status": status,
                "reference_range": f"Expected: {expected}",
                "deviation_pct": None,
                "is_critical": status == "high",
                "original_name": original,
            }
            continue

        # --- Numeric values ---
        # Pick the right range based on gender / age
        range_entry = _pick_range(ref, gender, is_child)

        if not range_entry or "min" not in range_entry:
            continue

        low = range_entry["min"]
        high = range_entry["max"]
        crit_low = ref.get("critical_low", None)
        crit_high = ref.get("critical_high", None)

        # Classify
        if crit_low is not None and value < crit_low:
            status = "critical_low"
            is_critical = True
        elif crit_high is not None and value > crit_high:
            status = "critical_high"
            is_critical = True
        elif value < low:
            status = "low"
            is_critical = False
        elif value > high:
            status = "high"
            is_critical = False
        else:
            status = "normal"
            is_critical = False

        # Deviation percentage
        if status in ("low", "critical_low"):
            deviation_pct = round(((low - value) / low) * 100, 1) if low > 0 else None
        elif status in ("high", "critical_high"):
            deviation_pct = round(((value - high) / high) * 100, 1) if high > 0 else None
        else:
            deviation_pct = 0.0

        classified[key] = {
            "value": value,
            "unit": unit,
            "status": status,
            "reference_range": f"{low} – {high} {unit}".strip(),
            "deviation_pct": deviation_pct,
            "is_critical": is_critical,
            "original_name": original,
        }

    return classified


def _pick_range(ref: dict, gender: str, is_child: bool) -> dict | None:
    """Pick the most appropriate sub-range from a test definition."""
    if is_child and "child" in ref:
        return ref["child"]
    if gender == "female" and "female" in ref:
        return ref["female"]
    if gender == "male" and "male" in ref:
        return ref["male"]
    return ref.get("default", None)
