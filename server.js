const express = require('express');
const cors = require('cors');
const { pipeline } = require('@xenova/transformers');
const engine = require('./clinical_engine');
const path = require('path');
const { createChatMiddleware, createSessionInfoHandler } = require('./middleware/filterLayer');
const uploadRouter = require('./routes/report');  // R0.0 — pure Node.js


const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));  // JSON body limit

// --- GLOBAL STATE & CACHE ---
let embedder = null;
let modelReady = false;
let startTime = Date.now();
let totalPredictions = 0;
let totalLatency = 0;
let cacheHits = 0;
const predictionCache = new Map();

async function initModel() {
    console.log("📦 Initializing Transformers.js (ONNX)...");
    try {
        // Use the same model name as Python (all-MiniLM-L6-v2)
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        modelReady = true;
        console.log("✅ Astra A0 Model Ready (Node.js)");
    } catch (err) {
        console.error("❌ Failed to load model:", err);
    }
}

async function getEmbedding(text) {
    if (!embedder) return new Array(384).fill(0);
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

app.get('/health', (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const avgLatency = totalPredictions > 0 ? (totalLatency / totalPredictions).toFixed(2) : 0;
    const cacheHitRate = totalPredictions > 0 ? ((cacheHits / totalPredictions) * 100).toFixed(2) : 0;

    res.json({
        status: modelReady ? "alive" : "initializing",
        uptime: uptimeSeconds,
        total_predictions: totalPredictions,
        avg_latency_ms: Number(avgLatency),
        cache_hit_rate_percent: Number(cacheHitRate),
        engine: {
            retriever_loaded: modelReady,
            predictor_loaded: true,
            db_size: engine.brain?.count || 0
        }
    });
});

app.post('/predict', async (req, res) => {
    const start = Date.now();
    const { symptoms } = req.body;
    
    if (!symptoms || !Array.isArray(symptoms)) {
        return res.status(400).json({ error: "Invalid symptoms format" });
    }

    if (!modelReady) {
        return res.status(503).json({ status: "error", message: "Engine initializing..." });
    }

    // --- CACHE CHECK ---
    const cacheKey = symptoms.map(s => s.toLowerCase().trim()).sort().join("|");
    if (predictionCache.has(cacheKey)) {
        const cached = predictionCache.get(cacheKey);
        totalPredictions++;
        cacheHits++;
        const latency = Date.now() - start;
        totalLatency += latency;
        return res.json({ 
            ...cached, 
            cache_hit: true, 
            inference_time_ms: latency 
        });
    }

    try {
        // 1. Convert symptoms to single search query
        const queryText = symptoms.join(" ");
        const queryEmbedding = await getEmbedding(queryText);

        // 2. Search & Aggregate using ClinicalEngine
        const retrievalResults = engine.search(queryEmbedding, 20); // Reduced top_k to 20
        const prediction = engine.aggregate(retrievalResults, symptoms);

        const latency = Date.now() - start;
        prediction.inference_time_ms = latency;
        prediction.cache_hit = false;
        
        // --- CACHE STORE ---
        if (prediction.predictions.length > 0) {
            predictionCache.set(cacheKey, prediction);
            // Limit cache size
            if (predictionCache.size > 1000) {
                const firstKey = predictionCache.keys().next().value;
                predictionCache.delete(firstKey);
            }
        }

        totalPredictions++;
        totalLatency += latency;
        
        console.log(`🩺 Predicted ${prediction.predictions[0]?.disease || 'None'} for [${symptoms}] in ${latency}ms`);
        res.json(prediction);
    } catch (err) {
        console.error("❌ Prediction Error:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

// --- MULTILINGUAL CLINICAL FILTER LAYER ---
// POST /chat — Conversational interface with multilingual support
const PREDICT_BASE = process.env.PREDICT_API_URL || `http://localhost:${PORT}`;
app.post('/chat', createChatMiddleware(PREDICT_BASE));

// GET /session/:sessionId — View session info (symptoms, history)
// GET /session — View all active sessions
app.get('/session/:sessionId?', createSessionInfoHandler());

// --- ASTRA R0.0 — REPORT UPLOAD ---
// POST /upload-report — Upload lab report for analysis
app.use('/upload-report', uploadRouter);

// Static: serve report.html at /report
app.get('/report', (req, res) => {
    res.sendFile(path.join(__dirname, 'report.html'));
});

// Static: serve chat.html at /chat-ui (backwards compat)
app.get('/chat-ui', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Astra A0  Node API   → port ${PORT}`);
    console.log(`💬 Chat      (A0.0)     → POST /chat`);
    console.log(`📋 Reports   (R0.0)     → POST /upload-report`);
    console.log(`🩺 Predict              → POST /predict`);
    console.log(`❤️  Health              → GET  /health`);
    initModel();
});
