from __future__ import annotations

import os
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import error_payload
from app.modules.assistant.models import ChatHistory
from app.modules.assistant.schemas import (
    ASSISTANT_DISCLAIMER,
    ChatHistoryItem,
    ChatHistoryListResponse,
    ChatResponse,
)

# يقرأ الرابط من متغيرات البيئة دون الحاجة لتعديل app/core/config.py
AI_SERVICE_URL = (
    os.getenv("SUTECH_AI_SERVICE_URL")
    or os.getenv("AI_SERVICE_URL")
    or "http://127.0.0.1:8000"
).rstrip("/")

AI_INTERNAL_API_KEY = (
    os.getenv("SUTECH_AI_INTERNAL_API_KEY")
    or os.getenv("AI_INTERNAL_API_KEY")
    or ""
).strip()

AI_TIMEOUT_SECONDS = 25.0


class AssistantService:
    """بوابة الربط مع خدمة المساعد الذكي المستقلة وحفظ سجل محادثات الطالب."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ask_question(
        self,
        *,
        student_id: UUID,
        question: str,
    ) -> ChatResponse:
        headers: dict[str, str] = {
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
        }
        if AI_INTERNAL_API_KEY:
            headers["X-Internal-API-Key"] = AI_INTERNAL_API_KEY

        try:
            async with httpx.AsyncClient(timeout=AI_TIMEOUT_SECONDS) as client:
                ai_res = await client.post(
                    f"{AI_SERVICE_URL}/chat",
                    json={"question": question},
                    headers=headers,
                )
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=503,
                detail=error_payload(
                    "AI_SERVICE_TIMEOUT",
                    "استغرق المساعد الذكي وقتاً أطول من المتوقع، يرجى المحاولة مرة أخرى.",
                ),
            ) from exc
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail=error_payload(
                    "AI_SERVICE_UNAVAILABLE",
                    "خدمة المساعد الذكي غير متاحة حالياً، يرجى المحاولة لاحقاً.",
                ),
            ) from exc

        if ai_res.status_code != 200:
            raise HTTPException(
                status_code=503,
                detail=error_payload(
                    "AI_SERVICE_UNAVAILABLE",
                    "خدمة المساعد الذكي غير متاحة حالياً، يرجى المحاولة لاحقاً.",
                ),
            )

        try:
            data = ai_res.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail=error_payload(
                    "AI_INVALID_RESPONSE",
                    "استجابة غير صالحة من خدمة المساعد الذكي.",
                ),
            ) from exc

        ai_answer = str(data.get("response") or "").strip()
        if not ai_answer:
            raise HTTPException(
                status_code=502,
                detail=error_payload(
                    "AI_EMPTY_RESPONSE",
                    "لم يتمكن المساعد الذكي من توليد إجابة حالياً.",
                ),
            )

        # حفظ السؤال والإجابة في قاعدة البيانات مرتبطة بـ student_id
        record = ChatHistory(
            student_id=student_id,
            user_question=question,
            ai_response=ai_answer,
        )
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)

        return ChatResponse(
            status="success",
            message_id=record.id,
            question=question,
            response=ai_answer,
            disclaimer=ASSISTANT_DISCLAIMER,
            created_at=record.created_at,
        )

    async def get_student_history(
        self,
        *,
        student_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> ChatHistoryListResponse:
        count_stmt = select(func.count(ChatHistory.id)).where(
            ChatHistory.student_id == student_id
        )
        total = int((await self.session.execute(count_stmt)).scalar_one())

        offset = (page - 1) * page_size
        stmt = (
            select(ChatHistory)
            .where(ChatHistory.student_id == student_id)
            .order_by(ChatHistory.created_at.desc())
            .limit(page_size)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).scalars().all()

        items = [
            ChatHistoryItem(
                id=row.id,
                user_question=row.user_question,
                ai_response=row.ai_response,
                created_at=row.created_at,
            )
            for row in rows
        ]
        return ChatHistoryListResponse(items=items, total=total)