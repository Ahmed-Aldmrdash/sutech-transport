"""Turn data/chunks.jsonl into data/index.npz (run once, and again whenever chunks change)."""
import json

import numpy as np

from common import CHUNKS_FILE, INDEX_FILE, MODEL, embed

BATCH = 16


def main():
    rows = [json.loads(line) for line in CHUNKS_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
    print(f"{len(rows)} records, model: {MODEL}")

    # title + text gives the model a bit more context for each chunk
    texts = [f"{r['title']}\n{r['text']}" for r in rows]

    parts = []
    for i in range(0, len(texts), BATCH):
        parts.append(embed(texts[i:i + BATCH], "RETRIEVAL_DOCUMENT"))
        print(f"  {min(i + BATCH, len(texts))}/{len(texts)}")

    vectors = np.vstack(parts)
    np.savez_compressed(INDEX_FILE, vectors=vectors, ids=np.array([r["id"] for r in rows]))
    print(f"Saved {INDEX_FILE.name}: {vectors.shape[0]} vectors x {vectors.shape[1]} dims")


if __name__ == "__main__":
    main()
