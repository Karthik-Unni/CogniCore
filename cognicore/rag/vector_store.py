import sqlite3
import json
import math
import logging
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger("cognicore.rag")

class SQLiteVectorStore:
    """
    SQLite-backed Vector Store.
    Implements:
    - Pure-Python TF-IDF cosine similarity for local offline runs.
    - Floating-point vector cosine similarity for API-based runs (OpenAI/Gemini).
    """
    def __init__(self, db_path: str = "cognicore_memories.db", llm_client: Optional[Any] = None):
        self.db_path = db_path
        self.llm_client = llm_client
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    agent_id TEXT,
                    content TEXT,
                    importance INTEGER,
                    emotional_impact TEXT,
                    timestamp REAL,
                    tags TEXT,
                    embedding TEXT,
                    metadata TEXT
                )
            """)
            conn.commit()

    def _tokenize(self, text: str) -> List[str]:
        # Simple clean tokenization
        text = text.lower()
        text = re.sub(r"[^\w\s]", "", text)
        return [w for w in text.split() if len(w) > 2]

    def _compute_tfidf_similarity(self, agent_id: str, query: str, memories: List[Dict[str, Any]]) -> List[float]:
        """
        Pure Python TF-IDF cosine similarity between query and memory documents.
        """
        if not memories:
            return []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return [0.0] * len(memories)

        # 1. Gather all documents and count term frequencies
        docs_tokens = [self._tokenize(m["content"]) for m in memories]
        
        # 2. Compute Document Frequency (DF) for each term
        df = {}
        all_vocab = set(query_tokens)
        for tokens in docs_tokens:
            all_vocab.update(tokens)
            for term in set(tokens):
                df[term] = df.get(term, 0) + 1
        
        # 3. Compute Inverse Document Frequency (IDF)
        num_docs = len(memories)
        idf = {}
        for term in all_vocab:
            # Add-one smoothing to avoid division by zero
            term_df = df.get(term, 0)
            idf[term] = math.log((1 + num_docs) / (1 + term_df)) + 1

        # 4. Vectorize query
        query_tf = {}
        for t in query_tokens:
            query_tf[t] = query_tf.get(t, 0) + 1
        
        query_vector = {}
        query_magnitude_sq = 0.0
        for t, tf in query_tf.items():
            query_vector[t] = tf * idf.get(t, 0.0)
            query_magnitude_sq += query_vector[t] ** 2
        query_magnitude = math.sqrt(query_magnitude_sq)

        if query_magnitude == 0.0:
            return [0.0] * len(memories)

        # 5. Vectorize documents and compute cosine similarity
        scores = []
        for doc_tokens in docs_tokens:
            doc_tf = {}
            for t in doc_tokens:
                doc_tf[t] = doc_tf.get(t, 0) + 1
            
            dot_product = 0.0
            doc_magnitude_sq = 0.0
            for t, tf in doc_tf.items():
                val = tf * idf.get(t, 0.0)
                doc_magnitude_sq += val ** 2
                if t in query_vector:
                    dot_product += val * query_vector[t]
            
            doc_magnitude = math.sqrt(doc_magnitude_sq)
            if doc_magnitude == 0.0:
                scores.append(0.0)
            else:
                scores.append(dot_product / (query_magnitude * doc_magnitude))
        
        return scores

    def _get_api_embedding(self, text: str) -> Optional[List[float]]:
        """
        Retrieves float embedding vector from active LLM provider if supported and key is active.
        """
        if not self.llm_client or self.llm_client.provider == "mock":
            return None
            
        try:
            if self.llm_client.provider == "openai":
                response = self.llm_client.client.embeddings.create(
                    model="text-embedding-3-small",
                    input=[text]
                )
                return response.data[0].embedding
            elif self.llm_client.provider == "gemini":
                # google-generativeai embeddings
                result = self.llm_client.client.embed_content(
                    model="models/text-embedding-004",
                    content=text
                )
                return result["embedding"][0]
        except Exception as e:
            logger.warning(f"Failed to fetch API embedding: {str(e)}. Falling back to TF-IDF text search.")
        return None

    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        dot = sum(a * b for a, b in zip(v1, v2))
        mag1 = math.sqrt(sum(a * a for a in v1))
        mag2 = math.sqrt(sum(b * b for b in v2))
        if mag1 == 0 or mag2 == 0:
            return 0.0
        return dot / (mag1 * mag2)

    def add_memory(self, memory_id: str, agent_id: str, content: str, importance: int, 
                   emotional_impact: Dict[str, float], timestamp: float, 
                   tags: List[str], metadata: Optional[Dict[str, Any]] = None):
        """
        Add a memory document to SQLite.
        """
        embedding = None
        # Try getting real vector embedding from active API
        embedding_list = self._get_api_embedding(content)
        if embedding_list:
            embedding = json.dumps(embedding_list)

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO memories 
                (id, agent_id, content, importance, emotional_impact, timestamp, tags, embedding, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                memory_id,
                agent_id,
                content,
                importance,
                json.dumps(emotional_impact),
                timestamp,
                json.dumps(tags),
                embedding,
                json.dumps(metadata or {})
            ))
            conn.commit()

    def query_memories(self, agent_id: str, query_text: str, k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieve top k relevant memories for the agent.
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM memories WHERE agent_id = ?", (agent_id,)
            )
            rows = cursor.fetchall()

        if not rows:
            return []

        # Convert SQLite rows to list of dictionaries
        memories = []
        for r in rows:
            memories.append({
                "id": r["id"],
                "agent_id": r["agent_id"],
                "content": r["content"],
                "importance": r["importance"],
                "emotional_impact": json.loads(r["emotional_impact"]),
                "timestamp": r["timestamp"],
                "tags": json.loads(r["tags"]),
                "embedding": json.loads(r["embedding"]) if r["embedding"] else None,
                "metadata": json.loads(r["metadata"])
            })

        # Calculate scores
        query_emb = self._get_api_embedding(query_text)

        # If query embedding and all DB embeddings exist, do vector cosine similarity
        if query_emb and all(m["embedding"] is not None for m in memories):
            for m in memories:
                m["score"] = self._cosine_similarity(query_emb, m["embedding"])
        else:
            # Fallback to pure TF-IDF similarity
            scores = self._compute_tfidf_similarity(agent_id, query_text, memories)
            for m, score in zip(memories, scores):
                m["score"] = score

        # Sort by similarity score descending
        memories.sort(key=lambda x: x["score"], reverse=True)
        return memories[:k]

    def clear(self):
        """Clear all memories from database."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM memories")
            conn.commit()
