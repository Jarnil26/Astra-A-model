import os

class Config:
    # Paths
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR = os.path.join(BASE_DIR, "data")
    
    DB_PATH = os.path.join(DATA_DIR, "ayurveda_ai.db")
    INDEX_PATH = os.path.join(DATA_DIR, "ayurveda.index")
    PREVALENCE_PATH = os.path.join(DATA_DIR, "disease_prevalence.json")
    
    # Model settings
    MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
    FAISS_NPROBE = 20
    RETRIEVAL_K = 30
    
    # API Settings
    RENDER_APP_URL = os.getenv("RENDER_EXTERNAL_URL", "http://localhost:10000")
    PORT = int(os.getenv("PORT", 10000))
