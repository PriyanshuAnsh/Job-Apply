"""
Gemini AI wrapper — uses the new google-genai SDK (v1 API).
"""
import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

_api_key = os.getenv("GEMINI_API_KEY", "")
_client = None
_model = None   # set by _pick_model() on first use

# Preferred model order — first one that exists wins
_PREFERRED_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-pro",
]


def _get_client():
    global _client
    if _client is None:
        if not _api_key or _api_key == "your-gemini-api-key-here":
            raise ValueError("GEMINI_API_KEY is not set in backend/.env")
        # Pass api_key explicitly so GOOGLE_API_KEY env var is ignored
        _client = genai.Client(api_key=_api_key)
    return _client


def _pick_model() -> str:
    """Return the first preferred model that is available for this API key."""
    global _model
    if _model:
        return _model
    client = _get_client()
    try:
        available = {m.name.split("/")[-1] for m in client.models.list()}
        print(f"[llm] Available models: {sorted(available)}")
        for candidate in _PREFERRED_MODELS:
            if candidate in available:
                _model = candidate
                print(f"[llm] Selected model: {_model}")
                return _model
        # Fallback: pick any gemini model
        gemini_models = sorted(m for m in available if "gemini" in m)
        if gemini_models:
            _model = gemini_models[0]
            print(f"[llm] Fallback model: {_model}")
            return _model
    except Exception as e:
        print(f"[llm] Model discovery failed: {e}")
    # Last resort — try pro
    _model = "gemini-1.5-pro"
    return _model



def _clean_json(text: str) -> str:
    """Strip markdown code fences from a JSON response."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # drop first line (```json or ```) and last line (```)
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def discover_companies(
    role: str,
    location: str,
    industries: list,
    keywords: list,
    exclude_keywords: list,
    count: int = 15,
) -> list:
    """Ask Gemini to suggest real companies hiring for a given role."""
    prompt = f"""
You are a job market research assistant. Generate a list of {count} REAL companies that are
likely to be currently hiring for the role: "{role}".

Criteria:
- Location preference: {location}
- Target industries: {', '.join(industries) if industries else 'any'}
- Keywords relevant to position: {', '.join(keywords) if keywords else 'any'}
- Exclude if related to: {', '.join(exclude_keywords) if exclude_keywords else 'none'}

Return ONLY a JSON array (no markdown, no extra text) with objects:
{{
  "name": "Company Name",
  "website": "https://company.com",
  "industry": "Industry",
  "description": "One sentence description",
  "careers_url": "https://company.com/careers"
}}

Include a mix of well-known companies and growing startups. Return ONLY the JSON array.
"""
    try:
        client = _get_client()
        response = client.models.generate_content(model=_pick_model(), contents=prompt)
        data = json.loads(_clean_json(response.text))
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"[llm] discover_companies error: {e}")
        return []


async def generate_cover_letter(
    profile: dict,
    job_title: str,
    company_name: str,
    job_description: str,
) -> str:
    """Generate a tailored cover letter for a specific job."""
    prompt = f"""
Write a professional, tailored cover letter for the following job application.

APPLICANT:
Name: {profile.get('full_name', 'Applicant')}
Skills: {', '.join(profile.get('skills', []))}
Experience: {profile.get('work_experience', '')}
Education: {profile.get('education', '')}

JOB:
Title: {job_title}
Company: {company_name}
Description: {(job_description or '')[:2000]}

Write a concise 3-paragraph cover letter (under 300 words). Professional but personable.
Return ONLY the cover letter text, no headers or meta-text.
"""
    try:
        client = _get_client()
        response = client.models.generate_content(model=_pick_model(), contents=prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[llm] generate_cover_letter error: {e}")
        skills = ', '.join(profile.get('skills', [])[:3])
        return (
            f"Dear Hiring Manager,\n\n"
            f"I am excited to apply for the {job_title} position at {company_name}. "
            f"My background in {skills} makes me a strong candidate for this role.\n\n"
            f"Best regards,\n{profile.get('full_name', 'Applicant')}"
        )


async def analyze_job_fit(
    profile: dict,
    job_title: str,
    job_description: str,
    exclude_keywords: list,
) -> dict:
    """Score how well a job matches the applicant (0-10). Returns {score, should_apply, reason}."""
    prompt = f"""
Analyze job fit. Score 0-10.

APPLICANT:
Skills: {', '.join(profile.get('skills', []))}
Experience: {profile.get('experience_years', 0)} years
Roles seeking: {', '.join(profile.get('preferences', {{}}).get('roles', []))}
Exclude keywords: {', '.join(exclude_keywords)}

JOB:
Title: {job_title}
Description: {(job_description or '')[:1500]}

Return ONLY a JSON object (no markdown):
{{"score": <0-10>, "should_apply": <true/false>, "reason": "<one sentence>"}}
"""
    try:
        client = _get_client()
        response = client.models.generate_content(model=_pick_model(), contents=prompt)
        return json.loads(_clean_json(response.text))
    except Exception:
        return {"score": 5, "should_apply": True, "reason": "Could not analyze — defaulting to apply"}
