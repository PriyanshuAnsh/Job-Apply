from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from database import get_session
from models import Company, Job, Application, UserProfile
from datetime import datetime
from state import agent_state, log

# ── Companies ──────────────────────────────────────────────────────────────
companies_router = APIRouter(prefix="/companies")

@companies_router.get("")
async def list_companies(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Company).order_by(Company.discovered_at.desc()))
    return result.scalars().all()

@companies_router.get("/{company_id}")
async def get_company(company_id: int, session: AsyncSession = Depends(get_session)):
    company = await session.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ── Jobs ───────────────────────────────────────────────────────────────────
jobs_router = APIRouter(prefix="/jobs")

@jobs_router.get("")
async def list_jobs(
    company_id: Optional[int] = None,
    applied: Optional[bool] = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(Job)
    if company_id is not None:
        q = q.where(Job.company_id == company_id)
    if applied is not None:
        q = q.where(Job.applied == applied)
    q = q.order_by(Job.discovered_at.desc())
    result = await session.execute(q)
    return result.scalars().all()


# ── Applications ───────────────────────────────────────────────────────────
applications_router = APIRouter(prefix="/applications")

@applications_router.get("")
async def list_applications(
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    q = select(Application)
    if status:
        q = q.where(Application.status == status)
    q = q.order_by(Application.created_at.desc())
    result = await session.execute(q)
    return result.scalars().all()

@applications_router.patch("/{app_id}/approve")
async def approve_application(app_id: int, session: AsyncSession = Depends(get_session)):
    app = await session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status != "pending":
        raise HTTPException(status_code=400, detail="Application is not pending")
    # Mark as approved and trigger submission
    app.status = "approved"
    session.add(app)
    await session.commit()
    await session.refresh(app)
    # Kick off submission in background
    from database import AsyncSessionLocal
    from models import UserProfile
    import asyncio
    async def submit():
        async with AsyncSessionLocal() as s:
            result = await s.execute(select(UserProfile))
            profile_row = result.scalars().first()
            profile = profile_row.model_dump() if profile_row else {}
            from agents.applicator import submit_application
            app2 = await s.get(Application, app_id)
            if app2:
                await submit_application(s, app2, profile)
    asyncio.create_task(submit())
    log(f"Application approved by user: {app.job_title} @ {app.company_name}", "success")
    return app

@applications_router.patch("/{app_id}/skip")
async def skip_application(app_id: int, session: AsyncSession = Depends(get_session)):
    app = await session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    app.status = "skipped"
    if agent_state["pending_review"] > 0:
        agent_state["pending_review"] -= 1
    session.add(app)
    await session.commit()
    await session.refresh(app)
    return app

@applications_router.patch("/{app_id}")
async def update_application(
    app_id: int,
    body: dict,
    session: AsyncSession = Depends(get_session),
):
    app = await session.get(Application, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if "notes" in body:
        app.notes = body["notes"]
    session.add(app)
    await session.commit()
    await session.refresh(app)
    return app


# ── Profile ────────────────────────────────────────────────────────────────
profile_router = APIRouter(prefix="/profile")

@profile_router.get("")
async def get_profile(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserProfile))
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@profile_router.put("")
async def update_profile(body: dict, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserProfile))
    profile = result.scalars().first()
    if not profile:
        profile = UserProfile()
    for key, value in body.items():
        if hasattr(profile, key):
            setattr(profile, key, value)
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile
