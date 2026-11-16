from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]


@router.get("/health/live", response_model=HealthResponse)
async def liveness_check() -> HealthResponse:
    """Report that the API process is responding."""
    return HealthResponse(status="ok")


@router.get("/health/ready", response_model=HealthResponse)
async def readiness_check(
    session: AsyncSession = Depends(get_db_session),
) -> HealthResponse:
    """Report readiness only when the database accepts a query."""
    await session.execute(text("SELECT 1"))
    return HealthResponse(status="ok")
