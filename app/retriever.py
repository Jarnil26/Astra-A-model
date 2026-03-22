import sqlite3
import json
import os
import numpy as np

class Retriever:
    def __init__(self, index_path="data/ayurveda.index", db_path="data/ayurveda_ai.db", model_name="BAAI/bge-small-en-v1.5"):
        print(f"📦 Initializing 'Lite' Clinical Retriever (FastEmbed + FAISS)...")
        import faiss
        from fastembed import TextEmbedding
        
        # 1. Load Model
        try:
            print(f"📦 Loading AI Model: {model_name}...")
            # FastEmbed automatic local caching
            self.model = TextEmbedding(model_name=model_name)
            self.dim = self.model.embedding_dimension
        except Exception as e:
            print(f"❌ Model load failed: {e}")
            self.model = None

        # 2. Load FAISS Index
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
        
        # If no symptoms, return a zero vector
        if not symptoms:
            return np.zeros(self.dim).astype('float32')

        vecs = []
        ws = []
        
        # Prepare symptoms for batch embedding and cache lookup
        symptoms_to_embed = []
        symptoms_map = {} # Map original index to symptom string
        
        for i, s in enumerate(symptoms):
            if s in self.embedding_cache:
                vecs.append(self.embedding_cache[s])
                ws.append(self.weights.get(s, 1.0))
            else:
                symptoms_to_embed.append(s)
                symptoms_map[s] = len(vecs) # Store where this symptom's embedding will go
                vecs.append(None) # Placeholder
                ws.append(None) # Placeholder

        # Embed new symptoms in a batch
        if symptoms_to_embed:
            # FastEmbed's embed method returns a generator of embeddings
            new_embeddings = list(self.model.embed(symptoms_to_embed))
            
            for s, emb in zip(symptoms_to_embed, new_embeddings):
                self.embedding_cache[s] = emb
                idx = symptoms_map[s]
                vecs[idx] = emb
                ws[idx] = self.weights.get(s, 1.0)
            
        # Filter out any None placeholders if something went wrong (shouldn't happen with this logic)
        vecs = [v for v in vecs if v is not None]
        ws = [w for w in ws if w is not None]

        if not vecs:
            return np.zeros(self.dim).astype('float32')
            
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
