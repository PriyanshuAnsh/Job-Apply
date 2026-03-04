// API client — all requests go through Vite's proxy to http://localhost:8000
const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(BASE + path, {
        headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
        ...options,
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail ?? 'Request failed')
    }
    return res.json()
}

// ── Types ─────────────────────────────────────────────────────────────────
export interface AgentStatus {
    state: 'idle' | 'running' | 'stopping' | 'error'
    phase: string
    companies_found: number
    jobs_found: number
    applied: number
    pending_review: number
    errors: number
    started_at: string | null
    config: SearchConfig
}

export interface SearchConfig {
    role: string
    location: string
    industries: string[]
    keywords: string[]
    exclude_keywords: string[]
    max_applications_per_run: number
    auto_approve: boolean
}

export interface Company {
    id: number
    name: string
    website: string
    industry: string
    description: string
    careers_url: string | null
    jobs_count: number
    discovered_at: string
}

export interface Job {
    id: number
    company_id: number
    company_name: string
    title: string
    location: string
    job_type: string
    url: string
    description: string | null
    platform: string
    discovered_at: string
    applied: boolean
}

export interface Application {
    id: number
    job_id: number
    company_name: string
    job_title: string
    job_url: string
    platform: string
    status: 'pending' | 'approved' | 'applied' | 'failed' | 'skipped'
    cover_letter: string | null
    notes: string | null
    created_at: string
    applied_at: string | null
}

export interface LogEntry {
    time: string
    level: 'info' | 'success' | 'warning' | 'error' | 'agent'
    message: string
}

export interface UserProfile {
    full_name: string
    email: string
    phone: string
    linkedin_url: string
    github_url: string
    portfolio_url: string
    location: string
    resume_text: string
    skills: string[]
    experience_years: number
    education: string
    work_experience: string
    preferences: {
        roles: string[]
        min_salary: number
        remote_only: boolean
        job_types: string[]
    }
}

// ── Agent endpoints ────────────────────────────────────────────────────────
export const agentApi = {
    getStatus: () => request<AgentStatus>('/agent/status'),
    start: (config: Partial<SearchConfig>) => request<{ ok: boolean }>('/agent/start', {
        method: 'POST', body: JSON.stringify(config),
    }),
    stop: () => request<{ ok: boolean }>('/agent/stop', { method: 'POST' }),
    getRecentLogs: () => request<LogEntry[]>('/agent/logs'),
}

// ── Company endpoints ──────────────────────────────────────────────────────
export const companiesApi = {
    list: () => request<Company[]>('/companies'),
    get: (id: number) => request<Company>(`/companies/${id}`),
}

// ── Jobs endpoints ─────────────────────────────────────────────────────────
export const jobsApi = {
    list: (params?: { company_id?: number; applied?: boolean }) => {
        const qs = params ? '?' + new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
        ).toString() : ''
        return request<Job[]>(`/jobs${qs}`)
    },
}

// ── Application endpoints ──────────────────────────────────────────────────
export const applicationsApi = {
    list: (status?: string) => {
        const qs = status ? `?status=${status}` : ''
        return request<Application[]>(`/applications${qs}`)
    },
    approve: (id: number) => request<Application>(`/applications/${id}/approve`, { method: 'PATCH' }),
    skip: (id: number) => request<Application>(`/applications/${id}/skip`, { method: 'PATCH' }),
    updateNotes: (id: number, notes: string) => request<Application>(`/applications/${id}`, {
        method: 'PATCH', body: JSON.stringify({ notes }),
    }),
}

// ── Profile endpoints ──────────────────────────────────────────────────────
export const profileApi = {
    get: () => request<UserProfile>('/profile'),
    update: (data: Partial<UserProfile>) => request<UserProfile>('/profile', {
        method: 'PUT', body: JSON.stringify(data),
    }),
}
