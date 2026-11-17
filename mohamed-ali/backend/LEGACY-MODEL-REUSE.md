# Earlier backend model draft

The previous local backend work contains 37 SQLAlchemy tables in these modules: `assistant`, `auth`, `card`, `operations`, `payments`, `reports`, `requests`, `subscriptions`, and `tracking`. It is useful as a starting point for schema review, but should not be copied wholesale into this repository as if it were the final contract.

## Compatibility work already prepared

- `app.common.models.BaseModel` exposes the same import path used by the earlier model files.
- That base now inherits the foundation's single `app.db.base.Base`, so all adopted tables share one metadata registry and Alembic can see them.
- Alembic discovers `models.py` files inside `app/modules/` automatically when feature owners add or adopt them.
- Package names align with the earlier model modules, allowing an owner to port a reviewed model file without changing its common base import.

## Review before adopting individual files

- The draft's trip status values and request status values need comparison with the current agreement and frontend OpenAPI contract.
- The notification enum in the draft does not match the agreement's notification kinds.
- The earlier schema does not cover all current agreement areas, including violations, events, and Secretary General watchlists.
- Tracking and route location models use PostGIS `Geometry`; those models require a PostGIS-enabled PostgreSQL image and an extension migration. The current development compose file uses plain PostgreSQL until that dependency is deliberately selected.
- Assistant embedding models use `pgvector`; adopt them only with the AI owner and after adding the extension and compatible database setup.
- Some responsibilities are grouped together in the old files, so review module ownership before copying them into a teammate's folder.

Feature owners should compare only their area, make the required contract updates in their own branch, and document any changed statuses or fields. The integration owner generates migrations after the reviewed model changes are merged.
