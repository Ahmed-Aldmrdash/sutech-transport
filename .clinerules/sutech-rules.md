# Agents.md — SUtech Smart Transport Backend Master Rules (100% Aligned)

## 1. Architecture, Stack & Team Isolation (`CONTRIBUTING.md` & `LEGACY-MODEL-REUSE.md`)
- **Stack**: Python 3.12+ / FastAPI / SQLAlchemy 2.0 (Async) / PostgreSQL 18 / Pydantic v2.
- **Pattern**: Modular Monolith (`app/modules/<module_name>/`).
- **Abdullah's Owned Modules**:
  1. `app/modules/reports/` (Admin reports, JSON/XLSX/PDF exports, audit logging)
  2. `app/modules/assistant/` (HTTP `/api/v1/chat` integration layer ONLY)
- **Strict Isolation Rules**:
  - NEVER edit `app/api/v1/router.py`, `alembic/`, `app/core/`, `app/db/`, `app/common/`, or other teammates' modules (`auth`, `operations`, `subscriptions`, `payments`, `card`, `requests`, `tracking`).
  - NEVER generate Alembic migration revisions in this feature branch; the integration owner generates migrations after PR review.
  - NEVER copy or modify `../../assistant/` (the AI team's standalone service). `app/modules/assistant/` is strictly the backend HTTP integration bridge.
- **Database & Transactions**:
  - Inherit SQLAlchemy models from `app.common.models.BaseModel` (backed by `app.db.base.Base` naming conventions).
  - Review legacy draft models (`LEGACY-MODEL-REUSE.md`) before copying; align statuses/fields with the current agreement and `openapi.json`.
  - Inject async sessions via `get_db_session` (`app/db/session.py`). Services own their transactions and explicitly call `await db.commit()`.

## 2. Global API Contract (`../../frontend/openapi.json` & Agreement)
- **Prefix**: `/api/v1/` | **Naming**: Strictly `snake_case` | **IDs**: Strings (9-digit string for `student_id`).
- **Timestamps & Dates**:
  - Datetimes: ISO 8601 UTC with seconds (`2026-11-13T06:30:00Z`).
  - Dates: `"YYYY-MM-DD"` | Schedule times: `"HH:MM"` (Egypt local time).
- **Money**: Store and compute in integer piasters (`150000` = 1,500 EGP). Convert to EGP ONLY inside exported report files (`xlsx` / `pdf`).
- **Standard Pagination**: `?page=1&page_size=20` (max `200`) -> `{"items": [...], "total": int}` (except report data responses which follow the custom report schema below).
- **Error Envelope**: HTTP status + `{"code": "UPPER_SNAKE_CASE", "message": "..."}` (`401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT`, `422 VALIDATION_ERROR`).
- **Localization**: Respect `Accept-Language: ar` or `en` for titles, labels, and column headers.

## 3. Domain Rules — `reports` Module (`app/modules/reports/`)
- **Endpoints**:
  1. `GET /api/v1/admin/reports` -> Returns `{"items": [{"type", "title", "description", "uses_period"}]}` filtered by the caller's role.
  2. `GET /api/v1/admin/reports/{type}?format=json|xlsx|pdf&line=&from=&to=&page=1&page_size=20`
- **RBAC Matrix (`super_admin` sees all; unauthorized roles receive `403 FORBIDDEN`)**:
  - `roster`: `transport_admin`, `finance`, `secretary_general`, `super_admin` (no date period; uses today).
  - `payments`: `finance`, `secretary_general`, `super_admin` (default period: current month to today).
  - `attendance`: `transport_admin`, `secretary_general`, `super_admin` (default period: current week to today; 1 row per line per operating day).
  - `seat_occupancy`: `transport_admin`, `finance`, `secretary_general`, `super_admin` (default period: current month to today).
- **Validation & Domain Error Codes**:
  - Unknown `line` -> `404 LINE_NOT_FOUND`.
  - `to < from` or invalid date -> `422 INVALID_RANGE`.
  - `attendance` range > **31 days** -> `422 REPORT_RANGE_TOO_LONG`.
  - `format=pdf` with > **2,000 rows** -> `422 REPORT_TOO_LARGE_FOR_PDF` (`xlsx` has no row limit).
- **JSON Report Response Schema (`format=json`)**:
  - `{"type": str, "title": str, "columns": [{"key": str, "label": str, "kind": "text|number|money|date|time|percent"}], "rows": list[dict], "total": int, "page": int, "page_size": int, "filters": {"line": str|None, "from": str|None, "to": str|None}, "summary": [{"label": str, "value": str|int|float}], "generated_at": str}`
- **Export Rules (`format=xlsx` & `format=pdf`)**:
  - `Content-Disposition` filename: `sutech_{type}_{line_or_all}_{from}_{to}.{ext}` (use today's date when `from`/`to` are omitted, e.g., `roster`).
  - PDF must be Arabic RTL with official logo (`../../docs/assets/brand/logo-light.svg`), active filter summary, and generation timestamp in Egypt local time.
  - Identical filters MUST produce identical numbers across `json`, `xlsx`, and `pdf`.
  - Every export action MUST be persisted in the audit trail (`report_exports` / `audit_logs`).

## 4. Domain Rules — `assistant` Module (`app/modules/assistant/`)
- **Endpoint**: `POST /api/v1/chat` (authenticated `student` role via session/Bearer token).
- **Scope**: HTTP integration bridge connecting authenticated student requests to the AI assistant service. Extract `student_id` strictly from the authenticated session, NEVER from prompt text.
- **Security & Guardrails**: Read-only tools + complaint draft requiring explicit confirmation; never mutate DB state directly, leak cross-student data, or expose national IDs/medical details. Append static disclaimer under responses.

## 5. Mandatory AI Agent Workflow
1. **Plan First (`Plan` mode)**: Inspect target files and contract before writing code; propose file list, schemas, and edge cases.
2. **Build Incrementally (`Act` mode)**: `models.py` -> `schemas.py` -> `generators/` -> `repository.py` -> `service.py` -> `router.py`.
3. **Verify**: Check RBAC (`403`), range/row limits (`422`), contract schemas, and write unit/integration tests (`pytest`).
