"""Create a disposable SQLite auth database from the frontend's fake accounts."""

import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionFactory, engine
from app.modules.auth.models import Account, AuthSession, OTP  # noqa: F401 - register tables
from app.modules.auth.service import normalize_identifier

# These are existing made-up records from frontend/src/features/auth/mock-accounts.ts.
DEMO_ACCOUNTS = [
    {
        "identifier": "240100101",
        "phone": "01000001001",
        "name": "Ziad Tamer Nour",
        "name_ar": "زياد تامر نور",
        "role": "student",
        "faculty": "Artificial Intelligence & Data Science Technology Program",
        "faculty_ar": "برنامج تكنولوجيا الذكاء الاصطناعي وعلوم البيانات",
        "level": 3,
        "guardian_name": "Tamer Nour",
        "guardian_name_ar": "تامر نور",
        "is_active": True,
    },
    {
        "identifier": "ADM-1001",
        "phone": "01000003100",
        "name": "Mariam Hassan",
        "name_ar": "مريم حسن",
        "role": "super_admin",
        "is_active": True,
    },
    {
        "identifier": "01000002000",
        "phone": "01000002000",
        "name": "Tamer Nour",
        "name_ar": "تامر نور",
        "role": "parent",
        "is_active": True,
    },
    {
        "identifier": "DRV-1001",
        "phone": "01000004008",
        "name": "Kamal Ezzat",
        "name_ar": "كمال عزت",
        "role": "driver",
        "is_active": True,
    },
    {
        "identifier": "240100000",
        "phone": "01000009999",
        "name": "Disabled Student",
        "name_ar": "طالب موقوف",
        "role": "student",
        "is_active": False,
    },
]


async def main() -> None:
    if not settings.database_url.startswith("sqlite+aiosqlite:///"):
        raise SystemExit("For safety, set SUTECH_DATABASE_URL to a local sqlite+aiosqlite database first.")
    if settings.environment not in {"development", "test"}:
        raise SystemExit("Demo accounts can only be loaded in development or test mode.")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with SessionFactory() as session:
        for values in DEMO_ACCOUNTS:
            key = normalize_identifier(values["identifier"])
            account = await session.scalar(
                select(Account).where(Account.identifier_key == key)
            )
            if account is None:
                account = Account(**values, identifier_key=key)
                session.add(account)
            else:
                for name, value in values.items():
                    setattr(account, name, value)
        await session.commit()

    print("Loaded 5 fake accounts from the existing frontend auth fixtures.")
    print("Try identifiers: 240100101 (student), ADM-1001 (office), 01000002000 (parent), DRV-1001 (driver).")
    print("The disabled-account fixture 240100000 should return ACCOUNT_DISABLED.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
