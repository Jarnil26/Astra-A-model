"""
Astra R0.0 — FastAPI Microservice
POST /analyze  →  full analysis pipeline
GET  /health   →  service health check
"""

import os
import time
import logging
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile
import shutil

from ocr import extract_text
from extractor import extract_patient_info, extract_lab_values
from normalizer import classify_values
from predictor import predict_diseases

# ─── SETUP ───────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Astra R0.0 — Clinical Report Engine",
    version="1.0.0",
    description="Analyze uploaded medical reports and return structured clinical insights"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_start_time = time.time()
_total_analyzed = 0


# ─── HEALTH ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "alive",
        "service": "Astra R0.0 Report Engine",
        "uptime_seconds": round(time.time() - _start_time),
        "total_analyzed": _total_analyzed,
    }


# ─── MAIN ENDPOINT ───────────────────────────────────────────────────────────

@app.post("/analyze")
async def analyze_report(
    file: UploadFile = File(...),
    gender: str = Form(default=""),
    age: str = Form(default=""),
):
    """
    Full pipeline: OCR → Extract → Normalize → Predict.
    Accepts multipart file + optional gender/age hints.
    """
    global _total_analyzed
    start = time.time()

    # Validate MIME
    allowed_mimes = {
        "application/pdf", "image/jpeg", "image/jpg",
        "image/png", "image/bmp", "image/tiff", "image/webp"
    }
    if file.content_type not in allowed_mimes:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. "
                   "Please upload PDF or image (JPG/PNG)."
        )

    # Save to temp file
    suffix = os.path.splitext(file.filename or "report.pdf")[1].lower() or ".pdf"
    tmp_file = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_file = tmp.name

        # ── Step 1: OCR ──────────────────
        logger.info(f"[R0] Extracting text from {file.filename}")
        try:
            raw_text = extract_text(tmp_file)
        except Exception as e:
            logger.error(f"OCR failed: {e}")
            raise HTTPException(
                status_code=422,
                detail=f"Could not extract text from file: {str(e)}"
            )

        if not raw_text or len(raw_text.strip()) < 10:
            raise HTTPException(
                status_code=422,
                detail="No readable text found in the uploaded file. "
                       "Please ensure the report is clear and not heavily handwritten."
            )

        # ── Step 2: Extract ────────────────
        patient_info = extract_patient_info(raw_text)

        # If user provided hints, prefer them
        if gender:
            patient_info["gender"] = gender.lower()
        if age:
            try:
                patient_info["age"] = int(age)
            except ValueError:
                pass

        lab_values = extract_lab_values(raw_text)
        logger.info(f"[R0] Extracted {len(lab_values)} lab values")

        if not lab_values:
            raise HTTPException(
                status_code=422,
                detail="No lab values could be extracted. "
                       "The report may be handwritten, low quality, or not a lab report."
            )

        # ── Step 3: Normalize ──────────────
        classified = classify_values(lab_values, patient_info)

        # ── Step 4: Predict ────────────────
        prediction_result = predict_diseases(classified)

        # ── Build Response ─────────────────
        abnormalities = [
            {
                "test": key,
                "display_name": val["original_name"],
                "value": val["value"],
                "unit": val["unit"],
                "status": val["status"],
                "reference_range": val["reference_range"],
                "deviation_pct": val.get("deviation_pct"),
                "is_critical": val.get("is_critical", False),
            }
            for key, val in classified.items()
            if val["status"] != "normal"
        ]

        normal_tests = [
            {
                "test": key,
                "display_name": val["original_name"],
                "value": val["value"],
                "unit": val["unit"],
                "status": "normal",
                "reference_range": val["reference_range"],
            }
            for key, val in classified.items()
            if val["status"] == "normal"
        ]

        elapsed = round(time.time() - start, 2)
        _total_analyzed += 1

        response = {
            "patient": patient_info,
            "raw_text_length": len(raw_text),
            "tests_detected": len(lab_values),
            "abnormalities": abnormalities,
            "normal_tests": normal_tests,
            "predictions": prediction_result["predictions"],
            "recommendations": prediction_result["recommendations"],
            "is_urgent": prediction_result["is_urgent"],
            "processing_time_s": elapsed,
            "engine": "Astra R0.0",
        }

        logger.info(
            f"[R0] Done: {len(abnormalities)} abnormal, "
            f"{len(prediction_result['predictions'])} predictions in {elapsed}s"
        )
        return response

    finally:
        if tmp_file and os.path.exists(tmp_file):
            os.unlink(tmp_file)


# ─── ENTRY ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("REPORT_ENGINE_PORT", 8001))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False, log_level="info")
