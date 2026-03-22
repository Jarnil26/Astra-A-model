from app.config import Config
import threading

class DBLoader:
    _retriever = None
    _predictor = None
    _loading = False
    _lock = threading.Lock()

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
            
            print("📦 Initializing Retriever...")
            cls._retriever = Retriever(
                index_path=Config.INDEX_PATH,
                db_path=Config.DB_PATH,
                model_name=Config.MODEL_NAME
            )
            
            print("📦 Initializing Predictor...")
            cls._predictor = AdvancedPredictor(
                db_path=Config.DB_PATH,
                prevalence_path=Config.PREVALENCE_PATH
            )
            print("✅ Clinical Engine Loaded in Background")
        except Exception as e:
            print(f"❌ Critical error in background loader: {e}")
        finally:
            with cls._lock:
                cls._loading = False

    @classmethod
    def get_retriever(cls):
        return cls._retriever

    @classmethod
    def get_predictor(cls):
        return cls._predictor
