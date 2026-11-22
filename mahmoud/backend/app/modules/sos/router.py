"""Emergency SOS endpoints; mount this router under the shared `/api/v1` prefix."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.auth.dependencies import require_operation, require_same_origin
from app.modules.auth.models import Account
from app.modules.sos.dependencies import get_sos_gateway
from app.modules.sos.gateway import SOSGateway
from app.modules.sos.schemas import SOSActionRequest, SOSCreateRequest
from app.modules.sos.service import (
    add_sos_action,
    create_sos,
    get_admin_sos,
    get_crew_sos,
    list_admin_sos,
)

router = APIRouter(tags=["Emergency SOS"])


@router.post("/sos", operation_id="sos.create")
async def create_sos_endpoint(
    payload: SOSCreateRequest,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    actor: Annotated[Account, Depends(require_operation("sos.create"))],
    gateway: Annotated[SOSGateway, Depends(get_sos_gateway)],
    _: Annotated[None, Depends(require_same_origin)],
) -> dict[str, object]:
    return await create_sos(
        session, gateway, actor=actor, payload=payload, idempotency_key=idempotency_key
    )


@router.get("/sos/{sos_id}", operation_id="sos.get")
async def get_sos_endpoint(
    sos_id: str,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    actor: Annotated[Account, Depends(require_operation("sos.get"))],
    gateway: Annotated[SOSGateway, Depends(get_sos_gateway)],
) -> dict[str, object]:
    return await get_crew_sos(session, gateway, actor=actor, sos_id=sos_id)


@router.get("/admin/sos", operation_id="emergencies.list")
async def list_sos_endpoint(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    actor: Annotated[Account, Depends(require_operation("emergencies.list"))],
    gateway: Annotated[SOSGateway, Depends(get_sos_gateway)],
    status: Annotated[str | None, Query()] = None,
) -> dict[str, list[dict[str, object]]]:
    return await list_admin_sos(session, gateway, actor=actor, status=status)


@router.get("/admin/sos/{sos_id}", operation_id="emergencies.get")
async def get_admin_sos_endpoint(
    sos_id: str,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    actor: Annotated[Account, Depends(require_operation("emergencies.get"))],
    gateway: Annotated[SOSGateway, Depends(get_sos_gateway)],
) -> dict[str, object]:
    return await get_admin_sos(session, gateway, actor=actor, sos_id=sos_id)


@router.post(
    "/admin/sos/{sos_id}/actions", operation_id="emergencies.addAction"
)
async def add_sos_action_endpoint(
    sos_id: str,
    payload: SOSActionRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    actor: Annotated[Account, Depends(require_operation("emergencies.addAction"))],
    gateway: Annotated[SOSGateway, Depends(get_sos_gateway)],
    _: Annotated[None, Depends(require_same_origin)],
) -> dict[str, object]:
    return await add_sos_action(
        session, gateway, actor=actor, sos_id=sos_id, payload=payload
    )
