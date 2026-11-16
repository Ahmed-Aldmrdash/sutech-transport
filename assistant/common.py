"""Shared helpers: load the API key, call Gemini embeddings."""
import os
import sys
import time
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from google import genai
from google.genai import types

HERE = Path(__file__).parent
DATA = HERE / "data"
CHUNKS_FILE = DATA / "chunks.jsonl"
INDEX_FILE = DATA / "index.npz"

load_dotenv(HERE / ".env")

API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001").strip() or "gemini-embedding-001"
DIM = 768  # smaller vectors, plenty for ~50 chunks

if not API_KEY:
    sys.exit("GEMINI_API_KEY is missing. Put it in assistant/.env (see .env.example).")

_client = genai.Client(api_key=API_KEY)


def embed(texts, task):
    """Return a (len(texts), DIM) array of unit-length vectors.

    task: "RETRIEVAL_DOCUMENT" for chunks, "RETRIEVAL_QUERY" for questions.
    """
    last_error = None
    for attempt in range(5):
        try:
            res = _client.models.embed_content(
                model=MODEL,
                contents=texts,
                config=types.EmbedContentConfig(task_type=task, output_dimensionality=DIM),
            )
            vecs = np.array([e.values for e in res.embeddings], dtype="float32")
            # vectors shorter than the model's full size are not normalized by the API
            vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)
            return vecs
        except Exception as e:  # rate limit, network, ...
            last_error = e
            wait = 5 * (attempt + 1)
            print(f"  embed failed ({type(e).__name__}); retrying in {wait}s...")
            time.sleep(wait)
    sys.exit(f"Embedding failed after 5 tries. Last error:\n{last_error}")
