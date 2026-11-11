import { useEffect, useState } from 'react'
import { schedulerApi } from '../api/scheduler'

function toIST(isoString) {
    return new Date(isoString).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    })
}

function mondayOfWeek(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Schedule() {
    const [suggestions, setSuggestions] = useState([])
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState(null)
    const [weekDate,    setWeekDate]    = useState(mondayOfWeek(new Date()))

    useEffect(() => {
        setLoading(true)
        setError(null)
        schedulerApi.weekView(weekDate)
            .then((data) => setSuggestions(data.suggestions || []))
            .catch((e)   => setError(e.message))
            .finally(()  => setLoading(false))
    }, [weekDate])

    function shiftWeek(delta) {
        const d = new Date(weekDate)
        d.setDate(d.getDate() + delta * 7)
        setWeekDate(d.toISOString().slice(0, 10))
    }

    return (
        <div className="page">
            <div className="week-header">
                <button onClick={() => shiftWeek(-1)}>← Prev</button>
                <h2>Week of {weekDate}</h2>
                <button onClick={() => shiftWeek(1)}>Next →</button>
            </div>

            {loading && <p className="muted">Loading week…</p>}
            {error   && <p className="error">{error}</p>}

            {!loading && !error && (
                <div className="week-grid">
                    {suggestions.map((s, i) => (
                        <div key={s.date} className="week-day">
                            <div className="week-day-name">{DAY_NAMES[i]}<br />{s.date.slice(5)}</div>
                            {s.result.reason ? (
                                <div className="week-no-slot muted">{reasonShort(s.result.reason)}</div>
                            ) : (
                                <div className="week-slot">
                                    <div className="week-slot-task">{s.result.task?.title}</div>
                                    <div className="week-slot-time">
                                        {toIST(s.result.start)} – {toIST(s.result.end)}
                                    </div>
                                    <div className="muted">{s.result.blockDuration} min</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function reasonShort(reason) {
    switch (reason) {
        case 'NO_FREE_SLOT':  return 'No free slot'
        case 'DAILY_LIMIT':   return 'Day full'
        case 'WEEKLY_LIMIT':  return 'Week full'
        case 'NO_TASKS':      return 'No tasks'
        default:              return reason
    }
}
