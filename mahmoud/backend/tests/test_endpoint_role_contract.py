import json
import unittest
from pathlib import Path

from app.security.permissions import ENDPOINT_ROLES


class EndpointRoleContractTests(unittest.TestCase):
    def test_security_policy_matches_all_frontend_openapi_roles(self) -> None:
        project_root = Path(__file__).resolve().parents[3]
        openapi_path = project_root / "frontend" / "openapi.json"
        contract = json.loads(openapi_path.read_text(encoding="utf-8"))
        expected: dict[str, frozenset[str]] = {}
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
                expected[operation_id] = frozenset(roles)

        self.assertEqual(ENDPOINT_ROLES, expected)


if __name__ == "__main__":
    unittest.main()
