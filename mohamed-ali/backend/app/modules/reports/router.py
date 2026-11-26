from __future__ import annotations

from datetime import date
from typing import Any, Literal
from uuid import UUID

import jwt
from fastapi import APIRouter, Cookie, Depends, Header, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db_session
from app.modules.reports.repository import ReportsRepository
from app.modules.reports.schemas import (
    AuditArea,
    AuditLogListResponse,
    AuditQueryParams,
    ReportCatalogResponse,
    ReportFormat,
    ReportJsonResponse,
    ReportQueryParams,
)
from app.modules.reports.service import (
    ROLE_REPORT_PERMISSIONS,
    ExportedFileResult,
    ReportsDomainError,
    ReportsService,
)

router = APIRouter(tags=["Reports & Audit"])


def _extract_actor_identity(current_user: Any) -> tuple[UUID, str]:
    """استخراج معرف المستخدم ودوره سواء كان كائن ORM أو dict من التوكن."""
    if isinstance(current_user, dict):
        user_id = current_user.get("id") or current_user.get("sub")
        role = current_user.get("role", "")
    else:
        user_id = getattr(current_user, "id", None)
        role = getattr(current_user, "role", "")

    if not user_id:
        raise ReportsDomainError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Invalid or missing user identity in token.",
        )
    return UUID(str(user_id)), str(role)


async def get_current_user(
    request: Request,
    sut_session: str | None = Cookie(default=None, alias="sut_session"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict[str, Any]:
    """
    استخراج بيانات المستخدم الحالي ودوره من الجلسة:
    1. إذا كان Auth Middleware قد حقن المستخدم في request.state.user نستخدمه مباشرة.
    2. وإلا نفك توكن الجلسة من كوكي sut_session (المعتمد في العقد) أو Bearer Header.
    """
    state_user = getattr(request.state, "user", None)
    if state_user is not None:
        if isinstance(state_user, dict):
            return state_user
        return {
            "id": getattr(state_user, "id", None),
            "role": getattr(state_user, "role", ""),
        }

    token = sut_session
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    if not token:
        raise ReportsDomainError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Authentication credentials were not provided.",
        )

    secret = getattr(settings, "jwt_secret_key", None) or getattr(settings, "secret_key", "")
    algorithm = getattr(settings, "jwt_algorithm", "HS256")

    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
        return {
            "id": payload.get("sub") or payload.get("id"),
            "role": payload.get("role", ""),
        }
    except Exception as exc:
        raise ReportsDomainError(
            status_code=401,
            code="UNAUTHORIZED",
            message="Invalid or expired session token.",
        ) from exc


async def require_reports_actor(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> tuple[UUID, str]:
    """
    Dependency تُنفّذ أولاً قبل فحص Query params لضمان ترتيب العقد:
    401 Unauthorized -> 403 RBAC -> 404 Not Found -> 422 Validation.
    """
    actor_id, actor_role = _extract_actor_identity(current_user)
    if actor_role not in ROLE_REPORT_PERMISSIONS:
        raise ReportsDomainError(
            status_code=403,
            code="FORBIDDEN",
            message="You do not have permission to access administrative reports.",
        )
    return actor_id, actor_role


async def require_super_admin_actor(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> tuple[UUID, str]:
    """Dependency تضمن أن مسار /admin/audit متاح لـ super_admin فقط قبل فحص Query params."""
    actor_id, actor_role = _extract_actor_identity(current_user)
    if actor_role != "super_admin":
        raise ReportsDomainError(
            status_code=403,
            code="FORBIDDEN",
            message="Only super_admin can access the audit log.",
        )
    return actor_id, actor_role


def _resolve_lang(accept_language: str | None) -> Literal["ar", "en"]:
    """استخراج لغة العرض من ترويسة Accept-Language (الافتراضي ar)."""
    if accept_language and accept_language.lower().strip().startswith("en"):
        return "en"
    return "ar"


def _extract_client_ip(request: Request) -> str | None:
    """استخراج عنوان IP الحقيقي للعميل لتسجيله في سجل الرقابة AuditLog."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _domain_error_response(exc: ReportsDomainError) -> JSONResponse:
    """بناء استجابة الخطأ القياسية حسب عقد SUtech: {"code": "...", "message": "..."}."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
        },
    )


def _validation_error_response(exc: ValidationError) -> JSONResponse:
    """تحويل أخطاء Pydantic إلى شكل الخطأ القياسي للمشروع."""
    first_err = exc.errors()[0] if exc.errors() else {}
    raw_msg = str(first_err.get("msg", "Invalid query parameters."))
    if "INVALID_RANGE" in raw_msg:
        return JSONResponse(
            status_code=422,
            content={
                "code": "INVALID_RANGE",
                "message": "'from' date must not be after 'to' date.",
            },
        )
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "message": raw_msg,
        },
    )


