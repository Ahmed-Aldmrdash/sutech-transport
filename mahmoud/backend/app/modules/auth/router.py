"""OTP sign-in endpoints and the authenticated profile endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db_session
from app.modules.auth.dependencies import (
    get_authenticated_context,
    get_current_account,
    require_same_origin,
)
from app.modules.auth.models import Account, AuthSession
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    OTPChallenge,
    OTPRequest,
    UserResponse,
)
from app.modules.auth.service import (
    SESSION_COOKIE,
    account_user,
    login as authenticate,
    logout as end_session,
    request_otp as create_otp,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
profile_router = APIRouter(tags=["Authentication"])


@router.post("/otp", response_model=OTPChallenge)
async def request_otp(
    payload: OTPRequest,
    _origin_check: None = Depends(require_same_origin),
    session: AsyncSession = Depends(get_db_session),
    accept_language: Annotated[str | None, Header(alias="Accept-Language")] = None,
) -> dict[str, object]:
    return await create_otp(session, payload.identifier, accept_language or "en")


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    _origin_check: None = Depends(require_same_origin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    result, token, expires_at = await authenticate(session, payload.identifier, payload.code)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path="/",
        expires=expires_at,
    )
    return result


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    context: Annotated[tuple[Account, AuthSession], Depends(get_authenticated_context)],
    _origin_check: None = Depends(require_same_origin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    await end_session(session, context[1])
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
    )
    return {"ok": True}


@profile_router.get("/me", response_model=UserResponse)
async def get_me(account: Annotated[Account, Depends(get_current_account)]) -> dict[str, object]:
    return account_user(account)
