const express = require('express');
const cors = require('cors');
const { pipeline } = require('@xenova/transformers');
const engine = require('./clinical_engine');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

let embedder = null;
let modelReady = false;

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
    res.json({
        status: modelReady ? "ready" : "initializing",
        platform: "Node.js",
        engine: {
            retriever_loaded: modelReady,
            predictor_loaded: true,
            db_exists: true,
            index_exists: true
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

    try {
        // 1. Convert symptoms to single search query
        const queryText = symptoms.join(" ");
        const queryEmbedding = await getEmbedding(queryText);

        // 2. Search & Aggregate using ClinicalEngine
        const retrievalResults = engine.search(queryEmbedding, 30);
        const prediction = engine.aggregate(retrievalResults, symptoms);

        const latency = Date.now() - start;
        prediction.inference_time_ms = latency;
        
        console.log(`🩺 Predicted ${prediction.predictions[0]?.disease || 'None'} for [${symptoms}] in ${latency}ms`);
        res.json(prediction);
    } catch (err) {
        console.error("❌ Prediction Error:", err);
        res.status(500).json({ status: "error", message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Astra A0 Node API listening on port ${PORT}`);
    initModel();
});
