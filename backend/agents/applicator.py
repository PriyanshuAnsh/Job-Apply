"""
Application Agent — uses Playwright to fill out job application forms.
"""
import asyncio
from datetime import datetime
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import Job, Application
from agents.llm import generate_cover_letter, analyze_job_fit
from state import agent_state, log


async def run_applications(
    session: AsyncSession,
    config: dict,
    profile: dict,
) -> list[Application]:
    """
    For all unapplied jobs, create Application records.
    If auto_approve is enabled, directly try to apply via Playwright.
    Otherwise, set status to 'pending' and wait for user approval.
    """
    # Get unapplied jobs
    result = await session.execute(select(Job).where(Job.applied == False))
    jobs = result.scalars().all()

    if not jobs:
        log("No new jobs to process", "info")
        return []

    max_apps = config.get("max_applications_per_run", 10)
    auto_approve = config.get("auto_approve", False)
    applications = []
    count = 0

    for job in jobs:
        if count >= max_apps:
            log(f"Reached max applications limit ({max_apps})", "warning")
            break
        if agent_state["state"] != "running":
            break

        agent_state["phase"] = f"Preparing application: {job.title} @ {job.company_name}"
        log(f"Processing: {job.title} @ {job.company_name}", "agent")

        # Check if application already exists
        existing = await session.execute(
            select(Application).where(Application.job_id == job.id)
        )
        if existing.scalars().first():
            continue

        # Analyze job fit
        fit = await analyze_job_fit(
            profile=profile,
            job_title=job.title,
            job_description=job.description or "",
            exclude_keywords=config.get("exclude_keywords", []),
        )

        if not fit.get("should_apply", True):
            log(f"  ↳ Skipping {job.title}: {fit.get('reason', 'Low fit score')}", "info")
            app = Application(
                job_id=job.id,
                company_name=job.company_name,
                job_title=job.title,
                job_url=job.url,
                platform=job.platform,
                status="skipped",
                notes=f"AI skipped: {fit.get('reason', '')}",
            )
            session.add(app)
            await session.commit()
            continue

        # Generate cover letter
        log(f"  ↳ Generating cover letter for {job.title}…", "agent")
        cover_letter = await generate_cover_letter(
            profile=profile,
            job_title=job.title,
            company_name=job.company_name,
            job_description=job.description or "",
        )

        status = "approved" if auto_approve else "pending"
        app = Application(
            job_id=job.id,
            company_name=job.company_name,
            job_title=job.title,
            job_url=job.url,
            platform=job.platform,
            status=status,
            cover_letter=cover_letter,
            notes=f"Fit score: {fit.get('score', '?')}/10 — {fit.get('reason', '')}",
        )
        session.add(app)
        await session.commit()
        await session.refresh(app)
        applications.append(app)
        agent_state["pending_review"] += 1
        log(f"  ↳ Application queued ({status}): {job.title} @ {job.company_name}", "success")

        if auto_approve:
            # Try to submit immediately
            await submit_application(session, app, profile)

        count += 1
        await asyncio.sleep(0.5)

    return applications


async def submit_application(
    session: AsyncSession,
    app: Application,
    profile: dict,
):
    """
    Use Playwright to fill and submit the application form.
    Supports Greenhouse, Lever, Workday, and generic forms.
    """
    log(f"  ↳ Submitting application via Playwright: {app.job_url}", "agent")

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            await page.goto(app.job_url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(2)

            platform = app.platform.lower()

            if "greenhouse" in platform or "greenhouse.io" in app.job_url:
                await _fill_greenhouse(page, profile, app.cover_letter or "")
            elif "lever" in platform or "lever.co" in app.job_url:
                await _fill_lever(page, profile, app.cover_letter or "")
            else:
                await _fill_generic(page, profile, app.cover_letter or "")

            # Update status
            app.status = "applied"
            app.applied_at = datetime.utcnow()
            session.add(app)

            # Mark job as applied
            result = await session.execute(
                select(__import__('models').Job).where(__import__('models').Job.id == app.job_id)
            )
            job = result.scalars().first()
            if job:
                job.applied = True
                session.add(job)

            await session.commit()
            agent_state["applied"] += 1
            if agent_state["pending_review"] > 0:
                agent_state["pending_review"] -= 1
            log(f"  ↳ Successfully applied to {app.job_title} @ {app.company_name}", "success")
            await browser.close()

    except Exception as e:
        log(f"  ↳ Application failed: {e}", "error")
        app.status = "failed"
        app.notes = (app.notes or "") + f" | Submit error: {str(e)[:100]}"
        agent_state["errors"] += 1
        session.add(app)
        await session.commit()


async def _fill_greenhouse(page, profile: dict, cover_letter: str):
    """Fill Greenhouse application form."""
    try:
        await page.fill('input[id="first_name"], input[name="first_name"]', profile.get("full_name", "").split()[0])
        await page.fill('input[id="last_name"], input[name="last_name"]', " ".join(profile.get("full_name", "").split()[1:]) or "Applicant")
        await page.fill('input[id="email"], input[name="email"]', profile.get("email", ""))
        await page.fill('input[id="phone"], input[name="phone"]', profile.get("phone", ""))
        if profile.get("linkedin_url"):
            try:
                await page.fill('input[id="job_application_answers_attributes_0_text_value"]', profile["linkedin_url"])
            except Exception:
                pass
        if cover_letter:
            try:
                await page.fill('textarea[name*="cover"], textarea[id*="cover"]', cover_letter)
            except Exception:
                pass
        # Click submit
        await page.click('input[type="submit"], button[type="submit"]')
        await page.wait_for_timeout(3000)
    except Exception as e:
        raise RuntimeError(f"Greenhouse fill error: {e}")


async def _fill_lever(page, profile: dict, cover_letter: str):
    """Fill Lever application form."""
    try:
        await page.fill('input[name="name"]', profile.get("full_name", ""))
        await page.fill('input[name="email"]', profile.get("email", ""))
        await page.fill('input[name="phone"]', profile.get("phone", ""))
        if profile.get("linkedin_url"):
            try:
                await page.fill('input[name="urls[LinkedIn]"]', profile["linkedin_url"])
            except Exception:
                pass
        if cover_letter:
            try:
                await page.fill('textarea[name="comments"]', cover_letter)
            except Exception:
                pass
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3000)
    except Exception as e:
        raise RuntimeError(f"Lever fill error: {e}")


async def _fill_generic(page, profile: dict, cover_letter: str):
    """
    Generic form filler — tries common field names/labels.
    This is best-effort for non-standard application forms.
    """
    selectors = {
        "name": ['input[name*="name" i]', 'input[placeholder*="name" i]', 'input[id*="name" i]'],
        "email": ['input[type="email"]', 'input[name*="email" i]'],
        "phone": ['input[type="tel"]', 'input[name*="phone" i]'],
        "cover": ['textarea[name*="cover" i]', 'textarea[id*="cover" i]', 'textarea[placeholder*="cover" i]'],
    }

    for field, selector_list in selectors.items():
        value = ""
        if field == "name":
            value = profile.get("full_name", "")
        elif field == "email":
            value = profile.get("email", "")
        elif field == "phone":
            value = profile.get("phone", "")
        elif field == "cover":
            value = cover_letter

        if not value:
            continue
        for sel in selector_list:
            try:
                el = await page.query_selector(sel)
                if el:
                    await el.fill(value)
                    break
            except Exception:
                continue
