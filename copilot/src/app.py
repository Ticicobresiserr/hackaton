"""FastAPI + WebSocket — Copilot Agent with flow-based guidance."""
import asyncio
import json
import logging
import sys
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.config import PROJECT_DIR, IDLE_THRESHOLD, OBSERVER_INTERVAL
from src.engine import GuideEngine
from src.observer import Observer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

app = FastAPI(title="Copilot Agent")

FLOWS_DIR = Path(PROJECT_DIR) / "flows"
STATIC_DIR = Path(PROJECT_DIR) / "static"

# Global state
guide: GuideEngine | None = None
observer: Observer | None = None
active_ws: WebSocket | None = None
observer_task: asyncio.Task | None = None


def load_onboarding_program() -> dict | None:
    """Load the onboarding program JSON."""
    for f in FLOWS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            if "flows" in data and "platformName" in data:
                return data
        except (json.JSONDecodeError, OSError):
            continue
    return None


async def push_to_chat(text: str):
    if active_ws:
        try:
            await active_ws.send_json({"type": "assistant", "text": text})
        except Exception as e:
            log.warning(f"Push failed: {e}")


async def on_signal(signal: dict):
    """Observer detected user activity — guide decides what to say."""
    sig_type = signal.get("type")
    log.info(f"Signal: {sig_type}, actions={signal.get('actions', [])[:3]}")

    if not guide:
        return

    if sig_type == "user_activity":
        response = await guide.handle_activity(signal)
        # Clean markers before sending to user
        clean = response.replace("[STEP_DONE]", "").replace("[FLOW_DONE]", "").strip()
        if clean:
            await push_to_chat(clean)

    elif sig_type == "user_idle":
        response = await guide.handle_idle(
            signal.get("idle_seconds", 0),
            signal.get("current_url", ""),
        )
        clean = response.replace("[STEP_DONE]", "").replace("[FLOW_DONE]", "").strip()
        if clean:
            await push_to_chat(clean)


@app.on_event("startup")
async def startup():
    global observer
    log.info("Starting Observer (Playwright)...")
    observer = Observer(on_signal=on_signal)
    await observer.start()
    log.info("Observer ready")


@app.on_event("shutdown")
async def shutdown():
    if observer_task and not observer_task.done():
        observer_task.cancel()
    if observer:
        await observer.stop()
    if guide:
        await guide.disconnect()


@app.get("/api/flows")
async def list_flows():
    program = load_onboarding_program()
    if not program:
        return []
    return [
        {"id": f["id"], "name": f["name"], "description": f.get("description", "")}
        for f in program.get("flows", [])
    ]


@app.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    global active_ws, observer_task, guide
    await ws.accept()
    active_ws = ws
    log.info("WebSocket connected")

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "start_flow":
                flow_id = data.get("flowId", "")
                log.info(f"Starting flow: {flow_id}")

                program = load_onboarding_program()
                if not program:
                    await ws.send_json({"type": "error", "text": "No onboarding program found"})
                    continue

                flow = next((f for f in program["flows"] if f["id"] == flow_id), None)
                if not flow:
                    await ws.send_json({"type": "error", "text": f"Flow '{flow_id}' not found"})
                    continue

                # Cancel previous observation
                if observer_task and not observer_task.done():
                    observer_task.cancel()

                # Ensure browser is alive
                await observer.ensure_alive()

                # Figure out target URL from flow steps
                first_page = flow["steps"][0].get("page", "/")
                # Infer base URL — taskflow-demo runs on 5173
                target_url = "http://localhost:5173"

                # Navigate
                await observer.navigate_to(target_url + first_page)

                # Connect guide with CDP to observer's browser
                cdp_url = observer.cdp_url
                log.info(f"CDP URL: {cdp_url}")
                if guide:
                    await guide.disconnect()
                guide = GuideEngine(cdp_url=cdp_url)
                await guide.connect()

                # Start observation loop
                observer_task = asyncio.create_task(observer.run_loop())

                # Tell guide about the flow
                current_url = observer._page.url if observer._page else target_url
                response = await guide.start_flow(flow, current_url)
                clean = response.replace("[STEP_DONE]", "").replace("[FLOW_DONE]", "").strip()
                await ws.send_json({"type": "assistant", "text": clean})

            elif msg_type == "message":
                text = data.get("text", "")
                if not text:
                    continue
                if not guide:
                    await ws.send_json({"type": "error", "text": "Arrancá un flow primero"})
                    continue
                response = await guide.send(text)
                clean = response.replace("[STEP_DONE]", "").replace("[FLOW_DONE]", "").strip()
                await ws.send_json({"type": "assistant", "text": clean})

    except WebSocketDisconnect:
        log.info("WebSocket disconnected")
        active_ws = None
    except Exception as e:
        log.error(f"WebSocket error: {e}", exc_info=True)
        active_ws = None


@app.get("/")
async def root():
    return FileResponse(STATIC_DIR / "index.html")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
