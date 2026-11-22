# Mahmoud backend security work

This folder contains Mahmoud's independently reviewable backend work for OTP authentication, server-side sessions, authorization helpers, API security, QR validation, GPS device request authentication, and SOS emergency reports. It is intended for review and later integration into the shared FastAPI application; it does not modify Muhammad Ali's shared backend.

## Included

- OTP sign-in and logout/session handling under `app/modules/auth/`.
- Endpoint role policy generated from `frontend/openapi.json` under `app/security/endpoint_roles.json`, plus reusable role and SOS visibility/state checks.
- Browser-origin CSRF checks for cookie-authenticated state-changing requests.
- Signed QR token helpers with a 30-second lifetime and database nonce claims to reject replayed scans.
- HMAC-signed GPS HTTP request verification with timestamp/body binding and nonce replay protection.
- SOS API router and service for raising, viewing, filtering, and recording immutable action history for emergency reports. SOS writes create transactional outbox events for a delivery worker.
- A demo account seed script restricted to local SQLite in development/test.

## Shared-backend integration

The shared application must provide `app.common.models.BaseModel`, `app.db.session.get_db_session`, `app.core.config.settings`, and the normal API assembly. Integrate the exports from `app.modules.auth.router` and `app.modules.sos.router` under `/api/v1`; the auth module also exports `profile_router`, which must be mounted under `/api/v1` for `/me`.

The integration owner must register all model metadata and create/review Alembic migrations for the auth tables, SOS tables, outbox, and `security_nonces`. Role-policy helpers do not automatically secure unrelated shared routes: each protected route must attach `require_operation(operation_id)` or an equivalent reviewed role/ownership guard. CSRF checks must be added to every cookie-authenticated state-changing route.

The SOS router expects `app.state.sos_gateway` to implement the interface in `app/modules/sos/gateway.py`. The adapter must read assigned trips, current bus GPS, and rider counts from trusted backend sources. It must never take GPS coordinates or passenger counts from the SOS caller. Install the real adapter before exposing SOS routes; without it, the endpoints return `SOS_INTEGRATION_UNAVAILABLE` (503).

## Decisions still needed before live use

- **GPS transport:** the agreement does not settle HTTP vs MQTT/TCP. `app/security/gps.py` currently implements a proposed signed HTTP request for `POST /api/v1/gps/ingest`; agree the protocol and key provisioning/rotation with the operations owner before connecting devices. Persist the nonce with the GPS write in one transaction.
- **QR scan integration:** issue and verify tokens with `app/security/qr.py`; the subscription/current-line check and successful boarding write belong to the subscription/attendance module. Claim the verified token nonce with `claim_qr_nonce` in the same transaction as boarding.
- **SOS notifications:** SOS events are written to an outbox in the same database transaction. A shared worker still needs to deliver them to transport staff, clinic when applicable, and trip riders/guardians, then mark delivery/retry failures.
- **SMS:** development/test returns `demo_code` and sends no SMS. Production requires `SUTECH_OTP_SECRET`, an approved HTTPS SMS gateway URL, and its bearer token. The sender contract may need adapting to the selected provider. Never return demo codes in production.
- **Account source:** demo accounts are fixtures only. Replace them with the university's approved account data before live authentication.
- **Unknown-account response:** the frontend contract currently exposes `UNKNOWN_IDENTIFIER`; agree whether to preserve it or use a generic response to reduce account enumeration before production.

## Local checks

Run the tests from this folder with the local virtual environment:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The auth/database seed flow also requires the shared backend foundation and a local SQLite URL. The seed script refuses non-SQLite databases and production mode.
