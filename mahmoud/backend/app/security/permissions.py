"""Role names and reusable server-side role authorization."""

from collections.abc import Iterable
import json
from pathlib import Path

ALL_ROLES = frozenset(
    {
        "super_admin",
        "transport_admin",
        "finance",
        "clinic",
        "student_affairs",
        "secretary_general",
        "bus_company",
        "driver",
        "supervisor",
        "student",
        "parent",
    }
)


class ForbiddenRole(PermissionError):
    """Raised when an authenticated role is outside an endpoint's allow-list."""


class HiddenSOS(LookupError):
    """An SOS is deliberately reported as missing when the caller cannot view it."""


def authorize_role(role: str, allowed_roles: Iterable[str]) -> str:
    allowed = frozenset(allowed_roles)
    if not allowed or not allowed <= ALL_ROLES:
        raise ValueError("allowed_roles must contain known roles")
    if role not in ALL_ROLES or role not in allowed:
        raise ForbiddenRole("Role is not permitted for this operation")
    return role


def _load_endpoint_roles() -> dict[str, frozenset[str]]:
    source = Path(__file__).with_name("endpoint_roles.json")
    values = json.loads(source.read_text(encoding="utf-8-sig"))
    policies = {operation: frozenset(roles) for operation, roles in values.items()}
    unknown = {role for roles in policies.values() for role in roles} - ALL_ROLES
    if unknown:
        raise RuntimeError(f"Unknown roles in endpoint policy: {sorted(unknown)}")
    return policies


# Generated from the frontend API contract. Resource ownership checks (own data, linked
# children, assigned trip) still have to run inside each service/query.
ENDPOINT_ROLES = _load_endpoint_roles()
SOS_TYPES = frozenset({"medical", "breakdown", "accident"})
SOS_ADMIN_VIEW_ROLES = frozenset({"super_admin", "transport_admin"})
SOS_CLINIC_TYPES = frozenset({"medical", "accident"})
SOS_ACTION_ROLES = frozenset({"transport_admin", "clinic"})
SOS_ACTIONS = frozenset({"acknowledge", "ambulance_called", "note", "close"})


def authorize_operation(operation_id: str, role: str) -> str:
    try:
        allowed = ENDPOINT_ROLES[operation_id]
    except KeyError as exc:
        raise ValueError(f"No role policy registered for {operation_id}") from exc
    if not allowed:
        raise ValueError(f"{operation_id} is public and does not require an authenticated role")
    return authorize_role(role, allowed)


def authorize_sos_visibility(
    *,
    role: str,
    sos_type: str,
    is_trip_crew: bool = False,
) -> str:
    """Enforce SOS visibility, including the clinic's type restriction."""
    if sos_type not in SOS_TYPES:
        raise ValueError("Unknown SOS type")
    if role in SOS_ADMIN_VIEW_ROLES:
        return role
    if role == "clinic" and sos_type in SOS_CLINIC_TYPES:
        return role
    if role in {"driver", "supervisor"}:
        if is_trip_crew:
            return role
        raise HiddenSOS("SOS was not found")
    if role == "clinic":
        raise HiddenSOS("SOS was not found")
    raise ForbiddenRole("SOS is not visible to this account")


def authorize_sos_action(
    *,
    role: str,
    sos_type: str,
    current_status: str,
    action: str,
    note: str | None,
) -> str:
    """Check SOS action role, type, and immutable status-transition rules."""
    authorize_role(role, SOS_ACTION_ROLES)
    if sos_type not in SOS_TYPES:
        raise ValueError("Unknown SOS type")
    if role == "clinic" and sos_type not in SOS_CLINIC_TYPES:
        raise ForbiddenRole("Clinic cannot access breakdown alerts")
    if action not in SOS_ACTIONS:
        raise ValueError("Unknown SOS action")
    if current_status == "closed":
        raise ValueError("SOS_CLOSED")
    if action == "acknowledge":
        if current_status != "open":
            raise ValueError("ALREADY_ACKNOWLEDGED")
    elif current_status != "acknowledged":
        raise ValueError("SOS_NOT_ACKNOWLEDGED")
    if action in {"note", "close"} and not (note and note.strip()):
        raise ValueError("NOTE_REQUIRED")
    return "closed" if action == "close" else "acknowledged"
