# Backend team integration bundle

This bundle consolidates the shared backend foundation and the backend contributions available from the repository branches at the time of packaging.

## Included

- Muhammad Ali foundation: FastAPI app, shared configuration, async PostgreSQL session, API router, Alembic setup, and module placeholders.
- Mahmoud: authentication, security helpers, SOS module, and supporting scripts, placed under the shared app structure.
- Abdullah: assistant and reports modules, placed under the shared app structure.
- Ahmed Shafiq: original operations and subscriptions/payments/card submissions, preserved as drafts because they are standalone synchronous scripts.
- Mohamed Nabil: corrected prototype, preserved as a standalone draft because it uses a separate MySQL schema and app.

## Integration status

The feature code is collected in one backend directory, but it is not yet a fully integrated, production-ready API.

- The foundation uses async SQLAlchemy with PostgreSQL. Ahmed's scripts use synchronous SQLAlchemy and need a deliberate conversion before they can be activated.
- Mohamed Nabil's prototype uses MySQL and its own API/schema. It needs porting to the shared PostgreSQL models before activation.
- Mahmoud's SOS module expects an application-provided SOS gateway adapter; configure that adapter before enabling the router.
- Abdullah's reports module expects route and stop tables/columns that must be reconciled with the operations schema before migrations are generated.
- Abdullah's assistant routes currently use bearer-token decoding, while the shared authentication contribution uses server-side sessions. Align these auth dependencies before router registration.
- Feature routers are intentionally not registered in `app/api/v1/router.py` yet. Review paths, auth, request/response schemas, and authorization first.
- The initial Alembic migration in the foundation is empty. Generate and review migrations after the shared models are finalized.
- Review each module's third-party imports and add the approved dependencies to `requirements.txt` before running the combined app.

No secrets, environment files, or Python cache files are included.
