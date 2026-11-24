"""FastAPI dependencies for authenticated requests."""

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.auth.models import Account, AuthSession
from app.modules.auth.service import SESSION_COOKIE, get_session_account
from app.core.config import settings
from app.security.csrf import CSRFError, validate_browser_origin
from app.security.permissions import ENDPOINT_ROLES, ForbiddenRole, authorize_role


async def get_authenticated_context(
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
    session: AsyncSession = Depends(get_db_session),
) -> tuple[Account, AuthSession]:
    return await get_session_account(session, token)


async def get_current_account(
    context: Annotated[tuple[Account, AuthSession], Depends(get_authenticated_context)],
) -> Account:
    return context[0]


async def require_same_origin(request: Request) -> None:
    """CSRF defense for browser POSTs; attach to state-changing endpoints."""
    request_origin = f"{request.url.scheme}://{request.url.netloc}"
    try:
        validate_browser_origin(
            origin=request.headers.get("origin"),
            referer=request.headers.get("referer"),
            allowed_origins=settings.cors_origins,
            request_origin=request_origin,
        )
    except CSRFError as exc:
        raise HTTPException(
            status_code=403,
            detail={"code": "CSRF_ORIGIN_REJECTED", "message": "Request origin is not allowed"},
        ) from exc


def require_roles(*allowed_roles: str):
    """Create a route dependency that rejects roles outside the endpoint allow-list."""
    if not allowed_roles:
        raise ValueError("At least one role is required")

    async def role_guard(account: Account = Depends(get_current_account)) -> Account:
        try:
            authorize_role(account.role, allowed_roles)
        except ForbiddenRole as exc:
            raise HTTPException(
                status_code=403,
                detail={"code": "FORBIDDEN", "message": "You are not allowed to perform this action"},
            ) from exc
        return account

    return role_guard


def require_operation(operation_id: str):
    """Use the shared OpenAPI-derived allow-list for a route's server-side guard."""
    try:
        allowed_roles = ENDPOINT_ROLES[operation_id]
    except KeyError as exc:
        raise ValueError(f"No role policy registered for {operation_id}") from exc
    if not allowed_roles:
        raise ValueError(f"{operation_id} is public and must not use an auth role guard")
    return require_roles(*sorted(allowed_roles))
