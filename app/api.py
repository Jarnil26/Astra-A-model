from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import time
from app.db_loader import DBLoader
import uvicorn

app = FastAPI(title="Astra A0 Clinical API")

# Global Stats
start_time = time.time()
stats = {
    "total_predictions": 0,
    "total_latency_ms": 0,
    "last_request_time": None
}

class PredictionRequest(BaseModel):
    symptoms: list[str]

@app.on_event("startup")
async def startup_event():
    print("-" * 50)
    print("🚀 Astra A0 API: Starting Listener...")
    print("Engine will load lazily on first request to prevent port timeout.")
    print("-" * 50)

@app.get("/health")
async def health():
    uptime = time.time() - start_time
    avg_latency = stats["total_latency_ms"] / stats["total_predictions"] if stats["total_predictions"] > 0 else 0
    
    # Check engine status
    engine_ready = DBLoader.get_retriever() is not None and DBLoader.get_predictor() is not None
    
    return {
        "status": "alive" if engine_ready else "degraded",
        "engine_ready": engine_ready,
        "uptime_seconds": round(uptime, 2),
        "total_predictions": stats["total_predictions"],
        "avg_response_time_ms": round(avg_latency, 2),
        "last_request_time": stats["last_request_time"]
    }

@app.post("/predict")
async def predict(request: PredictionRequest):
    req_start = time.time()
    
    # 1. Access Singletons
    retriever = DBLoader.get_retriever()
    predictor = DBLoader.get_predictor()
    
    if not retriever or not predictor:
        return {
            "status": "error",
            "message": "Clinical engine not initialized. Large data assets (.db, .index) are missing from the environment."
        }
    retrieval_results = retriever.retrieve(request.symptoms, k=30)
    prediction = predictor.aggregate(retrieval_results, request.symptoms)
    
    # 3. Stats Update
    latency = (time.time() - req_start) * 1000
    stats["total_predictions"] += 1
    stats["total_latency_ms"] += latency
    stats["last_request_time"] = time.ctime()
    
    prediction["inference_time_ms"] = round(latency, 2)
    return prediction

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=10000)
