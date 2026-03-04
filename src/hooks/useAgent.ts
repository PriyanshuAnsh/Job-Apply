import { useState, useEffect, useRef, useCallback } from 'react'
import { agentApi, type AgentStatus, type LogEntry } from '@/lib/api'

const DEFAULT_STATUS: AgentStatus = {
    state: 'idle',
    phase: '',
    companies_found: 0,
    jobs_found: 0,
    applied: 0,
    pending_review: 0,
    errors: 0,
    started_at: null,
    config: {
        role: '',
        location: 'Remote',
        industries: [],
        keywords: [],
        exclude_keywords: [],
        max_applications_per_run: 10,
        auto_approve: false,
    },
}

export function useAgentStatus(pollMs = 3000) {
    const [status, setStatus] = useState<AgentStatus>(DEFAULT_STATUS)
    const [loading, setLoading] = useState(true)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetch = useCallback(async () => {
        try {
            const s = await agentApi.getStatus()
            setStatus(s)
        } catch {
            // backend offline — keep last known state
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetch()
        timerRef.current = setInterval(fetch, pollMs)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [fetch, pollMs])

    const refetch = useCallback(() => { fetch() }, [fetch])

    return { status, loading, refetch }
}

export function useAgentLog(maxEntries = 200) {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const esRef = useRef<EventSource | null>(null)

    useEffect(() => {
        const connect = () => {
            const es = new EventSource('/api/agent/log-stream')
            esRef.current = es

            es.onmessage = (e) => {
                try {
                    const entry: LogEntry = JSON.parse(e.data)
                    setLogs(prev => [...prev.slice(-(maxEntries - 1)), entry])
                } catch { }
            }

            es.onerror = () => {
                es.close()
                // retry after 5s if stream fails
                setTimeout(connect, 5000)
            }
        }

        // Load recent logs first
        agentApi.getRecentLogs().then(recent => {
            setLogs(recent.slice(-maxEntries))
        }).catch(() => { })

        connect()
        return () => { esRef.current?.close() }
    }, [maxEntries])

    return logs
}
