import { useEffect, useState } from 'react'
import { schedulerApi } from '../api/scheduler'
import { blocksApi }    from '../api/blocks'
import { useAuthStore } from '../store/authStore'

function toIST(isoString) {
    return new Date(isoString).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    })
}

function todayUTC() {
    return new Date().toISOString().slice(0, 10)
}

export default function Dashboard() {
    const user           = useAuthStore((s) => s.user)
    const [suggestion,   setSuggestion]   = useState(null)
    const [blocks,       setBlocks]       = useState([])
    const [loadingSug,   setLoadingSug]   = useState(true)
    const [loadingBlocks, setLoadingBlocks] = useState(true)
    const [error,        setError]        = useState(null)
    const [confirming,   setConfirming]   = useState(false)
    const [breakAfter,   setBreakAfter]   = useState(true)

    const today = todayUTC()

    function loadSuggestion(withBreak = breakAfter) {
        setLoadingSug(true)
        setSuggestion(null)
        setError(null)
        schedulerApi.suggest(today, withBreak)
            .then((data) => setSuggestion(data))
            .catch((e)   => setError(e.message))
            .finally(()  => setLoadingSug(false))
    }

    useEffect(() => {
        loadSuggestion()

        blocksApi.listForDate(today)
            .then((data) => setBlocks(data.blocks))
            .catch(()    => {})
            .finally(()  => setLoadingBlocks(false))
    }, [today])

    // Re-fetch suggestion whenever breakAfter toggle changes
    function handleBreakToggle(val) {
        setBreakAfter(val)
        loadSuggestion(val)
    }

    async function handleConfirm() {
        if (!suggestion?.start) return
        setConfirming(true)
        try {
            const block = await blocksApi.create({
                taskId:    suggestion.task.id,
                startTime: suggestion.start,
                endTime:   suggestion.end,
            })
            setBlocks((prev) => [...prev, block.block])
            // Refresh suggestion for next block
            const next = await schedulerApi.suggest(today, breakAfter)
            setSuggestion(next)
        } catch (e) {
            setError(e.message)
        } finally {
            setConfirming(false)
        }
    }

    async function handleComplete(blockId) {
        const mins = parseInt(window.prompt('How many minutes did you actually spend?'), 10)
        if (isNaN(mins) || mins < 0) return
        try {
            const updated = await blocksApi.update(blockId, { status: 'completed', actualMinutes: mins })
            setBlocks((prev) => prev.map((b) => b.id === blockId ? updated.block : b))
        } catch (e) {
            alert(e.message)
        }
    }

    return (
        <div className="page">
            <h2>Today — {today}</h2>

            <section className="card">
                <h3>Next suggested block</h3>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                        type="checkbox"
                        checked={breakAfter}
                        onChange={(e) => handleBreakToggle(e.target.checked)}
                    />
                    Take a break after this block
                </label>

                {loadingSug && <p className="muted">Finding the best slot…</p>}
                {!loadingSug && error && <p className="error">{error}</p>}
                {!loadingSug && !error && suggestion?.reason && (
                    <p className="muted">{reasonLabel(suggestion.reason)}</p>
                )}
                {!loadingSug && !error && suggestion?.start && (
                    <>
                        <p className="suggestion-task">{suggestion.task.title || 'Task'}</p>
                        <p className="suggestion-time">
                            {toIST(suggestion.start)} – {toIST(suggestion.end)}
                            <span className="badge">{suggestion.blockDuration} min</span>
                        </p>
                        <p className="muted">Score: {suggestion.score?.toFixed(3)}</p>
                        <button onClick={handleConfirm} disabled={confirming}>
                            {confirming ? 'Scheduling…' : 'Schedule this block'}
                        </button>
                    </>
                )}
            </section>

            <section className="card">
                <h3>Today's blocks ({blocks.length} / 8)</h3>
                {loadingBlocks && <p className="muted">Loading…</p>}
                {!loadingBlocks && blocks.length === 0 && (
                    <p className="muted">No blocks scheduled yet today.</p>
                )}
                <ul className="block-list">
                    {blocks.map((b) => (
                        <li key={b.id} className={`block-item status-${b.status}`}>
                            <span className="block-time">
                                {toIST(b.startTime)} – {toIST(b.endTime)}
                            </span>
                            <span className="block-title">{b.task?.title}</span>
                            <span className="block-status">{b.status}</span>
                            {b.status === 'scheduled' && (
                                <button
                                    className="btn-small"
                                    onClick={() => handleComplete(b.id)}
                                >
                                    Complete
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}

function reasonLabel(reason) {
    switch (reason) {
        case 'NO_FREE_SLOT':  return 'No free slot available today — all time is taken.'
        case 'DAILY_LIMIT':   return 'Daily limit reached (8 blocks). Great work today!'
        case 'WEEKLY_LIMIT':  return 'Weekly limit reached (40 blocks). Rest up!'
        case 'NO_TASKS':      return 'No pending tasks. Add some tasks to get started.'
        default:              return reason
    }
}
