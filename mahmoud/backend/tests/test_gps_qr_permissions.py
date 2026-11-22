import unittest

from app.security.gps import GPSAuthError, sign_gps_request, verify_gps_request
from app.security.csrf import CSRFError, validate_browser_origin
from app.security.permissions import (
    ForbiddenRole,
    HiddenSOS,
    authorize_operation,
    authorize_role,
    authorize_sos_action,
    authorize_sos_visibility,
)
from app.security.qr import QRTokenError, issue_qr_token, verify_qr_token

SECRET = "local-test-secret-with-at-least-32-bytes"


class PermissionTests(unittest.TestCase):
    def test_endpoint_roles_match_sensitive_contract_rules(self) -> None:
        self.assertEqual(authorize_operation("sos.create", "driver"), "driver")
        self.assertEqual(authorize_operation("emergencies.addAction", "clinic"), "clinic")
        with self.assertRaises(ForbiddenRole):
            authorize_operation("emergencies.addAction", "super_admin")
        with self.assertRaises(ForbiddenRole):
            authorize_role("student", {"transport_admin"})

    def test_sos_access_and_state_transitions_follow_contract(self) -> None:
        self.assertEqual(
            authorize_sos_visibility(role="clinic", sos_type="accident"), "clinic"
        )
        with self.assertRaises(HiddenSOS):
            authorize_sos_visibility(role="clinic", sos_type="breakdown")
        with self.assertRaises(HiddenSOS):
            authorize_sos_visibility(role="driver", sos_type="medical")
        with self.assertRaises(HiddenSOS):
            authorize_sos_action(
                role="clinic",
                sos_type="breakdown",
                current_status="open",
                action="acknowledge",
                note=None,
            )
        self.assertEqual(
            authorize_sos_action(
                role="transport_admin",
                sos_type="breakdown",
                current_status="open",
                action="acknowledge",
                note=None,
            ),
            "acknowledged",
        )
        with self.assertRaisesRegex(ValueError, "NOTE_REQUIRED"):
            authorize_sos_action(
                role="clinic",
                sos_type="medical",
                current_status="acknowledged",
                action="close",
                note="  ",
            )
        with self.assertRaises(ForbiddenRole):
            authorize_sos_action(
                role="super_admin",
                sos_type="medical",
                current_status="open",
                action="acknowledge",
                note=None,
            )


class CSRFOriginTests(unittest.TestCase):
    def test_only_configured_or_same_api_origin_is_accepted(self) -> None:
        self.assertEqual(
            validate_browser_origin(
                origin="http://localhost:3000",
                referer=None,
                allowed_origins=["http://localhost:3000"],
                request_origin="http://127.0.0.1:8000",
            ),
            "http://localhost:3000",
        )
        self.assertEqual(
            validate_browser_origin(
                origin="http://127.0.0.1:8000",
                referer=None,
                allowed_origins=["http://localhost:3000"],
                request_origin="http://127.0.0.1:8000",
            ),
            "http://127.0.0.1:8000",
        )
        with self.assertRaises(CSRFError):
            validate_browser_origin(
                origin="https://attacker.example",
                referer=None,
                allowed_origins=["http://localhost:3000"],
                request_origin="http://127.0.0.1:8000",
            )
        with self.assertRaises(CSRFError):
            validate_browser_origin(
                origin=None,
                referer=None,
                allowed_origins=["http://localhost:3000"],
                request_origin="http://127.0.0.1:8000",
            )


class QRTokenTests(unittest.TestCase):
    def setUp(self) -> None:
        self.token, self.expires_at = issue_qr_token(
            subscription_id="sub_123",
            student_id="usr_123",
            line_id="line_5",
            secret=SECRET,
            now=1_000,
        )

    def test_signed_qr_is_valid_for_thirty_seconds_and_carries_trip_scope(self) -> None:
        claims = verify_qr_token(self.token, secret=SECRET, now=1_029)
        self.assertEqual(self.expires_at, 1_030)
        self.assertEqual(claims["student_id"], "usr_123")
        self.assertEqual(claims["line_id"], "line_5")
        self.assertTrue(claims["jti"])

    def test_qr_expires_and_tampering_is_rejected(self) -> None:
        with self.assertRaises(QRTokenError):
            verify_qr_token(self.token, secret=SECRET, now=1_030)
        tampered = self.token[:-1] + ("A" if self.token[-1] != "A" else "B")
        with self.assertRaises(QRTokenError):
            verify_qr_token(tampered, secret=SECRET, now=1_001)


class GPSRequestAuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.body = b'{"lat":30.0,"lng":31.0,"recorded_at":"2026-11-22T10:00:00Z"}'
        self.signature = sign_gps_request(
            device_id="gps_bus_7",
            secret=SECRET,
            method="POST",
            path="/api/v1/gps/ingest",
            timestamp="1000",
            nonce="aBcDeFgHiJkLmNoP",
            body=self.body,
        )

    def test_valid_signed_gps_request_is_accepted(self) -> None:
        verify_gps_request(
            device_id="gps_bus_7",
            secret=SECRET,
            method="POST",
            path="/api/v1/gps/ingest",
            timestamp="1000",
            nonce="aBcDeFgHiJkLmNoP",
            signature=self.signature,
            body=self.body,
            now=1_000,
        )

    def test_gps_body_tampering_stale_time_and_replay_are_rejected(self) -> None:
        common = {
            "device_id": "gps_bus_7",
            "secret": SECRET,
            "method": "POST",
            "path": "/api/v1/gps/ingest",
            "timestamp": "1000",
            "nonce": "aBcDeFgHiJkLmNoP",
            "signature": self.signature,
            "body": self.body + b" ",
            "now": 1_000,
        }
        with self.assertRaises(GPSAuthError):
            verify_gps_request(**common)
        with self.assertRaises(GPSAuthError):
            verify_gps_request(**{**common, "body": self.body, "now": 1_061})
        with self.assertRaises(GPSAuthError):
            verify_gps_request(**{**common, "body": self.body, "nonce_already_used": True})


if __name__ == "__main__":
    unittest.main()
