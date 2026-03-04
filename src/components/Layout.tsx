import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard, Search, FileText, User, Cpu,
    Activity, AlertCircle,
} from 'lucide-react'
import { useAgentStatus } from '@/hooks/useAgent'

const NAV = [
    { to: '/dashboard', label: 'DASHBOARD', Icon: LayoutDashboard },
    { to: '/discovery', label: 'DISCOVERY', Icon: Search },
    { to: '/applications', label: 'APPLICATIONS', Icon: FileText },
    { to: '/profile', label: 'PROFILE', Icon: User },
]

interface Props {
    children: React.ReactNode
}

export default function Layout({ children }: Props) {
    const { status } = useAgentStatus(3000)
    const location = useLocation()

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', position: 'relative', zIndex: 1 }}>
            {/* ── Sidebar ── */}
            <nav className="sidebar">
                {/* Logo */}
                <div style={{
                    padding: '20px 20px 16px',
                    borderBottom: '1px solid var(--color-border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="hex-icon heartbeat">
                            <Cpu size={20} />
                        </div>
                        <div>
                            <div className="font-display glow-text" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1 }}>
                                J.A.R.V.I.S.
                            </div>
                            <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                JOB AI AGENT v1.0
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agent status mini-indicator */}
                <div style={{
                    margin: '10px 14px',
                    padding: '8px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Activity size={12} color={status.state === 'running' ? '#10b981' : 'var(--color-text-muted)'} />
                        <span className="font-display" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}>
                            AGENT STATE
                        </span>
                    </div>
                    <span className={`badge badge-${status.state === 'running' ? 'running' : 'idle'}`}
                        style={{ fontSize: 10 }}>
                        {status.state.toUpperCase()}
                    </span>
                    {status.state === 'running' && status.phase && (
                        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                            {status.phase}
                        </div>
                    )}
                </div>

                {/* Nav links */}
                <div style={{ flex: 1, paddingTop: 8 }}>
                    {NAV.map(({ to, label, Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        >
                            <Icon size={16} />
                            <span className="font-display" style={{ fontSize: 13, letterSpacing: '0.1em' }}>{label}</span>
                            {to === '/applications' && status.pending_review > 0 && (
                                <span style={{
                                    marginLeft: 'auto',
                                    background: 'var(--color-warning)',
                                    color: '#000',
                                    borderRadius: 10,
                                    padding: '1px 6px',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-mono)',
                                }}>
                                    {status.pending_review}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </div>

                {/* Bottom stats */}
                <div style={{
                    padding: '12px 14px',
                    borderTop: '1px solid var(--color-border)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 8,
                }}>
                    {[
                        { label: 'CO.', value: status.companies_found },
                        { label: 'JOBS', value: status.jobs_found },
                        { label: 'APP.', value: status.applied },
                    ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                            <div className="font-mono" style={{ fontSize: 16, color: 'var(--color-primary)', lineHeight: 1 }}>
                                {value}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', marginTop: 2 }}>
                                {label}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>

            {/* ── Main content ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Top bar */}
                <div className="topbar">
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                        {location.pathname.slice(1).toUpperCase()}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                        {status.errors > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger)', fontSize: 12 }}>
                                <AlertCircle size={14} />
                                <span className="font-mono">{status.errors} ERR</span>
                            </div>
                        )}
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                            {new Date().toLocaleTimeString('en-US', { hour12: false })}
                        </div>
                    </div>
                </div>

                {/* Page content */}
                <div style={{ flex: 1, overflow: 'auto' }} className="scroll-area">
                    {children}
                </div>
            </div>
        </div>
    )
}
