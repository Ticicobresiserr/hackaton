"""Helper to create an authenticated session in NextCRM for the demo."""
import httpx
import logging

log = logging.getLogger(__name__)

TEST_EMAIL = "test@nextcrm.app"


async def get_session_cookie(base_url: str = "http://localhost:3000") -> str | None:
    """Login via OTP flow and return the session cookie value.

    Uses Better Auth's emailOTP + testUtils plugin (dev mode only).
    Returns the cookie value for 'better-auth.session_token'.
    """
    async with httpx.AsyncClient(base_url=base_url) as client:
        # 1. Send OTP
        r = await client.post(
            "/api/auth/email-otp/send-verification-otp",
            json={"email": TEST_EMAIL, "type": "sign-in"},
        )
        if not r.is_success:
            log.error(f"Failed to send OTP: {r.status_code} {r.text}")
            return None

        # 2. Capture OTP from testUtils
        r = await client.get(f"/api/auth/test-otp?email={TEST_EMAIL}")
        if not r.is_success:
            log.error(f"Failed to get OTP: {r.status_code}")
            return None
        otp = r.json().get("otp")

        # 3. Sign in with OTP
        r = await client.post(
            "/api/auth/sign-in/email-otp",
            json={"email": TEST_EMAIL, "otp": otp},
        )
        if not r.is_success:
            log.error(f"Failed to sign in: {r.status_code} {r.text}")
            return None

        # Extract cookie from response
        cookie = r.cookies.get("better-auth.session_token")
        if cookie:
            log.info(f"Session cookie obtained for {TEST_EMAIL}")
            return cookie

        # Fallback: parse from set-cookie header
        for header in r.headers.get_list("set-cookie"):
            if "better-auth.session_token=" in header:
                value = header.split("better-auth.session_token=")[1].split(";")[0]
                log.info(f"Session cookie obtained from header for {TEST_EMAIL}")
                return value

        log.error("No session cookie found in response")
        return None
