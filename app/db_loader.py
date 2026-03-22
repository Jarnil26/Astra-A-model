from app.config import Config
import threading
import os

class DBLoader:
    _retriever = None
    _predictor = None
    _loading = False
    _lock = threading.Lock()

    @classmethod
    def get_status(cls):
        return {
            "retriever_loaded": cls._retriever is not None,
            "predictor_loaded": cls._predictor is not None,
            "is_loading": cls._loading,
            "db_exists": os.path.exists(Config.DB_PATH),
            "index_exists": os.path.exists(Config.INDEX_PATH)
        }

    @classmethod
    def is_ready(cls):
        return cls._retriever is not None and cls._predictor is not None

    @classmethod
    def load_in_background(cls):
        """Kicks off the loader in a separate thread if not already running."""
        with cls._lock:
            if cls._loading or cls.is_ready():
                return
            cls._loading = True
            
        thread = threading.Thread(target=cls._perform_load)
        thread.daemon = True
        thread.start()
        print("🧵 Background Loader Thread Started")

    @classmethod
    def _perform_load(cls):
        try:
            from app.retriever import Retriever
            from app.predictor import AdvancedPredictor
            
            print(f"📦 DB State: DB={os.path.exists(Config.DB_PATH)}, Index={os.path.exists(Config.INDEX_PATH)}")
            
            print("📦 Phase 1: Initializing Retriever...")
            cls._retriever = Retriever(
                index_path=Config.INDEX_PATH,
                db_path=Config.DB_PATH,
                model_name=Config.MODEL_NAME
            )
            
            print("📦 Phase 2: Initializing Predictor...")
            cls._predictor = AdvancedPredictor(
                db_path=Config.DB_PATH,
                prevalence_path=Config.PREVALENCE_PATH
            )
            print("✅ Engine Fully Loaded")
        except Exception as e:
            print(f"❌ Background Loader Error: {e}")
        finally:
            with cls._lock:
                cls._loading = False

    @classmethod
    def get_retriever(cls):
        return cls._retriever

    @classmethod
    def get_predictor(cls):
        return cls._predictor
