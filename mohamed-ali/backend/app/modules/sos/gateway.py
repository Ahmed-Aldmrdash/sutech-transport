"""Adapter boundary to trip/GPS services owned by other backend teammates."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import Account
from app.modules.sos.models import SOSReport


@dataclass(frozen=True)
class GPSFix:
    lat: float
    lng: float
    fix_at: datetime


@dataclass(frozen=True)
class TripSOSContext:
    trip_id: str
    line_id: str
    bus_id: str
    direction: str
    status: str
    gps_fix: GPSFix | None
    riders_on_board: int


class SOSGateway(Protocol):
    """Implement with the operations/GPS modules when the shared backend is integrated."""

    async def trip_for_crew(
        self, session: AsyncSession, *, trip_id: str, actor: Account
    ) -> TripSOSContext | None: ...

    async def admin_details(
        self, session: AsyncSession, *, report: SOSReport
    ) -> dict[str, object]: ...
