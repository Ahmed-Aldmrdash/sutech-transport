from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SUTECH_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+asyncpg://sutech:sutech@localhost:5432/sutech_transport"
    cors_origins: list[str] = ["http://localhost:3000"]
    api_v1_prefix: str = "/api/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
