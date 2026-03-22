import numpy as np
import sqlite3
import json
import os

class Retriever:
    def __init__(self, index_path="data/ayurveda.index", db_path="data/ayurveda_ai.db", model_name="all-MiniLM-L6-v2"):
        import faiss
        import torch
        from sentence_transformers import SentenceTransformer
        
        # 1. Load Model (Approx 80MB for all-MiniLM-L6-v2)
        try:
            print(f"📦 Loading AI Model: {model_name}...")
            self.model = SentenceTransformer(model_name)
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model.to(self.device)
            self.dim = self.model.get_sentence_embedding_dimension()
        except Exception as e:
            print(f"❌ Model load failed: {e}")
            self.model = None

        # 2. Load FAISS Index (Attempt Memory-Mapped if possible, else standard)
        # Note: 534MB index on 512MB RAM is very risky.
        self.index = None
        if os.path.exists(index_path):
            try:
                print(f"📦 Loading FAISS Index: {index_path}...")
                # We try standard load first; Render might kill if it exceeds 512MB
                self.index = faiss.read_index(index_path)
                self.index.nprobe = 20
                print("✅ FAISS Index Loaded Into RAM")
            except Exception as e:
                print(f"⚠️ FAISS Load Failed (likely OOM): {e}. Falling back to Keyword mode.")
                self.index = None

        self.db_path = db_path
        
        # 3. Persistent SQLite Connection
        try:
            self.conn = sqlite3.connect(db_path, check_same_thread=False)
            self.weights = self._load_weights()
        except Exception as e:
            print(f"❌ DB connection failed: {e}")
            self.conn = None
            self.weights = {}

        # 4. Embedding Cache
        self.embedding_cache = {}

    def _load_weights(self):
        if not self.conn: return {}
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT symptom, count FROM symptom_freqs")
            freqs = dict(cursor.fetchall())
            return {s: 1.0 / np.log1p(count) for s, count in freqs.items()}
        except:
            return {}

    def get_query_embedding(self, symptoms):
        if not self.model: return np.zeros(384)
        
        symptoms = [s.strip().lower() for s in symptoms]
        vecs = []
        ws = []
        
        for s in symptoms:
            if s in self.embedding_cache:
                emb = self.embedding_cache[s]
            else:
                emb = self.model.encode([s], convert_to_numpy=True)[0]
                self.embedding_cache[s] = emb
            
            w = self.weights.get(s, 1.0)
            vecs.append(emb)
            ws.append(w)
            
        if not vecs:
            return np.zeros(self.dim)
            
        vecs = np.array(vecs)
        ws = np.array(ws).reshape(-1, 1)
        weighted_vec = np.sum(vecs * ws, axis=0) / np.sum(ws)
        
        norm = np.linalg.norm(weighted_vec)
        if norm > 0: weighted_vec /= norm
        return weighted_vec.astype('float32')

    def retrieve(self, symptoms, k=30):
        # FALLBACK: If Index is missing or failed (OOM), use Keyword Search
        if self.index is None:
            return self._keyword_retrieve(symptoms, k)

        query_vec = self.get_query_embedding(symptoms).reshape(1, -1)
        similarities, indices = self.index.search(query_vec, k)
        
        results = []
        cursor = self.conn.cursor()
        for sim, idx in zip(similarities[0], indices[0]):
            if idx == -1 or sim < 0.3: continue
            cursor.execute("SELECT data FROM records WHERE id = ?", (int(idx) + 1,))
            row = cursor.fetchone()
            if row:
                results.append({"record": json.loads(row[0]), "similarity": float(sim)})
        return results

    def _keyword_retrieve(self, symptoms, k=30):
        """Lite fallback retrieval using SQL LIKE for low-memory environments."""
        if not self.conn: return []
        print("💡 Using Keyword Fallback Mode (Lite)")
        
        results = []
        cursor = self.conn.cursor()
        
        # Simple heuristic: find records matching at least one symptom
        # In a real 22M record DB, this might be slow, so we limit search
        for s in symptoms[:3]: # Limit to first 3 symptoms for speed
            cursor.execute("SELECT data FROM records WHERE data LIKE ? LIMIT ?", (f'%{s}%', k))
            rows = cursor.fetchall()
            for row in rows:
                results.append({"record": json.loads(row[0]), "similarity": 0.5}) # Static sim
                if len(results) >= k: break
            if len(results) >= k: break
        
        return results

    def close(self):
        if self.conn: self.conn.close()
