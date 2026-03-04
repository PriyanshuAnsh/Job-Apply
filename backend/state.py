"""
Shared state for the agent process (singleton in this process).
"""
from datetime import datetime

agent_state: dict = {
    "state": "idle",       # idle | running | stopping | error
    "phase": "",
    "companies_found": 0,
    "jobs_found": 0,
    "applied": 0,
    "pending_review": 0,
    "errors": 0,
    "started_at": None,
    "config": {
        "role": "",
        "location": "Remote",
        "industries": [],
        "keywords": [],
        "exclude_keywords": [],
        "max_applications_per_run": 10,
        "auto_approve": False,
    },
}

# Log buffer: last 500 entries (in-memory, also persisted to DB via main router)
log_buffer: list[dict] = []


def log(message: str, level: str = "info"):
    """Append a log entry to the in-memory buffer."""
    t = datetime.utcnow().strftime("%H:%M:%S")
    entry = {"time": t, "level": level, "message": message}
    log_buffer.append(entry)
    if len(log_buffer) > 500:
        log_buffer.pop(0)
    print(f"[{level.upper()}] {t} — {message}")
