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
            # Check if we need to build the database from source
            db_missing = not os.path.exists(Config.DB_PATH)
            index_missing = not os.path.exists(Config.INDEX_PATH)
            
            if db_missing or index_missing:
                print("🛠️ Clinical data missing. Running Direct Bootstrap (Pass 1-4)...")
                try:
                    # PASS 1: Stream JSON to SQLite
                    from data_streamer import DataStreamer
                    dataset = os.path.join(Config.DATA_DIR, "AyurGenixAI_Dataset.json")
                    if os.path.exists(dataset):
                        streamer = DataStreamer(dataset, Config.DB_PATH)
                        streamer.stream_and_index()
                        streamer.close()
                    else:
                        print(f"❌ Source dataset missing at {dataset}")
                    
                    # PASS 2: Generate Embedding Chunks
                    from embedding_builder import EmbeddingBuilder
                    eb = EmbeddingBuilder(Config.DB_PATH, Config.MODEL_NAME)
                    eb.build_embeddings(output_dir=os.path.join(Config.DATA_DIR, "embeddings"))
                    
                    # PASS 3: Build FAISS Index
                    from faiss_index_builder import FAISSIndexBuilder
                    fib = FAISSIndexBuilder(
                        embedding_dir=os.path.join(Config.DATA_DIR, "embeddings"),
                        index_path=Config.INDEX_PATH
                    )
                    fib.build_index()
                    
                    # PASS 4: Prevalence Matrix
                    from prevalence_builder import PrevalenceManager
                    pm = PrevalenceManager(Config.DB_PATH, Config.PREVALENCE_PATH)
                    pm.build_matrix()
                    
                    print("✅ Direct Bootstrap Complete")
                    
                except Exception as build_err:
                    print(f"❌ Direct Bootstrap failed: {build_err}")
            
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
            print("✅ Engine Fully Loaded & Ready")
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
