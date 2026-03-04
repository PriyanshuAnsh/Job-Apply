import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Play, Square, RefreshCw, Zap,
    Building2, Briefcase, CheckCircle, Clock,
    AlertTriangle, Activity, Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAgentStatus, useAgentLog } from '@/hooks/useAgent'
import { agentApi, type SearchConfig } from '@/lib/api'
import { formatTime } from '@/lib/utils'

const defaultConfig: SearchConfig = {
    role: 'Software Engineer',
    location: 'Remote',
    industries: ['Technology', 'SaaS', 'Fintech'],
    keywords: ['React', 'TypeScript', 'Python'],
    exclude_keywords: ['Senior', 'Staff', '10+ years'],
    max_applications_per_run: 10,
    auto_approve: false,
}

export default function Dashboard() {
    const { status, refetch } = useAgentStatus(3000)
    const logs = useAgentLog(100)
    const logEndRef = useRef<HTMLDivElement>(null)
    const [config, setConfig] = useState<SearchConfig>(defaultConfig)
    const [showConfig, setShowConfig] = useState(false)
    const [starting, setStarting] = useState(false)

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [logs])

    const handleStart = async () => {
        if (!config.role.trim()) { toast.error('Set a target role first'); return }
        setStarting(true)
        try {
            await agentApi.start(config)
            toast.success('Agent launched!')
            refetch()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setStarting(false)
        }
    }

    const handleStop = async () => {
        try {
            await agentApi.stop()
            toast.info('Agent stopping…')
            refetch()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const isRunning = status.state === 'running'
    const isStopping = status.state === 'stopping'

    return (
        <div style={{ padding: '28px 32px', minHeight: '100%' }}>
            {/* ── Page header ── */}
            <div style={{ marginBottom: 28 }}>
                <div className="section-header">
                    <Activity size={22} color="var(--color-primary)" />
                    <span>CONTROL <span className="accent">DASHBOARD</span></span>
                </div>
                <p className="text-dim" style={{ fontSize: 13, marginTop: 6 }}>
                    Monitor and control your AI job-finding agent in real time
                </p>
            </div>

            {/* ── Stat cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Companies Found', value: status.companies_found, Icon: Building2, color: 'var(--color-primary)' },
                    { label: 'Jobs Found', value: status.jobs_found, Icon: Briefcase, color: 'var(--color-violet)' },
                    { label: 'Applied', value: status.applied, Icon: CheckCircle, color: 'var(--color-success)' },
                    { label: 'Pending Review', value: status.pending_review, Icon: Clock, color: 'var(--color-warning)' },
                ].map(({ label, value, Icon, color }, i) => (
                    <motion.div
                        key={label}
                        className="jarvis-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        style={{ padding: '20px 22px' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div>
                                <div className="stat-number" style={{ color }}>{value}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', marginTop: 6 }}>
                                    {label.toUpperCase()}
                                </div>
                            </div>
                            <div className="hex-icon" style={{ borderColor: color + '40', background: color + '10' }}>
                                <Icon size={18} color={color} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
                {/* ── Agent control panel ── */}
                <div>
                    <motion.div
                        className="jarvis-card scan-line"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ padding: 22 }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                            <Zap size={16} color="var(--color-primary)" />
                            <span className="font-display" style={{ fontSize: 14, letterSpacing: '0.12em', color: 'var(--color-primary)' }}>
                                AGENT CONTROL
                            </span>
                            <span className={`badge badge-${isRunning ? 'running' : isStopping ? 'pending' : 'idle'}`} style={{ marginLeft: 'auto' }}>
                                {status.state.toUpperCase()}
                            </span>
                        </div>

                        {/* Phase indicator */}
                        {isRunning && status.phase && (
                            <div style={{
                                background: 'var(--bg-base)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                                padding: '10px 14px',
                                marginBottom: 16,
                            }}>
                                <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', marginBottom: 4 }}>
                                    CURRENT PHASE
                                </div>
                                <div className="cursor-blink font-mono" style={{ fontSize: 12, color: 'var(--color-text)' }}>
                                    {status.phase}
                                </div>
                            </div>
                        )}

                        {/* Launch config summary */}
                        <div style={{
                            background: 'var(--bg-base)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 6,
                            padding: '12px 14px',
                            marginBottom: 16,
                            fontSize: 12,
                        }}>
                            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em', fontSize: 10, color: 'var(--color-text-muted)' }}>
                                    SEARCH CONFIG
                                </span>
                                <button
                                    className="jarvis-btn"
                                    style={{ padding: '3px 10px', fontSize: 10 }}
                                    onClick={() => setShowConfig(!showConfig)}
                                >
                                    <span><Settings size={10} style={{ display: 'inline', marginRight: 4 }} />{showConfig ? 'CLOSE' : 'EDIT'}</span>
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <span><span className="text-muted" style={{ fontSize: 10 }}>ROLE: </span><span className="text-primary">{config.role || '—'}</span></span>
                                <span><span className="text-muted" style={{ fontSize: 10 }}>LOC: </span><span className="text-primary">{config.location}</span></span>
                                <span><span className="text-muted" style={{ fontSize: 10 }}>MAX: </span><span className="text-primary">{config.max_applications_per_run}</span></span>
                            </div>
                            {config.keywords.length > 0 && (
                                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {config.keywords.map(k => <span key={k} className="tag" style={{ fontSize: 10 }}>{k}</span>)}
                                </div>
                            )}
                        </div>

                        {/* Edit config inline */}
                        {showConfig && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
                            >
                                {[
                                    { field: 'role' as const, label: 'Target Role', placeholder: 'Software Engineer' },
                                    { field: 'location' as const, label: 'Location', placeholder: 'Remote / San Francisco, CA' },
                                ].map(({ field, label, placeholder }) => (
                                    <div key={field}>
                                        <label className="jarvis-label">{label}</label>
                                        <input
                                            className="jarvis-input"
                                            placeholder={placeholder}
                                            value={config[field] as string}
                                            onChange={e => setConfig(c => ({ ...c, [field]: e.target.value }))}
                                        />
                                    </div>
                                ))}
                                <div>
                                    <label className="jarvis-label">Keywords (comma-separated)</label>
                                    <input
                                        className="jarvis-input"
                                        placeholder="React, TypeScript, Python"
                                        value={config.keywords.join(', ')}
                                        onChange={e => setConfig(c => ({ ...c, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                                    />
                                </div>
                                <div>
                                    <label className="jarvis-label">Exclude Keywords</label>
                                    <input
                                        className="jarvis-input"
                                        placeholder="Senior, Staff, 10+ years"
                                        value={config.exclude_keywords.join(', ')}
                                        onChange={e => setConfig(c => ({ ...c, exclude_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                                    />
                                </div>
                                <div>
                                    <label className="jarvis-label">Industries (comma-separated)</label>
                                    <input
                                        className="jarvis-input"
                                        placeholder="Technology, SaaS, Fintech"
                                        value={config.industries.join(', ')}
                                        onChange={e => setConfig(c => ({ ...c, industries: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                                    />
                                </div>
                                <div>
                                    <label className="jarvis-label">Max Applications / Run</label>
                                    <input
                                        type="number" min={1} max={50}
                                        className="jarvis-input"
                                        value={config.max_applications_per_run}
                                        onChange={e => setConfig(c => ({ ...c, max_applications_per_run: parseInt(e.target.value) || 10 }))}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                        className={`toggle-track ${config.auto_approve ? 'on' : ''}`}
                                        onClick={() => setConfig(c => ({ ...c, auto_approve: !c.auto_approve }))}
                                    >
                                        <div className="toggle-thumb" />
                                    </div>
                                    <div>
                                        <div className="jarvis-label" style={{ marginBottom: 0 }}>Auto-Approve</div>
                                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                                            Skip manual review before applying
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Errors */}
                        {status.errors > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 12px', borderRadius: 6,
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                marginBottom: 16,
                            }}>
                                <AlertTriangle size={14} color="var(--color-danger)" />
                                <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>
                                    {status.errors} error{status.errors > 1 ? 's' : ''} occurred — check logs
                                </span>
                            </div>
                        )}

                        {/* Control buttons */}
                        <div style={{ display: 'flex', gap: 10 }}>
                            {!isRunning ? (
                                <button
                                    id="launch-agent-btn"
                                    className="jarvis-btn jarvis-btn-solid"
                                    style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
                                    onClick={handleStart}
                                    disabled={starting || isStopping}
                                >
                                    {starting ? <span className="spinner" /> : <Play size={14} />}
                                    <span>{starting ? 'LAUNCHING…' : 'LAUNCH AGENT'}</span>
                                </button>
                            ) : (
                                <button
                                    className="jarvis-btn jarvis-btn-danger"
                                    style={{ flex: 1, justifyContent: 'center', padding: '10px' }}
                                    onClick={handleStop}
                                >
                                    <Square size={14} />
                                    <span>STOP AGENT</span>
                                </button>
                            )}
                            <button
                                className="jarvis-btn"
                                style={{ padding: '10px 14px' }}
                                onClick={refetch}
                                title="Refresh status"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* ── Live log terminal ── */}
                <motion.div
                    className="jarvis-card"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ padding: 22, display: 'flex', flexDirection: 'column' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <Activity size={16} color="var(--color-primary)" />
                        <span className="font-display" style={{ fontSize: 14, letterSpacing: '0.12em', color: 'var(--color-primary)' }}>
                            LIVE AGENT LOG
                        </span>
                        {isRunning && <span className="spinner" style={{ marginLeft: 'auto' }} />}
                    </div>

                    <div className="log-terminal" style={{ flex: 1 }}>
                        {logs.length === 0 ? (
                            <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                                [ Agent not running — logs will appear here ]
                            </div>
                        ) : (
                            logs.map((entry, i) => (
                                <div key={i} className="log-entry">
                                    <span className="log-time">{entry.time}</span>
                                    <span className={`log-msg-${entry.level}`}>{entry.message}</span>
                                </div>
                            ))
                        )}
                        <div ref={logEndRef} />
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
