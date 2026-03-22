from app.config import Config
from app.retriever import Retriever
from app.predictor import AdvancedPredictor

class DBLoader:
    _retriever = None
    _predictor = None

    @classmethod
    def get_retriever(cls):
        if cls._retriever is None:
            cls._retriever = Retriever(
                index_path=Config.INDEX_PATH,
                db_path=Config.DB_PATH,
                model_name=Config.MODEL_NAME
            )
        return cls._retriever

    @classmethod
    def get_predictor(cls):
        if cls._predictor is None:
            cls._predictor = AdvancedPredictor(
                db_path=Config.DB_PATH,
                prevalence_path=Config.PREVALENCE_PATH
            )
        return cls._predictor
