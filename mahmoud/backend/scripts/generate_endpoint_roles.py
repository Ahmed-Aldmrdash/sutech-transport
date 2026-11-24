"""Regenerate server-side role policy from the repository's OpenAPI contract."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "frontend" / "openapi.json"
TARGET = Path(__file__).resolve().parents[1] / "app" / "security" / "endpoint_roles.json"


def main() -> None:
    contract = json.loads(SOURCE.read_text(encoding="utf-8"))
    policies: dict[str, list[str]] = {}
    for path_item in contract["paths"].values():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            operation_id = operation.get("operationId")
            if not operation_id:
                continue
            roles = operation.get("x-roles", [])
            if roles == "public":
                roles = []
            elif isinstance(roles, str):
                roles = [roles]
            policies[operation_id] = sorted(roles)
    TARGET.write_text(json.dumps(policies, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(policies)} endpoint role policies from {SOURCE}.")


if __name__ == "__main__":
    main()
