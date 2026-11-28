from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, field_validator


ASSISTANT_DISCLAIMER = "المساعد الذكي قد يخطئ، المرجع النهائي هو إدارة النقل."


class ChatRequest(BaseModel):
    """طلب إرسال سؤال للمساعد الذكي (POST /api/v1/chat)."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="نص سؤال الطالب بالعربية أو الإنجليزية",
    )

    @field_validator("question")
    @classmethod
    def strip_and_validate_question(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Question must not be empty.")
        return cleaned


class ChatResponse(BaseModel):
    """استجابة المساعد الذكي للطالب متوافقة مع عقد AI Service وعقد SUtech."""

    status: Literal["success"] = "success"
    message_id: UUID
    question: str
    response: str
    disclaimer: str = ASSISTANT_DISCLAIMER
    created_at: AwareDatetime


class ChatHistoryItem(BaseModel):
    """عنصر واحد في سجل محادثات الطالب السابقة."""

    id: UUID
    user_question: str
    ai_response: str
    created_at: AwareDatetime


class ChatHistoryListResponse(BaseModel):
    """قائمة سجل محادثات الطالب مع الترقيم."""

    items: list[ChatHistoryItem]
    total: int = Field(ge=0)