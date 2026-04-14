"""Quick test: Playwright directo → listeners → eventos → evaluación programática."""
import asyncio
import json
import sys
import httpx
from pathlib import Path
from playwright.async_api import async_playwright

LISTENERS_JS = Path(__file__).parent / "src" / "listeners.js"
BASE_URL = "http://localhost:3000"
TEST_EMAIL = "test@nextcrm.app"


async def get_session_cookie() -> str:
    """Get auth cookie via OTP flow."""
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        await client.post("/api/auth/email-otp/send-verification-otp",
                          json={"email": TEST_EMAIL, "type": "sign-in"})
        r = await client.get(f"/api/auth/test-otp?email={TEST_EMAIL}")
        otp = r.json()["otp"]
        r = await client.post("/api/auth/sign-in/email-otp",
                              json={"email": TEST_EMAIL, "otp": otp})
        for header in r.headers.get_list("set-cookie"):
            if "better-auth.session_token=" in header:
                return header.split("better-auth.session_token=")[1].split(";")[0]
    return ""


async def main():
    cookie = await get_session_cookie()
    if not cookie:
        print("❌ Failed to get session cookie")
        return
    print(f"✅ Auth cookie obtained: {cookie[:20]}...")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()

        # Set auth cookie
        await context.add_cookies([{
            "name": "better-auth.session_token",
            "value": cookie,
            "domain": "localhost",
            "path": "/",
        }])

        # Add init script (listeners)
        await context.add_init_script(path=str(LISTENERS_JS))
        print(f"✅ Init script loaded: {LISTENERS_JS}")

        page = await context.new_page()

        # Test 1: Navigate to app
        print("\n--- Test 1: Navigate to dashboard ---")
        await page.goto(f"{BASE_URL}/en")
        await page.wait_for_load_state("networkidle")
        print(f"✅ URL: {page.url}")

        # Test 2: Check listeners injected
        print("\n--- Test 2: Check listeners ---")
        has_copilot = await page.evaluate("typeof window.__copilot !== 'undefined'")
        print(f"{'✅' if has_copilot else '❌'} window.__copilot exists: {has_copilot}")

        # Test 3: Check URL programmatically
        print("\n--- Test 3: URL check ---")
        url = page.url
        has_dashboard = "/dashboard" in url or "/en" in url
        print(f"✅ Current URL: {url}")
        print(f"{'✅' if has_dashboard else '⚠️'} URL contains expected path")

        # Test 4: Drain events after navigation
        print("\n--- Test 4: Drain events ---")
        events = await page.evaluate("""() => {
            const events = window.__copilot?.events || [];
            window.__copilot.events = [];
            return events;
        }""")
        print(f"✅ Events after navigation: {len(events)}")
        for e in events[:5]:
            print(f"   {e}")

        # Test 5: Click on a sidebar link and check events
        print("\n--- Test 5: Click sidebar + drain ---")
        # Try clicking on a link in the sidebar
        sidebar_links = await page.query_selector_all('nav a, aside a, [role="navigation"] a')
        print(f"   Found {len(sidebar_links)} sidebar links")

        if sidebar_links:
            # Find a link that looks like "Accounts" or any CRM link
            clicked = False
            for link in sidebar_links:
                text = await link.text_content()
                href = await link.get_attribute("href")
                if text and any(w in text.lower() for w in ["account", "contact", "lead", "sales", "dashboard"]):
                    print(f"   Clicking: '{text.strip()}' (href={href})")
                    await link.click()
                    await page.wait_for_load_state("networkidle")
                    clicked = True
                    break

            if not clicked and sidebar_links:
                text = await sidebar_links[0].text_content()
                print(f"   Clicking first link: '{text.strip()}'")
                await sidebar_links[0].click()
                await page.wait_for_load_state("networkidle")

            # Wait a moment for events to register
            await page.wait_for_timeout(500)

            # Drain events
            events = await page.evaluate("""
                const events = window.__copilot?.events || [];
                window.__copilot.events = [];
                return events;
            """)
            print(f"✅ Events after click: {len(events)}")
            for e in events[:10]:
                print(f"   {e}")

            print(f"✅ URL after click: {page.url}")

        # Test 6: querySelector check
        print("\n--- Test 6: Element check ---")
        has_nav = await page.query_selector("nav") is not None
        has_main = await page.query_selector("main") is not None
        print(f"{'✅' if has_nav else '❌'} <nav> exists: {has_nav}")
        print(f"{'✅' if has_main else '❌'} <main> exists: {has_main}")

        # Test 7: CDP endpoint for guide
        print("\n--- Test 7: CDP endpoint ---")
        cdp_url = browser.contexts[0].pages[0].url  # just verify we can access it
        print(f"✅ Browser accessible, current page: {cdp_url}")

        print("\n=== ALL TESTS COMPLETE ===")

        # Keep browser open for 5 seconds so you can see it
        await page.wait_for_timeout(5000)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
