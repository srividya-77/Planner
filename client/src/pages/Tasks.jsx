import { useEffect, useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useGoalStore } from '../store/goalStore'

export default function Tasks() {
    const { tasks, loading, error, fetch, create, update, remove } = useTaskStore()
    const { goals, fetch: fetchGoals } = useGoalStore()

    const [form,    setForm]    = useState({
        goalId: '', title: '', estimateMinutes: 60,
        deadline: '', repeatRule: 'none',
    })
    const [editing, setEditing] = useState(null)
    const [editVal, setEditVal] = useState({})
    const [formErr, setFormErr] = useState(null)

    useEffect(() => {
        fetch()
        fetchGoals()
    }, [])

    async function handleCreate(e) {
        e.preventDefault()
        setFormErr(null)
        try {
            await create({
                goalId:          form.goalId,
                title:           form.title.trim(),
                estimateMinutes: Number(form.estimateMinutes),
                deadline:        form.deadline,
                repeatRule:      form.repeatRule,
            })
            setForm({ goalId: form.goalId, title: '', estimateMinutes: 60, deadline: '', repeatRule: 'none' })
        } catch (err) {
            setFormErr(err.message)
        }
    }

    async function handleUpdate(id) {
        try {
            await update(id, {
                title:           editVal.title,
                estimateMinutes: Number(editVal.estimateMinutes),
                deadline:        editVal.deadline,
                repeatRule:      editVal.repeatRule,
            })
            setEditing(null)
        } catch (err) {
            alert(err.message)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Delete this task?')) return
        try { await remove(id) } catch (err) { alert(err.message) }
    }

    async function handleMarkDone(id) {
        try { await update(id, { status: 'completed' }) } catch (err) { alert(err.message) }
    }

    const REPEAT_RULES = ['none', 'daily', 'weekly', 'weekdays']

    return (
        <div className="page">
            <h2>Tasks</h2>
            {loading && <p className="muted">Loading…</p>}
            {error   && <p className="error">{error}</p>}

            <ul className="item-list">
                {tasks.map((t) => (
                    <li key={t.id} className="item-row">
                        {editing === t.id ? (
                            <>
                                <input value={editVal.title}
                                    onChange={(e) => setEditVal({ ...editVal, title: e.target.value })} />
                                <input type="number" min="1" value={editVal.estimateMinutes}
                                    onChange={(e) => setEditVal({ ...editVal, estimateMinutes: e.target.value })}
                                    style={{ width: '70px' }} />
                                <input type="date" value={editVal.deadline?.slice(0, 10) || ''}
                                    onChange={(e) => setEditVal({ ...editVal, deadline: e.target.value })} />
                                <select value={editVal.repeatRule}
                                    onChange={(e) => setEditVal({ ...editVal, repeatRule: e.target.value })}>
                                    {REPEAT_RULES.map((r) => <option key={r}>{r}</option>)}
                                </select>
                                <button onClick={() => handleUpdate(t.id)}>Save</button>
                                <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <span className="item-name">{t.title}</span>
                                <span className="muted">{t.goal?.name}</span>
                                <span className="badge">{t.timeRemainingMinutes} min left</span>
                                <span className="muted">due {t.deadline?.slice(0, 10)}</span>
                                <button className="btn-small" onClick={() => {
                                    setEditing(t.id)
                                    setEditVal({
                                        title:           t.title,
                                        estimateMinutes: t.estimateMinutes,
                                        deadline:        t.deadline,
                                        repeatRule:      t.repeatRule,
                                    })
                                }}>Edit</button>
                                <button className="btn-small" onClick={() => handleMarkDone(t.id)}>Done</button>
                                <button className="btn-small btn-danger" onClick={() => handleDelete(t.id)}>Delete</button>
                            </>
                        )}
                    </li>
                ))}
            </ul>

            <div className="card">
                <h3>Add task</h3>
                <form onSubmit={handleCreate}>
                    <label>
                        Goal
                        <select value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })} required>
                            <option value="">— select a goal —</option>
                            {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </label>
                    <label>
                        Title
                        <input value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                    </label>
                    <label>
                        Estimate (minutes)
                        <input type="number" min="1" value={form.estimateMinutes}
                            onChange={(e) => setForm({ ...form, estimateMinutes: e.target.value })} />
                    </label>
                    <label>
                        Deadline
                        <input type="date" value={form.deadline}
                            onChange={(e) => setForm({ ...form, deadline: e.target.value })} required />
                    </label>
                    <label>
                        Repeat
                        <select value={form.repeatRule}
                            onChange={(e) => setForm({ ...form, repeatRule: e.target.value })}>
                            {REPEAT_RULES.map((r) => <option key={r}>{r}</option>)}
                        </select>
                    </label>
                    {formErr && <p className="error">{formErr}</p>}
                    <button type="submit">Add task</button>
                </form>
            </div>
        </div>
    )
}
