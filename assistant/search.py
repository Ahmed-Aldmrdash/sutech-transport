"""Type a question (Arabic or English) and see which chunks the search finds."""
import json
import sys

import numpy as np

from common import CHUNKS_FILE, INDEX_FILE, embed

TOP = 3

sys.stdout.reconfigure(encoding="utf-8")  # avoid crashes on Arabic in the Windows terminal


def main():
    if not INDEX_FILE.exists():
        sys.exit("No index yet. Run:  python build_index.py")

    rows = {}
    for line in CHUNKS_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            rows[r["id"]] = r
    idx = np.load(INDEX_FILE)
    vectors, ids = idx["vectors"], [str(x) for x in idx["ids"]]

    print("Ask a question (empty line to quit).")
    while True:
        q = input("\nQ> ").strip()
        if not q:
            break
        scores = vectors @ embed([q], "RETRIEVAL_QUERY")[0]
        seen = 0
        shown = set()
        for i in np.argsort(-scores):
            r = rows[ids[i]]
            if r["chunk_id"] in shown:  # ar and en versions of one chunk count once
                continue
            shown.add(r["chunk_id"])
            en_title = rows.get(f"{r['chunk_id']}.en", r)["title"]
            print(f"\n[{scores[i]:.2f}] {r['chunk_id']}  |  {r['doc']} {r['clauses']}  |  {r['kind']}")
            print(f"      {en_title}")
            print(f"      matched ({r['lang']}): {r['text'][:140]}...")
            seen += 1
            if seen == TOP:
                break


if __name__ == "__main__":
    main()
