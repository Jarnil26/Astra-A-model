from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import time
from app.db_loader import DBLoader
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Astra A0 Clinical API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    # Start loading in background immediately but don't wait for it
    DBLoader.load_in_background()
    print("-" * 50)

@app.get("/health")
async def health():
    uptime = time.time() - start_time
    avg_latency = stats["total_latency_ms"] / stats["total_predictions"] if stats["total_predictions"] > 0 else 0
    
    # Check engine status
    status = DBLoader.get_status()
    
    return {
        "status": "ready" if DBLoader.is_ready() else "initializing" if status["is_loading"] else "degraded",
        "engine": status,
        "uptime_seconds": round(uptime, 2),
        "total_predictions": stats["total_predictions"],
        "avg_response_time_ms": round(avg_latency, 2),
        "last_request_time": stats["last_request_time"]
    }

@app.post("/predict")
async def predict(request: PredictionRequest):
    req_start = time.time()
    
    # Fast check
    if not DBLoader.is_ready():
        status = DBLoader.get_status()
        return {
            "status": "error",
            "message": "Engine not ready.",
            "diagnostics": status,
            "instruction": "If DB or Index are False, you must upload or build them. If is_loading is True, wait 2 mins."
        }

    retriever = DBLoader.get_retriever()
    predictor = DBLoader.get_predictor()
    
    # 2. Inference
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
