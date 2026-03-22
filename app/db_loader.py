from app.config import Config

class DBLoader:
    _retriever = None
    _predictor = None

    @classmethod
    def get_retriever(cls):
        if cls._retriever is None:
            from app.retriever import Retriever
            try:
                cls._retriever = Retriever(
                    index_path=Config.INDEX_PATH,
                    db_path=Config.DB_PATH,
                    model_name=Config.MODEL_NAME
                )
            except Exception as e:
                print(f"⚠️ Warning: Could not load Retriever: {e}")
                cls._retriever = None
        return cls._retriever

    @classmethod
    def get_predictor(cls):
        if cls._predictor is None:
            from app.predictor import AdvancedPredictor
            try:
                cls._predictor = AdvancedPredictor(
                    db_path=Config.DB_PATH,
                    prevalence_path=Config.PREVALENCE_PATH
                )
            except Exception as e:
                print(f"⚠️ Warning: Could not load Predictor: {e}")
                cls._predictor = None
        return cls._predictor
