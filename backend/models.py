from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Column, JSON


class Company(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    website: str
    industry: str
    description: str = ""
    careers_url: Optional[str] = None
    jobs_count: int = 0
    discovered_at: datetime = Field(default_factory=datetime.utcnow)


class Job(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="company.id", index=True)
    company_name: str
    title: str
    location: str = ""
    job_type: str = "full-time"
    url: str = Field(index=True)
    description: Optional[str] = None
    platform: str = ""
    discovered_at: datetime = Field(default_factory=datetime.utcnow)
    applied: bool = False


class Application(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="job.id", index=True)
    company_name: str
    job_title: str
    job_url: str
    platform: str = ""
    status: str = "pending"  # pending | approved | applied | failed | skipped
    cover_letter: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    applied_at: Optional[datetime] = None


class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str = ""
    email: str = ""
    phone: str = ""
    linkedin_url: str = ""
    github_url: str = ""
    portfolio_url: str = ""
    location: str = ""
    resume_text: str = ""
    skills: List[str] = Field(default=[], sa_column=Column(JSON))
    experience_years: int = 0
    education: str = ""
    work_experience: str = ""
    preferences: dict = Field(default={
        "roles": [],
        "min_salary": 0,
        "remote_only": True,
        "job_types": ["full-time"],
    }, sa_column=Column(JSON))


class AgentLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    time: str
    level: str = "info"  # info | success | warning | error | agent
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
