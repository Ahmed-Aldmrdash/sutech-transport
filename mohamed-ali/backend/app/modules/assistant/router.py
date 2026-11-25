from __future__ import annotations

import os
from typing import Any
from uuid import UUID

import jwt
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import error_payload
from app.core.config import settings
from app.db.session import get_db_session
from app.modules.assistant.schemas import (
    ChatHistoryListResponse,
    ChatRequest,
    ChatResponse,
)
from app.modules.assistant.service import AssistantService

router = APIRouter(tags=["AI Assistant"])


async def get_current_student_id(
    request: Request,
    sut_session: str | None = Cookie(default=None, alias="sut_session"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> UUID:
    """
    استخراج student_id من الجلسة النشطة:
    1. إذا حقن Auth Middleware المستخدم في request.state.user نستخدمه مباشرة.
    2. وإلا نفك توكن الجلسة من كوكي sut_session أو Authorization Bearer.
    """
    state_user = getattr(request.state, "user", None)
    if state_user is not None:
        raw_id = (
            state_user.get("id") or state_user.get("sub")
            if isinstance(state_user, dict)
            else getattr(state_user, "id", None)
        )
        if raw_id:
            return UUID(str(raw_id))

    token = sut_session
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail=error_payload(
                "UNAUTHORIZED",
                "يجب تسجيل الدخول لاستخدام المساعد الذكي.",
            ),
        )

    secret = (
        getattr(settings, "jwt_secret_key", None)
        or getattr(settings, "secret_key", None)
        or os.getenv("SUTECH_JWT_SECRET_KEY", "")
    )
    algorithm = getattr(settings, "jwt_algorithm", "HS256")

    try:
        payload: dict[str, Any] = jwt.decode(token, secret, algorithms=[algorithm])
        raw_id = payload.get("sub") or payload.get("id")
        if not raw_id:
            raise ValueError("Missing user id in token")
        return UUID(str(raw_id))
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=error_payload(
                "UNAUTHORIZED",
                "جلسة الدخول غير صالحة أو منتهية.",
            ),
        ) from exc


def get_assistant_service(
    db: AsyncSession = Depends(get_db_session),
) -> AssistantService:
    return AssistantService(db)


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="إرسال سؤال للمساعد الذكي وحفظ المحادثة",
)
async def chat_with_assistant(
    body: ChatRequest,
    student_id: UUID = Depends(get_current_student_id),
    service: AssistantService = Depends(get_assistant_service),
) -> ChatResponse:
    return await service.ask_question(
        student_id=student_id,
        question=body.question,
    )


@router.get(
    "/chat/history",
    response_model=ChatHistoryListResponse,
    summary="استعراض سجل محادثات الطالب السابقة مع المساعد الذكي",
)
async def list_chat_history(
    student_id: UUID = Depends(get_current_student_id),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: AssistantService = Depends(get_assistant_service),
) -> ChatHistoryListResponse:
    return await service.get_student_history(
        student_id=student_id,
        page=page,
        page_size=page_size,
    )