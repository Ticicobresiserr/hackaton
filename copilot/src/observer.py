"""Observer: monitors browser via Playwright Python, reports user actions to guide.

Test mode: no flows, just narrates what the user does.
"""
import asyncio
import logging
import os
import time
from typing import Callable, Awaitable
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from src.config import OBSERVER_INTERVAL, IDLE_THRESHOLD, PROJECT_DIR

LISTENERS_JS = os.path.join(os.path.dirname(__file__), "listeners.js")

log = logging.getLogger(__name__)


class Observer:
    """Observes browser via Playwright Python. Reports user actions."""

    def __init__(self, on_signal: Callable[[dict], Awaitable[None]]):
        self._on_signal = on_signal
        self._playwright = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._running = False
        self._last_url: str = ""
        self._last_event_ts: float = time.time()

    async def start(self):
        """Launch browser with listeners."""
        await self._cleanup()
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=False)
        self._context = await self._browser.new_context()
        await self._context.add_init_script(path=LISTENERS_JS)
        self._page = await self._context.new_page()
        log.info("Observer started (Playwright direct)")

    async def _cleanup(self):
        """Clean up existing browser resources."""
        self._running = False
        try:
            if self._browser:
                await self._browser.close()
        except Exception:
            pass
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
        self._browser = None
        self._context = None
        self._page = None
        self._playwright = None

    async def stop(self):
        await self._cleanup()
        log.info("Observer stopped")

    def is_alive(self) -> bool:
        """Check if browser and page are still usable."""
        try:
            if not self._browser or not self._browser.is_connected():
                return False
            if not self._page or self._page.is_closed():
                return False
            return True
        except Exception:
            return False

    async def ensure_alive(self):
        """Restart browser if it was closed."""
        if not self.is_alive():
            log.info("Browser not usable, restarting...")
            await self.start()

    @property
    def cdp_url(self) -> str | None:
        """CDP WebSocket URL for the guide to connect to this browser."""
        if self._browser:
            try:
                return self._browser._impl_obj._browser.ws_endpoint
            except Exception:
                return None
        return None

    async def authenticate(self, session_cookie: str):
        await self._context.add_cookies([{
            "name": "better-auth.session_token",
            "value": session_cookie,
            "domain": "localhost",
            "path": "/",
        }])
        log.info("Auth cookie set")

    async def navigate_to(self, url: str):
        log.info(f"Navigating to {url}")
        await self._page.goto(url)
        await self._page.wait_for_load_state("networkidle")
        self._last_url = self._page.url
        log.info(f"Navigated to {self._page.url}")

    async def drain_events(self) -> list:
        try:
            events = await self._page.evaluate("""() => {
                const events = window.__copilot?.events || [];
                window.__copilot.events = [];
                return events;
            }""")
            return events if isinstance(events, list) else []
        except Exception as e:
            log.warning(f"drain error: {e}")
            return []

    async def run_loop(self):
        """Main loop: drain events, report to guide."""
        self._running = True
        self._last_event_ts = time.time()
        log.info(f"Observer loop started (interval={OBSERVER_INTERVAL}s)")

        while self._running:
            try:
                events = await self.drain_events()
                current_url = self._page.url
                url_changed = current_url != self._last_url

                # Detect URL change even if events were lost (page reload clears JS buffer)
                if url_changed and not events:
                    self._last_event_ts = time.time()
                    self._last_url = current_url
                    await self._on_signal({
                        "type": "user_activity",
                        "actions": [f"navegó a {current_url}"],
                        "current_url": current_url,
                        "page_title": await self._page.title(),
                        "url_changed": True,
                    })
                elif events:
                    self._last_event_ts = time.time()

                    # Build a human-readable summary of what happened
                    actions = []
                    for e in events:
                        if e.get("type") == "click":
                            text = e.get("text", "").strip()[:40]
                            tag = e.get("tag", "")
                            href = e.get("href", "")
                            if text:
                                actions.append(f"click en '{text}' ({tag})")
                            elif href:
                                actions.append(f"click en link ({href})")
                            else:
                                actions.append(f"click en {tag}")
                        elif e.get("type") == "navigate":
                            actions.append(f"navegó a {e.get('url', '?')}")
                        elif e.get("type") == "submit":
                            actions.append(f"envió formulario")

                    if actions:
                        self._last_url = current_url
                        await self._on_signal({
                            "type": "user_activity",
                            "actions": actions,
                            "current_url": current_url,
                            "page_title": await self._page.title(),
                            "url_changed": url_changed,
                        })
                else:
                    idle = time.time() - self._last_event_ts
                    if idle > IDLE_THRESHOLD:
                        await self._on_signal({
                            "type": "user_idle",
                            "idle_seconds": int(idle),
                            "current_url": current_url,
                        })
                        self._last_event_ts = time.time()

            except Exception as e:
                log.error(f"Observer loop error: {e}", exc_info=True)

            await asyncio.sleep(OBSERVER_INTERVAL)
