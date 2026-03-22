import os

class Config:
    # Paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR = os.path.join(BASE_DIR, "data")
    
    DB_PATH = os.path.join(DATA_DIR, "ayurveda_ai.db")
    INDEX_PATH = os.path.join(DATA_DIR, "ayurveda.index")
    PREVALENCE_PATH = os.path.join(DATA_DIR, "disease_prevalence.json")
    
    # Model settings
    # Switching to 'all-MiniLM-L6-v2' (~80MB)    # Model Configuration (Memory Optimized for 512MB RAM)
    # Using 'BAAI/bge-small-en-v1.5' via FastEmbed (ONNX)
    MODEL_NAME = "BAAI/bge-small-en-v1.5"
    FAISS_NPROBE = 20
    RETRIEVAL_K = 30
    
    # OS Environment Tweak to prevent OOM
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    
    # API Settings
    RENDER_APP_URL = os.getenv("RENDER_EXTERNAL_URL", "http://localhost:10000")
    PORT = int(os.getenv("PORT", 10000))
