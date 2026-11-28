# Mohamed Nabile — Fleet Operations

This folder contains the bus lines, stops, fleet, trip, attendance, delay, and replacement contribution.

## Files

- `dp_api.py` is the MySQL-backed FastAPI app intended for integration.
- `api.py` is a small in-memory demo of the same trip rules. It is not persistent and should not be treated as the production API.
- `fleet_operations_logic.py` contains the trip and attendance rules used by the demo.
- `Schema.sql` creates the MySQL 8 tables; `Seed.sql` inserts sample records.

## Run locally

1. Create a virtual environment and install `requirements.txt`.
2. Run `Schema.sql`, then `Seed.sql` in MySQL 8. `Seed.sql` inserts example records for local development; replace them with approved route and fleet data before integration.
3. Set `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` (default database name: `sutech_transport`).
4. Start the database app with `uvicorn dp_api:app --reload`.
5. Open `/docs` to inspect the API. Routes are under `/api/v1`.

The SQL API requires the MySQL service to be running. The demo can be started separately with `uvicorn api:app --reload`.

## Rules covered

- Campus arrival defaults to 08:30 and return departure defaults to 16:30.
- Return time updates are limited to 12:00–19:00.
- Trips can only move from `not_started` to `in_progress` to `ended`.
- Boarding and checkout require a valid current attendance state; checkout requires a reason.
- Boarding is rejected when the assigned bus has no remaining seats.
- Unboarded students are marked absent at the end of an outbound trip. Return trips do not overwrite attendance as absent.
- Delay and replacement actions are recorded against a trip, and changes to an assigned driver do not rewrite the shared bus record for other trips.
- Sample bus capacities use the proposal's vehicle categories: Hiace 14, Coaster 22–28, and large bus 50 seats.

This is the assigned fleet/trip contribution only. Authentication, role permissions, live GPS, SOS, and integration with the rest of the backend remain team integration work.
