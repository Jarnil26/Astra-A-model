"""
Astra R0.0 — OCR Engine
Extracts text from:
  - Digital PDFs    → pdfplumber (fast, accurate)
  - Scanned PDFs    → PyMuPDF + pytesseract
  - Images (JPG/PNG)→ pytesseract with preprocessing
"""

import os
import re
import tempfile
import logging

logger = logging.getLogger(__name__)


# ─── OPTIONAL IMPORTS (graceful failures) ───────────────────────────────────

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    logger.warning("pdfplumber not installed — PDF text extraction limited")

try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False
    logger.warning("PyMuPDF not installed — scanned PDF fallback unavailable")

try:
    import pytesseract
    from PIL import Image, ImageFilter, ImageEnhance
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False
    logger.warning("pytesseract/Pillow not installed — OCR unavailable")


# ─── PUBLIC ENTRY POINT ─────────────────────────────────────────────────────

def extract_text(file_path: str) -> str:
    """
    Main entry point. Auto-detects file type and runs the right extractor.
    Returns raw text string.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return _extract_from_pdf(file_path)
    elif ext in (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"):
        return _extract_from_image(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


# ─── PDF EXTRACTION ─────────────────────────────────────────────────────────

def _extract_from_pdf(path: str) -> str:
    """Try pdfplumber first (digital); fall back to PyMuPDF+OCR for scans."""
    text = ""

    # --- Strategy 1: pdfplumber (fast for digital PDFs) ---
    if HAS_PDFPLUMBER:
        try:
            with pdfplumber.open(path) as pdf:
                pages = []
                for page in pdf.pages:
                    pt = page.extract_text()
                    if pt:
                        pages.append(pt)
                text = "\n".join(pages)
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}")

    # --- If we got meaningful text, return it ---
    if text and len(text.strip()) > 50:
        logger.info(f"pdfplumber extracted {len(text)} chars from {path}")
        return _clean_raw(text)

    # --- Strategy 2: PyMuPDF pixel rendering + pytesseract ---
    if HAS_FITZ and HAS_TESSERACT:
        try:
            text = _ocr_pdf_pages(path)
            logger.info(f"PyMuPDF+OCR extracted {len(text)} chars from {path}")
            return _clean_raw(text)
        except Exception as e:
            logger.error(f"PyMuPDF OCR failed: {e}")

    raise RuntimeError(
        "Could not extract text from PDF. "
        "Install pdfplumber or PyMuPDF+pytesseract."
    )


def _ocr_pdf_pages(path: str) -> str:
    """Render each PDF page as an image, then OCR it."""
    doc = fitz.open(path)
    texts = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        mat = fitz.Matrix(2.0, 2.0)  # 2x scale → 144 dpi
        pix = page.get_pixmap(matrix=mat)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = tmp.name
            pix.save(tmp_path)
        try:
            img = Image.open(tmp_path)
            img = _preprocess_image(img)
            text = pytesseract.image_to_string(
                img,
                config="--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,-:/%() "
            )
            texts.append(text)
        finally:
            os.unlink(tmp_path)
    doc.close()
    return "\n".join(texts)


# ─── IMAGE EXTRACTION ────────────────────────────────────────────────────────

def _extract_from_image(path: str) -> str:
    """Preprocess image and run pytesseract."""
    if not HAS_TESSERACT:
        raise RuntimeError("pytesseract not installed")

    img = Image.open(path)
    img = _preprocess_image(img)

    # Try multiple PSM modes and pick the one with more content
    configs = [
        "--oem 3 --psm 6",   # Uniform block of text (ideal for tables)
        "--oem 3 --psm 4",   # Single column
        "--oem 3 --psm 3",   # Auto (default)
    ]
    best_text = ""
    for cfg in configs:
        try:
            t = pytesseract.image_to_string(img, config=cfg)
            if len(t) > len(best_text):
                best_text = t
        except Exception as e:
            logger.warning(f"OCR config {cfg} failed: {e}")

    logger.info(f"OCR extracted {len(best_text)} chars from image {path}")
    return _clean_raw(best_text)


# ─── IMAGE PREPROCESSING ─────────────────────────────────────────────────────

def _preprocess_image(img: "Image.Image") -> "Image.Image":
    """Enhance image for better OCR accuracy."""
    # Convert to grayscale
    img = img.convert("L")

    # Upscale if too small
    w, h = img.size
    if w < 1200:
        scale = 1200 / w
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Sharpen and enhance contrast
    img = img.filter(ImageFilter.SHARPEN)
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2.0)

    return img


# ─── TEXT CLEANING ────────────────────────────────────────────────────────────

def _clean_raw(text: str) -> str:
    """Remove noise, fix common OCR artifacts, normalize spacing."""
    # Fix common OCR substitutions
    ocr_fixes = {
        r'\b0(?=[A-Za-z])': 'O',   # 0 → O before letters
        r'(?<=[A-Za-z])0\b': 'O',  # 0 → O after letters
        r'\bl\b': '1',             # standalone l → 1
        r'—': '-',
        r'–': '-',
        r'\.\.+': '.',
        r',,+': ',',
    }
    for pattern, replacement in ocr_fixes.items():
        text = re.sub(pattern, replacement, text)

    # Normalize whitespace but preserve newlines
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        line = re.sub(r'\s+', ' ', line).strip()
        if line:
            cleaned.append(line)

    # Remove lines that are obviously junk (less than 2 chars)
    cleaned = [l for l in cleaned if len(l) >= 2]

    return "\n".join(cleaned)
