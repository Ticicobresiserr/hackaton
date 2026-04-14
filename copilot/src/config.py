import os

GUIDE_MODEL = os.getenv("COPILOT_GUIDE_MODEL", "opus")
OBSERVER_MODEL = os.getenv("COPILOT_OBSERVER_MODEL", "sonnet")
OBSERVER_INTERVAL = int(os.getenv("COPILOT_OBSERVER_INTERVAL", "2"))
IDLE_THRESHOLD = int(os.getenv("COPILOT_IDLE_THRESHOLD", "30"))
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
