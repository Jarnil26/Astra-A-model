"""
Astra R0.0 — Text Extractor
Parses raw OCR text into:
  - patient_info: name, age, gender, report_id, date
  - lab_values:   { test_name: { value, unit, raw_text } }

Strategy:
  1. Line-by-line scan with regex patterns for each field type
  2. Table-aware: detect "test | value | unit | reference" rows
  3. Fuzzy alias resolution via lab_ranges.json
"""

import re
import json
import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ─── LOAD ALIAS MAP ──────────────────────────────────────────────────────────

_RANGES_PATH = os.path.join(os.path.dirname(__file__), "lab_ranges.json")
with open(_RANGES_PATH, "r", encoding="utf-8") as f:
    _RANGES_DATA = json.load(f)

# Build alias → canonical_key map
_ALIAS_MAP: dict[str, str] = {}
for key, info in _RANGES_DATA["tests"].items():
    _ALIAS_MAP[key.lower()] = key
    _ALIAS_MAP[key.lower().replace("_", " ")] = key
    for alias in info.get("aliases", []):
        _ALIAS_MAP[alias.lower()] = key


# ─── REGEX PATTERNS ──────────────────────────────────────────────────────────

_PATTERNS = {
    "name": [
        r"(?:patient\s*name|name\s*of\s*patient|patient)[:\s]+([A-Za-z\s\.]+)",
        r"^Name[:\s]+([A-Za-z\s\.]+)$",
    ],
    "age": [
        r"(?:age|patient\s*age)[:\s]+(\d{1,3})\s*(?:years?|yrs?|Y)?",
        r"\b(\d{1,3})\s*(?:years?|yrs?)\s*(?:old)?",
    ],
    "gender": [
        r"(?:sex|gender)[:\s]+(male|female|m\b|f\b)",
    ],
    "report_id": [
        r"(?:report\s*(?:id|no|number)|lab\s*id|sample\s*id)[:\s#]*([A-Z0-9\-]+)",
        r"(?:ref|ref\. no|reference)[:\s]+([A-Z0-9\-]+)",
    ],
    "date": [
        r"(?:date|report\s*date|collected\s*on|tested\s*on)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b",
    ],
}

# Lab value line pattern:  <test_name>  <value>  <unit>   (with optional ref range)
_LAB_LINE_RE = re.compile(
    r"^(?P<test>[A-Za-z][A-Za-z0-9\s\(\)\.\-\/]+?)"   # test name (greedy but lazy)
    r"\s*[:\|]?\s*"                                      # separator
    r"(?P<value>[\d]+(?:\.\d+)?)"                        # numeric value
    r"\s*"
    r"(?P<unit>[A-Za-z\/µ%µg\^0-9\s\*\.]*?)"            # unit (optional)
    r"\s*(?:[\d\.\-–]+\s*[\-–]\s*[\d\.]+)?$",           # optional ref range at end
    re.IGNORECASE
)

# Categorical lab result (e.g. "Urine Protein : Negative")
_CATEGORICAL_RE = re.compile(
    r"^(?P<test>[A-Za-z][A-Za-z0-9\s\(\)\.\-\/]+?)"
    r"\s*[:\|]\s*"
    r"(?P<value>negative|positive|trace|absent|present|nil)",
    re.IGNORECASE
)


# ─── PUBLIC FUNCTIONS ────────────────────────────────────────────────────────

def extract_patient_info(text: str) -> dict:
    """Extract patient metadata fields from text."""
    info = {
        "name": None,
        "age": None,
        "gender": None,
        "report_id": None,
        "date": None,
    }

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        for field, patterns in _PATTERNS.items():
            if info[field]:
                continue
            for pat in patterns:
                m = re.search(pat, line, re.IGNORECASE)
                if m:
                    raw = m.group(1).strip()
                    if field == "gender":
                        raw = "male" if raw.lower().startswith("m") else "female"
                    elif field == "age":
                        raw = int(raw)
                    info[field] = raw
                    break

    return info


def extract_lab_values(text: str) -> dict:
    """
    Parse all lab test values from text.
    Returns: { canonical_key: { value, unit, raw_text, original_name } }
    """
    results = {}
    lines = text.split("\n")

    for raw_line in lines:
        line = raw_line.strip()
        if len(line) < 4:
            continue

        # Try categorical (Negative/Positive etc.)
        cat_match = _CATEGORICAL_RE.match(line)
        if cat_match:
            test_raw = cat_match.group("test").strip()
            value_raw = cat_match.group("value").strip().lower()
            canonical = _resolve_alias(test_raw)
            if canonical:
                results[canonical] = {
                    "value": value_raw,
                    "unit": "",
                    "raw_text": line,
                    "original_name": test_raw,
                    "is_categorical": True,
                }
            continue

        # Try numeric lab value
        num_match = _LAB_LINE_RE.match(line)
        if num_match:
            test_raw = num_match.group("test").strip()
            value_raw = num_match.group("value").strip()
            unit_raw = num_match.group("unit").strip()

            canonical = _resolve_alias(test_raw)
            if canonical:
                try:
                    val = float(value_raw)
                except ValueError:
                    continue

                results[canonical] = {
                    "value": val,
                    "unit": unit_raw or _RANGES_DATA["tests"][canonical].get("unit", ""),
                    "raw_text": line,
                    "original_name": test_raw,
                    "is_categorical": False,
                }

    return results


def _resolve_alias(raw_name: str) -> str | None:
    """
    Given a raw lab test name, resolve it to a canonical key.
    Uses exact → stripped → partial matching.
    """
    cleaned = raw_name.lower().strip()

    # Exact match
    if cleaned in _ALIAS_MAP:
        return _ALIAS_MAP[cleaned]

    # Remove trailing punctuation / noise
    stripped = re.sub(r"[^a-z0-9\s]", "", cleaned).strip()
    if stripped in _ALIAS_MAP:
        return _ALIAS_MAP[stripped]

    # Partial / substring match (for multi-word names)
    for alias, key in _ALIAS_MAP.items():
        if alias in stripped or stripped in alias:
            if len(stripped) >= 3:
                return key

    return None
