import json
from pathlib import Path


def load_flows(flows_dir: str | Path) -> list[dict]:
    """Lee todos los flow JSON de un directorio."""
    flows_dir = Path(flows_dir)
    if not flows_dir.exists():
        return []
    flows = []
    for f in sorted(flows_dir.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            flows.append(json.loads(f.read_text()))
        except (json.JSONDecodeError, OSError):
            continue
    return flows


def load_flow(flows_dir: str | Path, flow_id: str) -> dict | None:
    """Carga un flow específico por ID."""
    for flow in load_flows(flows_dir):
        if flow.get("id") == flow_id:
            return flow
    return None
