import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, CheckCircle, XCircle, Clock, ExternalLink, RefreshCw, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { applicationsApi, type Application } from '@/lib/api'
import { formatDate, truncate } from '@/lib/utils'

type Filter = 'all' | 'pending' | 'applied' | 'failed' | 'skipped'

const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'pending', label: 'PENDING REVIEW' },
    { key: 'applied', label: 'APPLIED' },
    { key: 'failed', label: 'FAILED' },
    { key: 'skipped', label: 'SKIPPED' },
]

export default function Applications() {
    const [apps, setApps] = useState<Application[]>([])
    const [filter, setFilter] = useState<Filter>('all')
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<number | null>(null)
    const [processing, setProcessing] = useState<number | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await applicationsApi.list(filter === 'all' ? undefined : filter)
            setApps(data)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => { load() }, [load])

    const handleApprove = async (id: number) => {
        setProcessing(id)
        try {
            const updated = await applicationsApi.approve(id)
            setApps(prev => prev.map(a => a.id === id ? updated : a))
            toast.success('Application approved — agent will submit shortly')
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setProcessing(null)
        }
    }

    const handleSkip = async (id: number) => {
        setProcessing(id)
        try {
            const updated = await applicationsApi.skip(id)
            setApps(prev => prev.map(a => a.id === id ? updated : a))
            toast.info('Application skipped')
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setProcessing(null)
        }
    }

    const pendingCount = apps.filter(a => a.status === 'pending').length
    const appliedCount = apps.filter(a => a.status === 'applied').length

    return (
        <div style={{ padding: '28px 32px' }}>
            {/* Header */}
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <div className="section-header">
                        <FileText size={22} color="var(--color-primary)" />
                        <span>APPLICATIONS <span className="accent">TRACKER</span></span>
                    </div>
                    <p className="text-dim" style={{ fontSize: 13, marginTop: 6 }}>
                        Review, approve, and track all job applications
                    </p>
                </div>
                <button className="jarvis-btn" onClick={load} style={{ marginTop: 4 }}>
                    <RefreshCw size={14} />
                    <span>REFRESH</span>
                </button>
            </div>

            {/* Stats */}
            {pendingCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        marginBottom: 20,
                        padding: '12px 18px',
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <div className="notif-dot" />
                    <span style={{ color: 'var(--color-warning)', fontSize: 13 }}>
                        <strong>{pendingCount}</strong> application{pendingCount > 1 ? 's' : ''} awaiting your review — approve to submit
                    </span>
                </motion.div>
            )}

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {FILTERS.map(({ key, label }) => (
                    <button
                        key={key}
                        className={`jarvis-btn ${filter === key ? 'jarvis-btn-solid' : ''}`}
                        style={{ padding: '6px 16px', fontSize: 11 }}
                        onClick={() => setFilter(key)}
                    >
                        <span>{label}</span>
                        {key === 'pending' && pendingCount > 0 && (
                            <span style={{
                                background: filter === 'pending' ? 'rgba(0,0,0,0.3)' : 'var(--color-warning)',
                                color: filter === 'pending' ? 'inherit' : '#000',
                                borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 700,
                            }}>{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Application list */}
            {loading ? (
                <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--color-text-muted)' }}>
                    <span className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px', display: 'block' }} />
                    <div className="font-mono" style={{ fontSize: 13 }}>LOADING…</div>
                </div>
            ) : apps.length === 0 ? (
                <div className="jarvis-card" style={{ padding: 50, textAlign: 'center' }}>
                    <FileText size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
                    <div className="font-display" style={{ fontSize: 16, color: 'var(--color-text-dim)', letterSpacing: '0.1em' }}>
                        NO APPLICATIONS YET
                    </div>
                    <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
                        Launch the agent to start finding and applying to jobs
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <AnimatePresence>
                        {apps.map((app, i) => {
                            const isExpanded = expanded === app.id
                            const isPending = app.status === 'pending'

                            return (
                                <motion.div
                                    key={app.id}
                                    className={`jarvis-card ${isPending ? 'jarvis-card-bright' : ''}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ delay: i * 0.03 }}
                                >
                                    {/* Main row */}
                                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                        {/* Status icon */}
                                        <div className="hex-icon" style={{
                                            borderColor: app.status === 'applied' ? 'rgba(16,185,129,0.4)' : app.status === 'pending' ? 'rgba(245,158,11,0.4)' : app.status === 'failed' ? 'rgba(239,68,68,0.4)' : 'rgba(100,130,150,0.2)',
                                            background: app.status === 'applied' ? 'rgba(16,185,129,0.08)' : app.status === 'pending' ? 'rgba(245,158,11,0.08)' : 'rgba(100,130,150,0.05)',
                                        }}>
                                            {app.status === 'applied' ? <CheckCircle size={16} color="var(--color-success)" /> :
                                                app.status === 'pending' ? <Clock size={16} color="var(--color-warning)" /> :
                                                    app.status === 'failed' ? <XCircle size={16} color="var(--color-danger)" /> :
                                                        <Eye size={16} color="var(--color-text-muted)" />}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <span className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>
                                                    {app.job_title}
                                                </span>
                                                <span className={`badge badge-${app.status}`}>{app.status.toUpperCase()}</span>
                                            </div>
                                            <div className="text-muted" style={{ fontSize: 12, marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                                                {app.company_name} · {app.platform} · {formatDate(app.created_at)}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            {/* Approve / Skip for pending */}
                                            {isPending && (
                                                <>
                                                    <button
                                                        id={`approve-btn-${app.id}`}
                                                        className="jarvis-btn jarvis-btn-solid"
                                                        style={{ padding: '6px 14px', fontSize: 11 }}
                                                        onClick={() => handleApprove(app.id)}
                                                        disabled={processing === app.id}
                                                    >
                                                        {processing === app.id ? <span className="spinner" /> : <CheckCircle size={12} />}
                                                        <span>APPROVE</span>
                                                    </button>
                                                    <button
                                                        className="jarvis-btn jarvis-btn-danger"
                                                        style={{ padding: '6px 14px', fontSize: 11 }}
                                                        onClick={() => handleSkip(app.id)}
                                                        disabled={processing === app.id}
                                                    >
                                                        <XCircle size={12} />
                                                        <span>SKIP</span>
                                                    </button>
                                                </>
                                            )}
                                            <a href={app.job_url} target="_blank" rel="noreferrer"
                                                style={{ color: 'var(--color-text-dim)', padding: 8 }}
                                                title="Open job posting"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                            <button
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 8 }}
                                                onClick={() => setExpanded(isExpanded ? null : app.id)}
                                            >
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded: cover letter */}
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px' }}
                                        >
                                            {app.cover_letter ? (
                                                <>
                                                    <div className="jarvis-label" style={{ marginBottom: 10 }}>AI-GENERATED COVER LETTER</div>
                                                    <div className="log-terminal" style={{ maxHeight: 200, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13, color: 'var(--color-text)' }}>
                                                        {app.cover_letter}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-muted" style={{ fontSize: 13 }}>No cover letter generated for this application</div>
                                            )}
                                            {app.notes && (
                                                <div style={{ marginTop: 12 }}>
                                                    <div className="jarvis-label">NOTES</div>
                                                    <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>{app.notes}</div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}
