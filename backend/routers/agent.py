"""
FastAPI router: /api/agent/* endpoints
"""
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from database import get_session
from models import UserProfile
from state import agent_state, log_buffer, log
from agents.discovery import run_discovery
from agents.applicator import run_applications
import json

router = APIRouter(prefix="/agent")

# Background task handle
_agent_task: Optional[asyncio.Task] = None


@router.get("/status")
async def get_status():
    return agent_state


@router.post("/start")
async def start_agent(config: dict, session: AsyncSession = Depends(get_session)):
    global _agent_task
    if agent_state["state"] == "running":
        return {"ok": False, "message": "Agent already running"}

    # Merge config
    agent_state["config"].update(config)
    agent_state["state"] = "running"
    agent_state["phase"] = "Initializing…"
    agent_state["errors"] = 0
    log("Agent started", "success")

    # Load profile
    result = await session.execute(select(UserProfile))
    profile_row = result.scalars().first()
    profile = profile_row.model_dump() if profile_row else {}

    # Kick off background task
    loop = asyncio.get_event_loop()
    _agent_task = loop.create_task(_agent_run(dict(agent_state["config"]), profile))
    return {"ok": True}


@router.post("/stop")
async def stop_agent():
    global _agent_task
    if agent_state["state"] != "running":
        return {"ok": False, "message": "Agent is not running"}
    agent_state["state"] = "stopping"
    log("Stop requested — finishing current task…", "warning")
    if _agent_task and not _agent_task.done():
        _agent_task.cancel()
    agent_state["state"] = "idle"
    agent_state["phase"] = ""
    return {"ok": True}


@router.get("/logs")
async def get_recent_logs():
    return list(log_buffer[-100:])


@router.get("/log-stream")
async def log_stream():
    """Server-Sent Events stream of agent logs."""
    async def event_generator():
        last_sent = len(log_buffer)
        while agent_state["state"] == "running":
            if len(log_buffer) > last_sent:
                for entry in log_buffer[last_sent:]:
                    yield f"data: {json.dumps(entry)}\n\n"
                last_sent = len(log_buffer)
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


async def _agent_run(config: dict, profile: dict):
    """Main agent loop — runs in background."""
    import traceback
    from database import AsyncSessionLocal
    try:
        # Phase 1: Discovery — use its own session
        async with AsyncSessionLocal() as session:
            log("Phase 1: Company Discovery", "agent")
            companies, jobs = await run_discovery(session, config, profile)
            log(f"Discovery complete: {len(companies)} companies, {len(jobs)} jobs found", "success")

        if agent_state["state"] != "running":
            return

        # Phase 2: Applications — fresh session avoids stale identity map from Phase 1
        async with AsyncSessionLocal() as session:
            log("Phase 2: Application Preparation", "agent")
            apps = await run_applications(session, config, profile)
            log(f"Applications queued: {len(apps)} — check Applications page", "success")

        agent_state["phase"] = "Done — awaiting your review"
        agent_state["state"] = "idle"
        log("Agent cycle complete ✓", "success")

    except asyncio.CancelledError:
        log("Agent stopped by user", "warning")
        agent_state["state"] = "idle"
        agent_state["phase"] = ""
    except Exception as e:
        tb = traceback.format_exc()
        log(f"Agent error: {e}", "error")
        log(f"Traceback:\n{tb}", "error")
        agent_state["errors"] += 1
        agent_state["state"] = "error"
        agent_state["phase"] = str(e)
