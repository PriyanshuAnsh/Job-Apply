"""
Discovery Agent — finds companies and job listings.
"""
import asyncio
import httpx
from bs4 import BeautifulSoup
from datetime import datetime
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import Company, Job
from agents.llm import discover_companies, analyze_job_fit
from state import agent_state, log
import os
import re


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Recognized job platforms and their URL patterns
JOB_PLATFORMS = {
    "greenhouse.io": "Greenhouse",
    "lever.co": "Lever",
    "workday.com": "Workday",
    "linkedin.com": "LinkedIn",
    "indeed.com": "Indeed",
    "greenhouse": "Greenhouse",
    "lever": "Lever",
    "workday": "Workday",
}


def detect_platform(url: str) -> str:
    for pattern, name in JOB_PLATFORMS.items():
        if pattern in url:
            return name
    return "Company Website"


async def scrape_jobs_from_careers_page(
    company: Company,
    session: AsyncSession,
    client: httpx.AsyncClient,
    exclude_keywords: list[str],
    profile: dict,
) -> list[Job]:
    """Attempt to scrape job listings from a company's careers page."""
    if not company.careers_url:
        return []

    log(f"Scraping careers page: {company.careers_url}", "agent")
    jobs = []

    try:
        resp = await client.get(company.careers_url, timeout=15, follow_redirects=True)
        if resp.status_code != 200:
            log(f"  ↳ {company.name}: HTTP {resp.status_code}", "warning")
            return []

        soup = BeautifulSoup(resp.text, "lxml")

        # Find job-like links: look for anchor tags with job-related hrefs
        links = soup.find_all("a", href=True)
        seen_urls = set()
        job_links = []

        for link in links:
            href = str(link.get("href", ""))
            text = link.get_text(strip=True)
            if not text or len(text) < 4 or len(text) > 120:
                continue
            # Heuristic: job links often contain these substrings
            if any(kw in href.lower() for kw in ["/job", "/career", "/position", "/opening", "/role", "/apply", "greenhouse", "lever", "workday"]):
                full_url = href if href.startswith("http") else f"{company.website.rstrip('/')}/{href.lstrip('/')}"
                if full_url not in seen_urls:
                    seen_urls.add(full_url)
                    job_links.append((text, full_url))
                    if len(job_links) >= 20:
                        break

        # Also look for JSON-LD structured data (some sites have it)
        for script in soup.find_all("script", {"type": "application/ld+json"}):
            try:
                import json
                data = json.loads(script.string or "")
                if isinstance(data, list):
                    items = data
                elif isinstance(data, dict):
                    items = [data]
                else:
                    items = []
                for item in items:
                    if item.get("@type") in ("JobPosting", "jobPosting"):
                        title = item.get("title", "")
                        url = item.get("url", company.careers_url)
                        loc = item.get("jobLocation", {})
                        if isinstance(loc, dict):
                            loc_str = loc.get("address", {}).get("addressLocality", "Remote")
                        else:
                            loc_str = "Remote"
                        if title and url:
                            job_links.append((title + f" [{loc_str}]", url))
            except Exception:
                pass

        log(f"  ↳ {company.name}: found {len(job_links)} candidate job links", "info")

        for title_raw, url in job_links[:15]:
            # Clean title
            title = re.sub(r'\s+', ' ', title_raw).strip()
            # Skip if excluded keywords hit
            if any(ex.lower() in title.lower() for ex in exclude_keywords):
                continue

            # Check if already in DB
            existing = await session.execute(select(Job).where(Job.url == url))
            if existing.scalars().first():
                continue

            platform = detect_platform(url)
            job = Job(
                company_id=company.id,
                company_name=company.name,
                title=title,
                location="Remote" if "remote" in title.lower() else company.website,
                url=url,
                platform=platform,
                discovered_at=datetime.utcnow(),
            )
            session.add(job)
            jobs.append(job)

    except Exception as e:
        log(f"  ↳ Error scraping {company.name}: {e}", "warning")

    if jobs:
        await session.commit()
        # Refresh to get IDs
        for j in jobs:
            await session.refresh(j)
        company.jobs_count = company.jobs_count + len(jobs)
        session.add(company)
        await session.commit()
        log(f"  ↳ Saved {len(jobs)} new jobs for {company.name}", "success")

    return jobs


async def run_discovery(
    session: AsyncSession,
    config: dict,
    profile: dict,
) -> tuple[list[Company], list[Job]]:
    """
    Full discovery cycle:
    1. Ask Gemini for company suggestions
    2. Save new companies to DB
    3. Scrape their careers pages for jobs
    """
    all_companies = []
    all_jobs = []

    agent_state["phase"] = "Asking AI for company suggestions…"
    log("Asking Gemini to discover relevant companies…", "agent")

    company_dicts = await discover_companies(
        role=config.get("role", "Software Engineer"),
        location=config.get("location", "Remote"),
        industries=config.get("industries", []),
        keywords=config.get("keywords", []),
        exclude_keywords=config.get("exclude_keywords", []),
        count=12,
    )

    if not company_dicts:
        log("Gemini returned no companies — check API key", "error")
        agent_state["errors"] += 1
        return [], []

    log(f"Gemini suggested {len(company_dicts)} companies", "success")

    async with httpx.AsyncClient(headers=HEADERS) as client:
        for cd in company_dicts:
            name = cd.get("name", "").strip()
            if not name:
                continue

            # Check if already in DB
            existing = await session.execute(select(Company).where(Company.name == name))
            company = existing.scalars().first()

            if not company:
                company = Company(
                    name=name,
                    website=cd.get("website", ""),
                    industry=cd.get("industry", ""),
                    description=cd.get("description", ""),
                    careers_url=cd.get("careers_url"),
                    discovered_at=datetime.utcnow(),
                )
                session.add(company)
                await session.commit()
                await session.refresh(company)
                all_companies.append(company)
                agent_state["companies_found"] += 1
                log(f"Discovered: {company.name} ({company.industry})", "success")

            # Scrape jobs
            agent_state["phase"] = f"Scraping {company.name}…"
            jobs = await scrape_jobs_from_careers_page(
                company, session, client,
                config.get("exclude_keywords", []),
                profile,
            )
            all_jobs.extend(jobs)
            agent_state["jobs_found"] += len(jobs)

            # Rate limit
            await asyncio.sleep(1.5)

    return all_companies, all_jobs
