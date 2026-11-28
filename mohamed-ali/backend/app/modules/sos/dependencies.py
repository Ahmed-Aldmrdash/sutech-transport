"""Dependencies for the SOS module's integration boundary."""

from fastapi import HTTPException, Request

from app.modules.sos.gateway import SOSGateway


def get_sos_gateway(request: Request) -> SOSGateway:
    """Return the operations adapter installed by the shared application."""
    gateway = getattr(request.app.state, "sos_gateway", None)
    if gateway is None:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "SOS_INTEGRATION_UNAVAILABLE",
                "message": "Trip and GPS services are not connected yet",
            },
        )
    return gateway
