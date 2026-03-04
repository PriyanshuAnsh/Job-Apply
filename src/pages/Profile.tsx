import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Save, Plus, X, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { profileApi, type UserProfile } from '@/lib/api'

const EMPTY_PROFILE: UserProfile = {
    full_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
    location: '',
    resume_text: '',
    skills: [],
    experience_years: 0,
    education: '',
    work_experience: '',
    preferences: {
        roles: [],
        min_salary: 0,
        remote_only: true,
        job_types: ['full-time'],
    },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="jarvis-card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{
                fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                letterSpacing: '0.15em', color: 'var(--color-primary)',
                marginBottom: 18, textTransform: 'uppercase',
                paddingBottom: 10, borderBottom: '1px solid var(--color-border)',
            }}>
                {title}
            </div>
            {children}
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label className="jarvis-label">{label}</label>
            {children}
        </div>
    )
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
    const [input, setInput] = useState('')

    const add = () => {
        const trimmed = input.trim()
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed])
        }
        setInput('')
    }

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {tags.map(tag => (
                    <span key={tag} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {tag}
                        <button
                            type="button"
                            onClick={() => onChange(tags.filter(t => t !== tag))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    className="jarvis-input"
                    placeholder="Add item…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
                />
                <button type="button" className="jarvis-btn" style={{ padding: '8px 14px' }} onClick={add}>
                    <Plus size={13} />
                </button>
            </div>
        </div>
    )
}

export default function Profile() {
    const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        profileApi.get().then(p => setProfile(p)).catch(() => { }).finally(() => setLoading(false))
    }, [])

    const set = (key: keyof UserProfile, value: any) =>
        setProfile(prev => ({ ...prev, [key]: value }))

    const setPref = (key: keyof UserProfile['preferences'], value: any) =>
        setProfile(prev => ({ ...prev, preferences: { ...prev.preferences, [key]: value } }))

    const handleSave = async () => {
        if (!profile.full_name.trim()) { toast.error('Full name is required'); return }
        if (!profile.email.trim()) { toast.error('Email is required'); return }
        if (!profile.resume_text.trim()) { toast.error('Resume text is required'); return }
        setSaving(true)
        try {
            const updated = await profileApi.update(profile)
            setProfile(updated)
            setSaved(true)
            toast.success('Profile saved')
            setTimeout(() => setSaved(false), 3000)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <span className="spinner" style={{ width: 32, height: 32 }} />
            </div>
        )
    }

    return (
        <div style={{ padding: '28px 32px', maxWidth: 780 }}>
            {/* Header */}
            <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <div className="section-header">
                        <User size={22} color="var(--color-primary)" />
                        <span>YOUR <span className="accent">PROFILE</span></span>
                    </div>
                    <p className="text-dim" style={{ fontSize: 13, marginTop: 6 }}>
                        The agent uses this to fill application forms and write cover letters
                    </p>
                </div>
                <button
                    id="save-profile-btn"
                    className={`jarvis-btn ${saved ? '' : 'jarvis-btn-solid'}`}
                    style={{ marginTop: 4, padding: '10px 20px' }}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <span className="spinner" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
                    <span>{saving ? 'SAVING…' : saved ? 'SAVED!' : 'SAVE PROFILE'}</span>
                </button>
            </div>

            {/* Personal info */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Section title="Personal Information">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                        <Field label="Full Name *">
                            <input className="jarvis-input" placeholder="Jane Smith" value={profile.full_name} onChange={e => set('full_name', e.target.value)} />
                        </Field>
                        <Field label="Email *">
                            <input className="jarvis-input" type="email" placeholder="jane@example.com" value={profile.email} onChange={e => set('email', e.target.value)} />
                        </Field>
                        <Field label="Phone">
                            <input className="jarvis-input" placeholder="+1 (555) 000-0000" value={profile.phone} onChange={e => set('phone', e.target.value)} />
                        </Field>
                        <Field label="Location">
                            <input className="jarvis-input" placeholder="San Francisco, CA / Remote" value={profile.location} onChange={e => set('location', e.target.value)} />
                        </Field>
                        <Field label="LinkedIn URL">
                            <input className="jarvis-input" placeholder="https://linkedin.com/in/jane" value={profile.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
                        </Field>
                        <Field label="GitHub URL">
                            <input className="jarvis-input" placeholder="https://github.com/jane" value={profile.github_url} onChange={e => set('github_url', e.target.value)} />
                        </Field>
                        <Field label="Portfolio / Website">
                            <input className="jarvis-input" placeholder="https://jane.dev" value={profile.portfolio_url} onChange={e => set('portfolio_url', e.target.value)} />
                        </Field>
                        <Field label="Years of Experience">
                            <input className="jarvis-input" type="number" min={0} max={50} value={profile.experience_years} onChange={e => set('experience_years', parseInt(e.target.value) || 0)} />
                        </Field>
                    </div>
                    <Field label="Education">
                        <input className="jarvis-input" placeholder="B.S. Computer Science, MIT, 2022" value={profile.education} onChange={e => set('education', e.target.value)} />
                    </Field>
                </Section>

                {/* Skills */}
                <Section title="Skills">
                    <Field label="Technical Skills (press Enter to add)">
                        <TagInput tags={profile.skills} onChange={tags => set('skills', tags)} />
                    </Field>
                </Section>

                {/* Work experience */}
                <Section title="Work Experience">
                    <Field label="Work History (used for cover letter generation)">
                        <textarea
                            className="jarvis-input jarvis-textarea"
                            placeholder={`Software Engineer @ Acme Corp (2021-2023)\n- Built microservices handling 1M req/day\n- Led migration from monolith to Kubernetes

Junior Developer @ Startup (2020-2021)\n- Developed React frontend for SaaS dashboard`}
                            value={profile.work_experience}
                            onChange={e => set('work_experience', e.target.value)}
                        />
                    </Field>
                </Section>

                {/* Resume */}
                <Section title="Resume Text *">
                    <div style={{
                        marginBottom: 12, padding: '10px 14px', background: 'rgba(6,182,212,0.06)',
                        border: '1px solid var(--color-primary-dim)', borderRadius: 6, fontSize: 12, color: 'var(--color-text-dim)',
                    }}>
                        Paste your resume here. The agent will use this to fill application forms and tailor cover letters.
                        Plain text or paste from a PDF extractor.
                    </div>
                    <textarea
                        className="jarvis-input jarvis-textarea"
                        style={{ minHeight: 280 }}
                        placeholder="Paste your resume content here…"
                        value={profile.resume_text}
                        onChange={e => set('resume_text', e.target.value)}
                    />
                </Section>

                {/* Preferences */}
                <Section title="Job Preferences">
                    <Field label="Target Roles (press Enter to add)">
                        <TagInput tags={profile.preferences.roles} onChange={tags => setPref('roles', tags)} />
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                        <Field label="Minimum Salary (USD/year, 0 = any)">
                            <input
                                className="jarvis-input" type="number" min={0} step={5000}
                                value={profile.preferences.min_salary}
                                onChange={e => setPref('min_salary', parseInt(e.target.value) || 0)}
                            />
                        </Field>
                        <Field label="Job Types">
                            <select
                                className="jarvis-select"
                                value={profile.preferences.job_types[0] || 'full-time'}
                                onChange={e => setPref('job_types', [e.target.value])}
                            >
                                <option value="full-time">Full-Time</option>
                                <option value="part-time">Part-Time</option>
                                <option value="contract">Contract</option>
                                <option value="internship">Internship</option>
                            </select>
                        </Field>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                        <div
                            className={`toggle-track ${profile.preferences.remote_only ? 'on' : ''}`}
                            onClick={() => setPref('remote_only', !profile.preferences.remote_only)}
                        >
                            <div className="toggle-thumb" />
                        </div>
                        <div>
                            <div className="jarvis-label" style={{ marginBottom: 0 }}>Remote Only</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                Only apply to remote-friendly positions
                            </div>
                        </div>
                    </div>
                </Section>
            </motion.div>
        </div>
    )
}
