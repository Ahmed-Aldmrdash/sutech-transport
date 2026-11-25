from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.models import BaseModel


class ChatHistory(BaseModel):
    """سجل محادثات الطالب مع المساعد الذكي (Stateless AI Service -> Stateful DB History)."""

    __tablename__ = "chat_history"

    student_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_question: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    ai_response: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )