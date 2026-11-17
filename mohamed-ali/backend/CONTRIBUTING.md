# Backend team workflow

The backend lives in this folder. Keep each feature's code inside its own module under `app/modules/` so parallel work stays isolated.

## Module ownership

| Owner | Module folder | Scope |
| --- | --- | --- |
| Mahmoud | `app/modules/auth/` | OTP login, sessions, permissions, security controls |
| Muhammad Nabil | `app/modules/operations/` | Lines, stops, buses, timetables, basic transport notifications |
| Ahmed | `app/modules/subscriptions/`, `payments/`, and `card/` | Seat reservations, receipts, digital cards and QR behavior |
| Abdullah | `app/modules/reports/` and `app/modules/assistant/` | Reports and the chat API integration |
| Muhammad Ali | `app/core/`, `app/db/`, `app/api/`, `app/common/` | Application foundation, shared database setup, API assembly, OpenAPI and integration |

These folders establish ownership boundaries only; feature behavior is implemented by the named owner. The current assignment does not yet name owners for trips, attendance, absences, GPS, SOS, student/parent requests, or the remaining admin endpoints. Agree on an owner before starting those areas. The old `operations` model draft includes both catalog and trip data, so keep new trip endpoints separate or agree on ownership before expanding that module.

## Keep parallel changes independent

1. Branch from the latest `main` using a short name such as `backend-transport` or `backend-payments`.
2. Put feature code and feature schemas/models in that owner's module. A typical module can contain `router.py`, `schemas.py`, `models.py`, and `service.py` as needed. Package names intentionally match the earlier model draft to make selective review and reuse easier.
3. Use the shared `Base` in `app/db/base.py` and the `get_db_session` dependency from `app/db/session.py`. Services own their transactions and explicitly commit writes.
4. Do not edit `app/api/v1/router.py`, shared error handling, database configuration, or Alembic environment files from a feature branch. Submit a router that the integration owner can register.
5. Do not create Alembic revisions in parallel feature branches. The integration owner generates and reviews migrations after merging model changes, keeping one migration history.
6. Match the API agreement and `../frontend/openapi.json`: `/api/v1`, `snake_case`, UTC timestamps, agreed status values, error codes, and idempotency behavior.
7. Open a pull request into `main` and describe routes, models, migration needs, and any dependency on another module.

The AI team's existing `../assistant/` directory is separate from `app/modules/assistant/`. The latter is only the future HTTP integration point; do not copy or change the existing assistant implementation as part of the foundation.
