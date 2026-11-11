import { useEffect, useState } from 'react'
import { usersApi } from '../api/users'
import { useAuthStore } from '../store/authStore'

// IST is UTC+5:30 (330 minutes ahead)
const IST_OFFSET_MINUTES = 330

// Convert UTC time string "HH:MM:SS" → IST time string "HH:MM"
function utcToIst(utcStr) {
    if (!utcStr) return ''
    const [h, m] = utcStr.split(':').map(Number)
    const totalMinutes = h * 60 + m + IST_OFFSET_MINUTES
    const istH = Math.floor(totalMinutes / 60) % 24
    const istM = totalMinutes % 60
    return `${String(istH).padStart(2, '0')}:${String(istM).padStart(2, '0')}`
}

// Convert IST time string "HH:MM" → UTC time string "HH:MM:00"
function istToUtc(istStr) {
    if (!istStr) return ''
    const [h, m] = istStr.split(':').map(Number)
    let totalMinutes = h * 60 + m - IST_OFFSET_MINUTES
    if (totalMinutes < 0) totalMinutes += 24 * 60
    totalMinutes = totalMinutes % (24 * 60)
    const utcH = Math.floor(totalMinutes / 60)
    const utcM = totalMinutes % 60
    return `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}:00`
}

const TIME_FIELDS = [
    { key: 'dayStartTime', label: 'Study window start' },
    { key: 'dayEndTime',   label: 'Study window end' },
    { key: 'lunchStart',   label: 'Lunch start' },
    { key: 'lunchEnd',     label: 'Lunch end' },
    { key: 'dinnerStart',  label: 'Dinner start' },
    { key: 'dinnerEnd',    label: 'Dinner end' },
    { key: 'dayCutoff',    label: 'Day cutoff' },
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Settings() {
    const logout     = useAuthStore((s) => s.logout)
    // istForm holds IST time strings for display; UTC is derived on save
    const [istForm,  setIstForm]  = useState({})
    const [name,     setName]     = useState('')
    const [restDay,  setRestDay]  = useState(0)
    const [loading,  setLoading]  = useState(true)
    const [saving,   setSaving]   = useState(false)
    const [error,    setError]    = useState(null)
    const [saved,    setSaved]    = useState(false)

    useEffect(() => {
        usersApi.me()
            .then((data) => {
                const u = data.user
                setName(u.name || '')
                setRestDay(u.restDay ?? 0)
                // Convert all UTC times from DB to IST for display
                const ist = {}
                for (const { key } of TIME_FIELDS) {
                    ist[key] = utcToIst(u[key])
                }
                setIstForm(ist)
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [])

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSaved(false)
        try {
            // Convert IST times back to UTC before sending to backend
            const payload = { name, restDay: Number(restDay) }
            for (const { key } of TIME_FIELDS) {
                payload[key] = istToUtc(istForm[key])
            }
            await usersApi.update(payload)
            setSaved(true)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="page"><p className="muted">Loading…</p></div>

    return (
        <div className="page">
            <h2>Settings</h2>

            {error && <p className="error">{error}</p>}
            {saved && <p className="success">Saved.</p>}

            <form onSubmit={handleSave} className="settings-form">
                <div className="card">
                    <h3>Profile</h3>
                    <label>
                        Name
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                </div>

                <div className="card">
                    <h3>Study window & burnout settings</h3>
                    <p className="muted">All times are in IST.</p>
                    {TIME_FIELDS.map(({ key, label }) => (
                        <label key={key}>
                            {label}
                            <input
                                type="time"
                                step="60"
                                value={istForm[key] || ''}
                                onChange={(e) =>
                                    setIstForm({ ...istForm, [key]: e.target.value })
                                }
                            />
                        </label>
                    ))}
                    <label>
                        Rest day
                        <select
                            value={restDay}
                            onChange={(e) => setRestDay(e.target.value)}
                        >
                            {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                    </label>
                </div>

                <button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save settings'}
                </button>
            </form>

            <div className="card" style={{ marginTop: '2rem' }}>
                <h3>Account</h3>
                <button className="btn-danger" onClick={logout}>Log out</button>
            </div>
        </div>
    )
}
