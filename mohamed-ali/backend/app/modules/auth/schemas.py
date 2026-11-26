"""Request and response schemas for authentication."""

from typing import Literal

from pydantic import BaseModel, Field


class OTPRequest(BaseModel):
    """Request an OTP for a registered account."""

    identifier: str = Field(
        min_length=3,
        max_length=64,
        description="Student or account identifier",
    )


class LoginRequest(BaseModel):
    """Verify OTP and start an authenticated session."""

    identifier: str = Field(
        min_length=3,
        max_length=64,
    )

    code: str = Field(
        min_length=4,
        max_length=6,
        pattern=r"^\d{4,6}$",
        description="OTP verification code",
    )


class OTPChallenge(BaseModel):
    masked_destination: str
    name_hint: str
    expires_in_seconds: int = Field(gt=0)
    attempts_left: int = Field(ge=0)
    code_length: int = Field(ge=4, le=6)
    resend_after_seconds: int = Field(ge=0)
    demo_code: str | None = None


class UserResponse(BaseModel):
    id: str
    role: Literal[
        "super_admin", "transport_admin", "finance", "clinic", "student_affairs",
        "secretary_general", "bus_company", "driver", "supervisor", "student", "parent",
    ]
    name: str
    name_ar: str | None = None
    identifier: str
    faculty: str | None = None
    faculty_ar: str | None = None
    level: int | None = None
    guardian_name: str | None = None
    guardian_name_ar: str | None = None
    masked_phone: str | None = None
    phone: str | None = None


class LoginResponse(BaseModel):
    expires_at: str
    user: UserResponse


class LogoutResponse(BaseModel):
    ok: Literal[True] = True
