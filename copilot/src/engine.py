"""Guide Engine: guides user through training flows based on observer activity signals.

Uses Claude Code SDK (Opus) with Playwright MCP connected to the observer's browser
via CDP endpoint. Can do browser_snapshot when it needs visual context.
"""
import asyncio
import logging
import time

from claude_code_sdk import (
    ClaudeSDKClient,
    ClaudeCodeOptions,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)

from src.config import GUIDE_MODEL, PROJECT_DIR

log = logging.getLogger(__name__)

GUIDE_SYSTEM_PROMPT = """\
Sos un copilot de entrenamiento. Tu trabajo es guiar al usuario paso a paso
a través de training flows en una aplicación web.

## Cómo funciona
- Recibís un onboarding program con múltiples flows, cada uno con pasos ordenados
- Recibís reportes de actividad del usuario (clicks, navegaciones) con la URL actual
- Vos decidís si el usuario completó el paso actual o no
- Podés usar browser_snapshot para ver la pantalla cuando necesitás contexto visual

## Cómo guiás
- Sé conciso: 1-2 oraciones por respuesta
- Referenciá elementos concretos que ves en la pantalla
- Si el usuario completó un paso, felicitalo brevemente y dá el siguiente
- Si se desvió, guialo de vuelta amablemente
- Si está trabado (sin actividad), ofrecé una pista

## Seguimiento de progreso
- Llevás el tracking mental de en qué flow y paso está el usuario
- Cuando recibís [ACTIVIDAD], evaluá si eso completa el paso actual
- Si necesitás ver la pantalla para decidir, usá browser_snapshot
- Cuando el usuario completa un paso, indicalo con [STEP_DONE] al final de tu mensaje
- Cuando completa todos los pasos de un flow, indicá [FLOW_DONE]

## Reglas
1. Podés usar browser_snapshot cuando necesités ver la pantalla
2. No uses browser_click ni browser_fill — el usuario navega solo
3. Hablá en español casual
4. Máximo 2-3 oraciones por respuesta
5. No repitas instrucciones que ya diste — si el usuario sigue en el mismo paso, ofrecé pistas nuevas
"""


class GuideEngine:
    """Guides user through training flows. Connected to browser via Playwright MCP."""

    def __init__(self, model: str | None = None, cwd: str | None = None, cdp_url: str | None = None):
        self.model = model or GUIDE_MODEL
        self.cwd = cwd or PROJECT_DIR
        self.cdp_url = cdp_url
        self._client: ClaudeSDKClient | None = None
        self._connected = False
        self._lock = asyncio.Lock()

    def _make_options(self) -> ClaudeCodeOptions:
        opts = dict(
            append_system_prompt=GUIDE_SYSTEM_PROMPT,
            permission_mode="bypassPermissions",
            cwd=self.cwd,
            model=self.model,
        )
        if self.cdp_url:
            opts["mcp_servers"] = {
                "playwright": {
                    "command": "npx",
                    "args": [
                        "@playwright/mcp@latest",
                        "--cdp-endpoint", self.cdp_url,
                    ],
                }
            }
        return ClaudeCodeOptions(**opts)

    async def connect(self):
        if self._connected:
            return
        try:
            self._client = ClaudeSDKClient(self._make_options())
            await self._client.connect()
            self._connected = True
            log.info(f"GuideEngine connected (model={self.model}, cdp={bool(self.cdp_url)})")
        except Exception as e:
            log.error(f"GuideEngine connect failed: {e}")
            self._client = None
            self._connected = False

    async def disconnect(self):
        if self._client:
            try:
                transport = getattr(self._client, '_transport', None)
                if transport:
                    proc = getattr(transport, '_process', None)
                    if proc and proc.returncode is None:
                        proc.terminate()
                await asyncio.wait_for(self._client.disconnect(), timeout=3)
            except Exception:
                pass
            self._client = None
            self._connected = False

    async def send(self, message: str) -> str:
        async with self._lock:
            if not self._connected:
                await self.connect()
            t0 = time.time()
            try:
                await self._client.query(message)
                parts: list[str] = []
                async for msg in self._client.receive_response():
                    if msg is None:
                        continue
                    if isinstance(msg, AssistantMessage):
                        for block in msg.content:
                            if isinstance(block, TextBlock):
                                parts.append(block.text)
                            elif isinstance(block, ToolUseBlock):
                                log.info(f"  Guide tool: {block.name}")
                    elif isinstance(msg, ResultMessage):
                        cost = getattr(msg, "total_cost_usd", None)
                        log.info(f"Guide done: {time.time()-t0:.1f}s, cost=${cost}")
                return "".join(parts) or "(sin respuesta)"
            except Exception as e:
                log.error(f"Guide error: {e}")
                await self.disconnect()
                return f"Error: {e}"

    async def start_flow(self, flow: dict, current_url: str) -> str:
        """Tell the guide about a new flow to start."""
        import json
        flow_json = json.dumps(flow, ensure_ascii=False, indent=2)
        prompt = (
            f"[SISTEMA] Arrancamos un nuevo flow de entrenamiento.\n\n"
            f"Flow completo:\n```json\n{flow_json}\n```\n\n"
            f"El usuario está en: {current_url}\n\n"
            f"Presentate brevemente y guialo al primer paso."
        )
        return await self.send(prompt)

    async def handle_activity(self, signal: dict) -> str:
        """Observer reported user activity. Guide decides what to say."""
        actions = signal.get("actions", [])
        url = signal.get("current_url", "?")
        title = signal.get("page_title", "")
        url_changed = signal.get("url_changed", False)

        actions_text = ", ".join(actions[:5])
        prompt = f"[ACTIVIDAD] El usuario hizo: {actions_text}. URL actual: {url}"
        if title:
            prompt += f" (título: {title})"
        if url_changed:
            prompt += ". La URL cambió — si necesitás ver qué hay, usá browser_snapshot."
        prompt += "\n\n¿Completó el paso actual? Si sí, decile y pasá al siguiente. Si no, guialo."

        return await self.send(prompt)

    async def handle_idle(self, idle_seconds: int, current_url: str) -> str:
        """User hasn't done anything for a while."""
        prompt = (
            f"[SISTEMA] El usuario lleva {idle_seconds}s sin hacer nada. "
            f"URL actual: {current_url}. "
            f"Ofrecele una pista para el paso actual. Podés usar browser_snapshot si necesitás ver la pantalla."
        )
        return await self.send(prompt)
