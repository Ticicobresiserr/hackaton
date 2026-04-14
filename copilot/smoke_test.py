"""Smoke test: spawn Claude Code with Playwright MCP, navigate to a URL, take snapshot."""
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s", stream=sys.stdout)
log = logging.getLogger(__name__)


async def main():
    log.info("Creating Claude Code client with Playwright MCP...")
    opts = ClaudeCodeOptions(
        append_system_prompt="You have Playwright MCP. Use browser_navigate and browser_snapshot.",
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

    log.info("Sending: navigate to localhost:3000 and take a snapshot...")
    await client.query(
        "Usá browser_navigate para ir a http://localhost:3000 "
        "y después usá browser_snapshot para ver qué hay en la página. "
        "Describí brevemente lo que ves."
    )

    async for msg in client.receive_response():
        if msg is None:
            continue
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    print(f"\n📝 RESPONSE: {block.text[:500]}")
                elif isinstance(block, ToolUseBlock):
                    print(f"🔧 TOOL: {block.name}")
        elif isinstance(msg, ResultMessage):
            cost = getattr(msg, "total_cost_usd", None)
            print(f"\n✅ DONE — cost: ${cost}, turns: {msg.num_turns}")

    await client.disconnect()
    log.info("Smoke test complete")


if __name__ == "__main__":
    asyncio.run(main())
