import { useEffect, useState } from 'react'
import { useGoalStore } from '../store/goalStore'

export default function Goals() {
    const { goals, loading, error, fetch, create, update, remove } = useGoalStore()
    const [form,    setForm]    = useState({ name: '', weight: 3, rank: 1 })
    const [editing, setEditing] = useState(null)  // goal id being edited
    const [editVal, setEditVal] = useState({})
    const [formErr, setFormErr] = useState(null)

    useEffect(() => { fetch() }, [])

    async function handleCreate(e) {
        e.preventDefault()
        setFormErr(null)
        try {
            await create({
                name:   form.name.trim(),
                weight: Number(form.weight),
                rank:   Number(form.rank),
            })
            setForm({ name: '', weight: 3, rank: goals.length + 2 })
        } catch (err) {
            setFormErr(err.message)
        }
    }

    async function handleUpdate(id) {
        try {
            await update(id, {
                name:   editVal.name,
                weight: Number(editVal.weight),
                rank:   Number(editVal.rank),
            })
            setEditing(null)
        } catch (err) {
            alert(err.message)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Delete this goal? This will fail if tasks still use it.')) return
        try {
            await remove(id)
        } catch (err) {
            alert(err.message)
        }
    }

    return (
        <div className="page">
            <h2>Goals</h2>

            {loading && <p className="muted">Loading…</p>}
            {error   && <p className="error">{error}</p>}

            <ul className="item-list">
                {goals.map((g) => (
                    <li key={g.id} className="item-row">
                        {editing === g.id ? (
                            <>
                                <input
                                    value={editVal.name}
                                    onChange={(e) => setEditVal({ ...editVal, name: e.target.value })}
                                />
                                <select
                                    value={editVal.weight}
                                    onChange={(e) => setEditVal({ ...editVal, weight: e.target.value })}
                                >
                                    {[1,2,3,4,5].map((w) => <option key={w}>{w}</option>)}
                                </select>
                                <input
                                    type="number" min="1"
                                    value={editVal.rank}
                                    onChange={(e) => setEditVal({ ...editVal, rank: e.target.value })}
                                    style={{ width: '60px' }}
                                />
                                <button onClick={() => handleUpdate(g.id)}>Save</button>
                                <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <span className="item-name">{g.name}</span>
                                <span className="badge">weight {g.weight}</span>
                                <span className="muted">rank {g.rank}</span>
                                <button className="btn-small" onClick={() => {
                                    setEditing(g.id)
                                    setEditVal({ name: g.name, weight: g.weight, rank: g.rank })
                                }}>Edit</button>
                                <button className="btn-small btn-danger" onClick={() => handleDelete(g.id)}>Delete</button>
                            </>
                        )}
                    </li>
                ))}
            </ul>

            <div className="card">
                <h3>Add goal</h3>
                <form onSubmit={handleCreate}>
                    <label>
                        Name
                        <input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </label>
                    <label>
                        Weight (importance 1–5)
                        <select
                            value={form.weight}
                            onChange={(e) => setForm({ ...form, weight: e.target.value })}
                        >
                            {[1,2,3,4,5].map((w) => <option key={w}>{w}</option>)}
                        </select>
                    </label>
                    <label>
                        Rank (priority order, 1 = highest)
                        <input
                            type="number" min="1"
                            value={form.rank}
                            onChange={(e) => setForm({ ...form, rank: e.target.value })}
                            style={{ width: '80px' }}
                        />
                    </label>
                    {formErr && <p className="error">{formErr}</p>}
                    <button type="submit">Add goal</button>
                </form>
            </div>
        </div>
    )
}
