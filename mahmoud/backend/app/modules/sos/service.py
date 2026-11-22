"""SOS business rules, ownership checks, idempotency, and append-only actions."""

import hashlib
import json
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.auth.models import Account
from app.modules.sos.gateway import SOSGateway, TripSOSContext
from app.modules.sos.models import SOSActionLog, SOSIdempotency, SOSOutboxEvent, SOSReport
from app.modules.sos.schemas import SOSActionRequest, SOSCreateRequest
from app.security.permissions import (
    ForbiddenRole,
    HiddenSOS,
    authorize_sos_action,
    authorize_sos_visibility,
)


def _http_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status,
        detail={"code": code, "message": message},
    )


def _request_hash(payload: SOSCreateRequest) -> str:
    canonical = json.dumps(payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _action_data(action: SOSActionLog) -> dict[str, object]:
    return {
        "action": action.action,
        "by": action.actor_id,
        "by_name": action.actor_name,
        "at": _iso(action.created_at),
        "note": action.note,
    }


def serialize_sos(report: SOSReport) -> dict[str, object]:
    location = None
    if report.location_lat is not None and report.location_lng is not None and report.location_fix_at:
        location = {
            "lat": report.location_lat,
            "lng": report.location_lng,
            "fix_at": _iso(report.location_fix_at),
            "source": "bus_gps",
        }
    return {
        "id": str(report.id),
        "type": report.type,
        "status": report.status,
        "note": report.note,
        "trip_id": report.trip_id,
        "line_id": report.line_id,
        "bus_id": report.bus_id,
        "raised_by": {
            "id": report.raised_by_id,
            "role": report.raised_by_role,
            "name": report.raised_by_name,
        },
        "location": location,
        "riders_on_board": report.riders_on_board,
        "created_at": _iso(report.created_at),
        "actions": [_action_data(action) for action in report.actions],
    }


def _idempotency_uuid(value: str) -> str:
    try:
        return str(UUID(value))
    except (ValueError, AttributeError) as exc:
        raise _http_error(422, "VALIDATION_ERROR", "Idempotency-Key must be a UUID") from exc


def _fill_from_trip(report: SOSReport, context: TripSOSContext) -> None:
    report.trip_id = context.trip_id
    report.line_id = context.line_id
    report.bus_id = context.bus_id
    report.direction = context.direction
    report.riders_on_board = max(context.riders_on_board, 0)
    if context.gps_fix:
        report.location_lat = context.gps_fix.lat
        report.location_lng = context.gps_fix.lng
        report.location_fix_at = context.gps_fix.fix_at


async def _load_report(session: AsyncSession, report_id: str) -> SOSReport | None:
    try:
        report_uuid = UUID(report_id)
    except ValueError:
        return None
    return await session.scalar(
        select(SOSReport)
        .where(SOSReport.id == report_uuid)
        .options(selectinload(SOSReport.actions))
    )


async def create_sos(
    session: AsyncSession,
    gateway: SOSGateway,
    *,
    actor: Account,
    payload: SOSCreateRequest,
    idempotency_key: str,
) -> dict[str, object]:
    if actor.role not in {"driver", "supervisor"}:
        raise _http_error(403, "FORBIDDEN", "Only the trip crew can raise an SOS")
    key = _idempotency_uuid(idempotency_key)
    payload_hash = _request_hash(payload)
    prior = await session.scalar(
        select(SOSIdempotency).where(
            SOSIdempotency.actor_id == str(actor.id),
            SOSIdempotency.idempotency_key == key,
        )
    )
    if prior:
        if prior.request_hash != payload_hash:
            raise _http_error(409, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key belongs to another request")
        return prior.response_snapshot

    trip = await gateway.trip_for_crew(session, trip_id=payload.trip_id, actor=actor)
    if trip is None:
        raise _http_error(403, "NOT_YOUR_TRIP", "This trip is not assigned to you")
    if trip.status == "ended":
        raise _http_error(409, "TRIP_ALREADY_ENDED", "This trip has already ended")

    report = SOSReport(
        type=payload.type,
        status="open",
        note=payload.note,
        trip_id=trip.trip_id,
        line_id=trip.line_id,
        bus_id=trip.bus_id,
        direction=trip.direction,
        raised_by_id=str(actor.id),
        raised_by_role=actor.role,
        raised_by_name=actor.name,
        raised_by_phone=actor.phone,
        riders_on_board=max(trip.riders_on_board, 0),
    )
    if trip.gps_fix:
        report.location_lat = trip.gps_fix.lat
        report.location_lng = trip.gps_fix.lng
        report.location_fix_at = trip.gps_fix.fix_at
    session.add(report)
    await session.flush()
    report = await _load_report(session, str(report.id)) or report
    response = serialize_sos(report)
    session.add(
        SOSIdempotency(
            actor_id=str(actor.id),
            idempotency_key=key,
            request_hash=payload_hash,
            report_id=report.id,
            response_snapshot=response,
        )
    )
    session.add(
        SOSOutboxEvent(
            sos_id=report.id,
            event_type="sos.new",
            payload={
                "sos_id": str(report.id),
                "trip_id": report.trip_id,
                "type": report.type,
                "location": response["location"],
                "notify_clinic": report.type in {"medical", "accident"},
                "notify_trip_riders_and_guardians": True,
            },
        )
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(
            select(SOSIdempotency).where(
                SOSIdempotency.actor_id == str(actor.id),
                SOSIdempotency.idempotency_key == key,
            )
        )
        if existing and existing.request_hash == payload_hash:
            return existing.response_snapshot
        raise _http_error(409, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used")
    return response


async def get_crew_sos(
    session: AsyncSession,
    gateway: SOSGateway,
    *,
    actor: Account,
    sos_id: str,
) -> dict[str, object]:
    if actor.role not in {"driver", "supervisor"}:
        raise _http_error(403, "FORBIDDEN", "Crew access is required")
    report = await _load_report(session, sos_id)
    if report is None:
        raise _http_error(404, "NOT_FOUND", "SOS was not found")
    is_crew = report.raised_by_id == str(actor.id) or await gateway.is_crew_for_bus(
        session, bus_id=report.bus_id, actor=actor
    )
    if not is_crew:
        raise _http_error(404, "NOT_FOUND", "SOS was not found")
    return serialize_sos(report)


async def admin_sos_details(
    session: AsyncSession,
    gateway: SOSGateway,
    *,
    actor: Account,
    report: SOSReport,
) -> dict[str, object]:
    try:
        authorize_sos_visibility(role=actor.role, sos_type=report.type)
    except HiddenSOS as exc:
        raise _http_error(404, "NOT_FOUND", "SOS was not found") from exc
    except ForbiddenRole as exc:
        raise _http_error(403, "FORBIDDEN", "You cannot view this SOS") from exc
    return {**serialize_sos(report), **(await gateway.admin_details(session, report=report))}


async def list_admin_sos(
    session: AsyncSession,
    gateway: SOSGateway,
    *,
    actor: Account,
    status: str | None = None,
) -> dict[str, list[dict[str, object]]]:
    if actor.role not in {"super_admin", "transport_admin", "clinic"}:
        raise _http_error(403, "FORBIDDEN", "You cannot view SOS alerts")
    if status is not None and status not in {"open", "acknowledged", "closed"}:
        raise _http_error(422, "VALIDATION_ERROR", "status filter is invalid")
    statement = select(SOSReport).options(selectinload(SOSReport.actions)).order_by(
        desc(SOSReport.created_at)
    )
    if status:
        statement = statement.where(SOSReport.status == status)
    if actor.role == "clinic":
        statement = statement.where(SOSReport.type.in_(["medical", "accident"]))
    reports = list((await session.scalars(statement)).all())
    items = [
        await admin_sos_details(session, gateway, actor=actor, report=report)
        for report in reports
    ]
    return {"items": items}


async def get_admin_sos(
    session: AsyncSession,
    gateway: SOSGateway,
    *,
    actor: Account,
    sos_id: str,
) -> dict[str, object]:
    if actor.role not in {"super_admin", "transport_admin", "clinic"}:
        raise _http_error(403, "FORBIDDEN", "You cannot view SOS alerts")
    report = await _load_report(session, sos_id)
    if report is None:
        raise _http_error(404, "NOT_FOUND", "SOS was not found")
    return await admin_sos_details(session, gateway, actor=actor, report=report)


async def add_sos_action(
    session: AsyncSession,
    gateway: SOSGateway,
    *,
    actor: Account,
    sos_id: str,
    payload: SOSActionRequest,
) -> dict[str, object]:
    if actor.role not in {"transport_admin", "clinic"}:
        raise _http_error(403, "FORBIDDEN", "This role can only view SOS alerts")
    report = await session.scalar(
        select(SOSReport)
        .where(SOSReport.id == UUID(sos_id))
        .options(selectinload(SOSReport.actions))
        .with_for_update()
    ) if _is_uuid(sos_id) else None
    if report is None:
        raise _http_error(404, "NOT_FOUND", "SOS was not found")
    try:
        new_status = authorize_sos_action(
            role=actor.role,
            sos_type=report.type,
            current_status=report.status,
            action=payload.action,
            note=payload.note,
        )
    except HiddenSOS as exc:
        raise _http_error(404, "NOT_FOUND", "SOS was not found") from exc
    except ForbiddenRole as exc:
        raise _http_error(403, "FORBIDDEN", "You cannot act on this SOS") from exc
    except ValueError as exc:
        code = str(exc)
        status_code = 422 if code == "NOTE_REQUIRED" else 409
        raise _http_error(status_code, code, code.replace("_", " ").title()) from exc

    now = datetime.now(UTC)
    report.status = new_status
    if payload.action == "acknowledge":
        report.acknowledged_by_id = str(actor.id)
        report.acknowledged_by_name = actor.name
    if payload.action == "close":
        report.closed_at = now
    session.add(
        SOSActionLog(
            sos_id=report.id,
            action=payload.action,
            actor_id=str(actor.id),
            actor_name=actor.name,
            note=payload.note,
            created_at=now,
        )
    )
    session.add(
        SOSOutboxEvent(
            sos_id=report.id,
            event_type="sos.update",
            payload={
                "sos_id": str(report.id),
                "status": new_status,
                "action": payload.action,
                "notify_trip_riders_and_guardians": payload.action == "close",
            },
        )
    )
    await session.flush()
    await session.refresh(report, attribute_names=["actions"])
    response = await admin_sos_details(session, gateway, actor=actor, report=report)
    await session.commit()
    return response


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except ValueError:
        return False
