from app.config import Config
import os

class DBLoader:
    _retriever = None
    _predictor = None

    @classmethod
    def get_status(cls):
        return {
            "retriever_loaded": cls._retriever is not None,
            "predictor_loaded": cls._predictor is not None,
            "db_exists": os.path.exists(Config.DB_PATH),
            "index_exists": os.path.exists(Config.INDEX_PATH)
        }

    @classmethod
    def is_ready(cls):
        return cls._retriever is not None and cls._predictor is not None

    @classmethod
    def load_sync(cls):
        """Loads assets synchronously. Only used for small databases."""
        if cls.is_ready():
            return
            
        try:
            from app.retriever import Retriever
            from app.predictor import AdvancedPredictor
            
            if os.path.exists(Config.DB_PATH):
                print("📦 Loading Clinical Retriever...")
                cls._retriever = Retriever(
                    index_path=Config.INDEX_PATH,
                    db_path=Config.DB_PATH,
                    model_name=Config.MODEL_NAME
                )
                
                print("📦 Loading Clinical Predictor...")
                cls._predictor = AdvancedPredictor(
                    db_path=Config.DB_PATH,
                    prevalence_path=Config.PREVALENCE_PATH
                )
                print("✅ Engine Ready")
            else:
                print(f"⚠️ Critical assets missing at {Config.DB_PATH}")
        except Exception as e:
            print(f"❌ Synchronous Load Error: {e}")

    @classmethod
    def get_retriever(cls):
        return cls._retriever

    @classmethod
    def get_predictor(cls):
        return cls._predictor
