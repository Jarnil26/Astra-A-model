# Astra A0: Production API

Highly optimized clinical reasoning engine built with FastAPI and FAISS.

## 🚀 Running Locally

1. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

2. **Start Server**:
```bash
python -m app.api
```

3. **Start Keep-Alive (Optional)**:
```bash
python health_pinger.py
```

## 📡 API Endpoints

### POST `/predict`
Request:
```json
{
  "symptoms": ["fever", "headache", "nausea"]
}
```

### GET `/health`
Returns system uptime and performance stats.

## 🚢 Deployment (Render)

1. Connect your GitHub repo to Render.
2. Select **Web Service**.
3. Environment: **Python 3**.
4. Build Command: `pip install -r requirements.txt`.
5. Start Command: `uvicorn app.api:app --host 0.0.0.0 --port 10000`.
6. Add Environment Variable: `RENDER_EXTERNAL_URL` with your service URL.

---
**Optimized for sub-200ms clinical inference.**
