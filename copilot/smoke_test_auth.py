"""Smoke test: authenticate + navigate to NextCRM dashboard + snapshot."""
import asyncio
import logging
import sys

from claude_code_sdk import (
    ClaudeSDKClient,
    ClaudeCodeOptions,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)
from src.auth_helper import get_session_cookie

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s", stream=sys.stdout)
log = logging.getLogger(__name__)


async def main():
    # Step 1: Get session cookie via API
    log.info("Getting session cookie via OTP flow...")
    cookie = await get_session_cookie()
    if not cookie:
        log.error("Failed to get session cookie. Is NextCRM running on localhost:3000?")
        return
    log.info(f"Got cookie: {cookie[:20]}...")

    # Step 2: Spawn Claude Code with Playwright MCP
    log.info("Creating Claude Code client with Playwright MCP...")
    opts = ClaudeCodeOptions(
        append_system_prompt="You have Playwright MCP. Use browser tools.",
        permission_mode="bypassPermissions",
        cwd="/Users/pabloolmi/repos/copilot",
        model="sonnet",
        mcp_servers={
            "playwright": {
                "command": "npx",
                "args": [
                    "@playwright/mcp@latest",
                    "--init-script", "src/listeners.js",
                ],
            }
        },
    )

    client = ClaudeSDKClient(opts)
    await client.connect()
    log.info("Client connected")

    # Step 3: Navigate and set cookie
    log.info("Setting cookie and navigating to dashboard...")
    await client.query(
        f"Seguí estos pasos exactos:\n"
        f"1. browser_navigate a http://localhost:3000\n"
        f"2. browser_evaluate: document.cookie = 'better-auth.session_token={cookie}; path=/; max-age=604800';\n"
        f"3. browser_navigate a http://localhost:3000/en\n"
        f"4. browser_snapshot y describí lo que ves"
    )

    async for msg in client.receive_response():
        if msg is None:
            continue
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    print(f"\n📝 {block.text[:800]}")
                elif isinstance(block, ToolUseBlock):
                    print(f"🔧 {block.name}")
        elif isinstance(msg, ResultMessage):
            cost = getattr(msg, "total_cost_usd", None)
            print(f"\n✅ DONE — cost: ${cost}, turns: {msg.num_turns}")

    await client.disconnect()
    log.info("Smoke test complete")


if __name__ == "__main__":
    asyncio.run(main())