def get_reports_service(db: AsyncSession = Depends(get_db_session)) -> ReportsService:
    return ReportsService(ReportsRepository(db))


@router.get(
    "/admin/reports",
    response_model=ReportCatalogResponse,
    summary="قائمة التقارير المسموحة لدور المستخدم الحالي",
)
async def list_available_reports(
    actor: tuple[UUID, str] = Depends(require_reports_actor),
    accept_language: str | None = Header(default="ar", alias="Accept-Language"),
    service: ReportsService = Depends(get_reports_service),
) -> Any:
    try:
        _, actor_role = actor
        lang = _resolve_lang(accept_language)
        return service.get_catalog_for_role(role=actor_role, lang=lang)
    except ReportsDomainError as exc:
        return _domain_error_response(exc)


@router.get(
    "/admin/reports/{report_type}",
    response_model=ReportJsonResponse,
    summary="عرض التقرير (JSON) أو تصديره (XLSX / PDF)",
)
async def get_or_export_report(
    report_type: str,
    request: Request,
    actor: tuple[UUID, str] = Depends(require_reports_actor),
    format: ReportFormat = Query(default="json"),
    line: str | None = Query(default=None),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    accept_language: str | None = Header(default="ar", alias="Accept-Language"),
    db: AsyncSession = Depends(get_db_session),
    service: ReportsService = Depends(get_reports_service),
) -> Any:
    try:
        actor_id, actor_role = actor
        lang = _resolve_lang(accept_language)
        ip_address = _extract_client_ip(request)

        params = ReportQueryParams(
            format=format,
            line=line,
            from_date=from_date,
            to_date=to_date,
            page=page,
            page_size=page_size,
        )

        result = await service.generate_report(
            actor_id=actor_id,
            actor_role=actor_role,
            raw_report_type=report_type,
            params=params,
            lang=lang,
            ip_address=ip_address,
        )

        if isinstance(result, ExportedFileResult):
            await db.commit()
            return Response(
                content=result.content,
                media_type=result.media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{result.filename}"',
                },
            )

        return result

    except ReportsDomainError as exc:
        await db.rollback()
        return _domain_error_response(exc)
    except ValidationError as exc:
        await db.rollback()
        return _validation_error_response(exc)


@router.get(
    "/admin/audit",
    response_model=AuditLogListResponse,
    summary="سجل العمليات والرقابة (للسوبر أدمن فقط)",
)
async def get_audit_logs(
    actor: tuple[UUID, str] = Depends(require_super_admin_actor),
    area: AuditArea | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    service: ReportsService = Depends(get_reports_service),
) -> Any:
    try:
        _, actor_role = actor
        params = AuditQueryParams(
            area=area,
            page=page,
            page_size=page_size,
        )
        return await service.list_audit_logs(
            actor_role=actor_role,
            params=params,
        )
    except ReportsDomainError as exc:
        return _domain_error_response(exc)
    except ValidationError as exc:
        return _validation_error_response(exc)