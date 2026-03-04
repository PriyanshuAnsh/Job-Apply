import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Building2, Briefcase, ExternalLink, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { companiesApi, jobsApi, type Company, type Job } from '@/lib/api'
import { formatDate, truncate } from '@/lib/utils'
import { toast } from 'sonner'

export default function Discovery() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('')
    const [expanded, setExpanded] = useState<number | null>(null)

    const load = async () => {
        setLoading(true)
        try {
            const [c, j] = await Promise.all([companiesApi.list(), jobsApi.list()])
            setCompanies(c)
            setJobs(j)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const filtered = companies.filter(c =>
        !filter || c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.industry.toLowerCase().includes(filter.toLowerCase())
    )

    const jobsForCompany = (companyId: number) =>
        jobs.filter(j => j.company_id === companyId)

    return (
        <div style={{ padding: '28px 32px' }}>
            {/* Header */}
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <div className="section-header">
                        <Search size={22} color="var(--color-primary)" />
                        <span>JOB <span className="accent">DISCOVERY</span></span>
                    </div>
                    <p className="text-dim" style={{ fontSize: 13, marginTop: 6 }}>
                        Companies and job listings found by the agent
                    </p>
                </div>
                <button className="jarvis-btn" onClick={load} style={{ marginTop: 4 }}>
                    <RefreshCw size={14} />
                    <span>REFRESH</span>
                </button>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                {[
                    { label: 'Companies', value: companies.length, color: 'var(--color-primary)' },
                    { label: 'Jobs Found', value: jobs.length, color: 'var(--color-violet)' },
                    { label: 'Applied', value: jobs.filter(j => j.applied).length, color: 'var(--color-success)' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        padding: '10px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}>
                        <span className="font-mono" style={{ fontSize: 22, color }}>{value}</span>
                        <span className="font-display" style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}>
                            {label.toUpperCase()}
                        </span>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
                <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                    className="jarvis-input"
                    style={{ paddingLeft: 38 }}
                    placeholder="Filter companies or industries…"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>

            {/* Company list */}
            {loading ? (
                <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--color-text-muted)' }}>
                    <span className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px', display: 'block' }} />
                    <div className="font-mono" style={{ fontSize: 13 }}>SCANNING DATABASE…</div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="jarvis-card" style={{ padding: 40, textAlign: 'center' }}>
                    <Building2 size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
                    <div className="font-display" style={{ fontSize: 16, color: 'var(--color-text-dim)', letterSpacing: '0.1em' }}>
                        NO COMPANIES FOUND
                    </div>
                    <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
                        {companies.length === 0
                            ? 'Launch the agent from the Dashboard to discover companies'
                            : 'No companies match your filter'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filtered.map((company, i) => {
                        const companyJobs = jobsForCompany(company.id)
                        const isExpanded = expanded === company.id
                        return (
                            <motion.div
                                key={company.id}
                                className="jarvis-card"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                            >
                                {/* Company header row */}
                                <div
                                    style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                                    onClick={() => setExpanded(isExpanded ? null : company.id)}
                                >
                                    <div className="hex-icon">
                                        <Building2 size={16} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>
                                                {company.name}
                                            </span>
                                            <span className="badge badge-applied" style={{ fontSize: 10 }}>{company.industry}</span>
                                        </div>
                                        <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>
                                            {truncate(company.description, 90)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div className="font-mono" style={{ fontSize: 18, color: 'var(--color-primary)' }}>
                                                {companyJobs.length}
                                            </div>
                                            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>JOBS</div>
                                        </div>
                                        {company.careers_url && (
                                            <a href={company.careers_url} target="_blank" rel="noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                style={{ color: 'var(--color-text-dim)' }}
                                                title="Open careers page"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                        {isExpanded ? <ChevronDown size={14} color="var(--color-text-muted)" /> : <ChevronRight size={14} color="var(--color-text-muted)" />}
                                    </div>
                                </div>

                                {/* Expanded job list */}
                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        style={{ borderTop: '1px solid var(--color-border)' }}
                                    >
                                        {companyJobs.length === 0 ? (
                                            <div style={{ padding: '14px 20px', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                                No jobs scraped yet for this company
                                            </div>
                                        ) : (
                                            companyJobs.map(job => (
                                                <div key={job.id} style={{
                                                    padding: '12px 20px 12px 54px',
                                                    borderBottom: '1px solid rgba(6,182,212,0.05)',
                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                }}>
                                                    <Briefcase size={13} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 500 }}>{job.title}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                                            {job.platform} · {job.location} · {formatDate(job.discovered_at)}
                                                        </div>
                                                    </div>
                                                    {job.applied && <span className="badge badge-applied" style={{ fontSize: 10 }}>APPLIED</span>}
                                                    <a href={job.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-dim)' }}>
                                                        <ExternalLink size={13} />
                                                    </a>
                                                </div>
                                            ))
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
