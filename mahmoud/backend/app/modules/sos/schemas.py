"""SOS request and response models matching the frontend OpenAPI contract."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SosType = Literal["medical", "breakdown", "accident"]
SosStatus = Literal["open", "acknowledged", "closed"]
SosAction = Literal["acknowledge", "ambulance_called", "note", "close"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SOSCreateRequest(StrictModel):
    trip_id: str = Field(min_length=1, max_length=64)
    type: SosType
    note: str | None = Field(max_length=300)


class SOSActionRequest(StrictModel):
    action: SosAction
    note: str | None = Field(max_length=500)


class SOSLocation(StrictModel):
    lat: float
    lng: float
    fix_at: datetime
    source: Literal["bus_gps"] = "bus_gps"


class SOSActor(StrictModel):
    id: str
    role: Literal["driver", "supervisor"]
    name: str


class SOSActionEntry(StrictModel):
    action: Literal[
        "acknowledge", "ambulance_called", "replacement_sent", "note", "close"
    ]
    by: str
    by_name: str | None
    at: datetime
    note: str | None


class SOSResponse(StrictModel):
    id: str
    type: SosType
    status: SosStatus
    note: str | None
    trip_id: str
    line_id: str
    bus_id: str
    raised_by: SOSActor
    location: SOSLocation | None
    riders_on_board: int = Field(ge=0)
    created_at: datetime
    actions: list[SOSActionEntry]


class BusSummary(StrictModel):
    bus_id: str
    bus_type: Literal["minibus", "coaster", "midibus", "large_bus"]
    plate: str
    seats: int = Field(gt=0)


class DriverSummary(StrictModel):
    driver_id: str
    name: str
    phone: str


class LineSummary(StrictModel):
    line_id: str
    code: str
    name: str


class CampusLocation(StrictModel):
    lat: float
    lng: float


class ReplacementSummary(StrictModel):
    replacement_id: str
    bus: BusSummary
    driver: DriverSummary
    reason: Literal["breakdown", "accident", "driver_unavailable", "other"]
    note: str | None
    sos_id: str | None
    by_name: str | None
    at: datetime


class AdminSOSResponse(SOSResponse):
    line: LineSummary
    direction: Literal["outbound", "return"]
    bus: BusSummary
    driver: DriverSummary
    raised_by_phone: str | None
    replacements: list[ReplacementSummary]
    campus_location: CampusLocation


class AdminSOSList(StrictModel):
    items: list[AdminSOSResponse]

