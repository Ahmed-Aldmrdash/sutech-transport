"""Initialize the migration history.

Revision ID: 20261116_0001
Revises:
Create Date: 2026-11-16
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "20261116_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
