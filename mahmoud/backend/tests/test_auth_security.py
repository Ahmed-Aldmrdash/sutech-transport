import unittest

from app.modules.auth.security import (
    generate_otp,
    generate_session_token,
    hash_otp,
    hash_session_token,
    mask_phone,
    verify_otp,
)


class AuthSecurityTests(unittest.TestCase):
    def test_otp_is_four_digits_and_keeps_leading_zeroes(self) -> None:
        code = generate_otp()
        self.assertEqual(len(code), 4)
        self.assertTrue(code.isdigit())

    def test_otp_hash_accepts_only_the_matching_code(self) -> None:
        hashed = hash_otp("240100101", "0123", "test-secret")
        self.assertTrue(verify_otp("240100101", "0123", hashed, "test-secret"))
        self.assertFalse(verify_otp("240100101", "9999", hashed, "test-secret"))
        self.assertFalse(verify_otp("240100102", "0123", hashed, "test-secret"))

    def test_session_cookie_token_is_not_stored_as_its_hash(self) -> None:
        token = generate_session_token()
        self.assertGreaterEqual(len(token), 40)
        self.assertNotEqual(hash_session_token(token), token)
        self.assertEqual(len(hash_session_token(token)), 64)

    def test_phone_mask_keeps_only_the_first_and_last_three_digits(self) -> None:
        self.assertEqual(mask_phone("01000001001"), "010•••••001")


if __name__ == "__main__":
    unittest.main()
