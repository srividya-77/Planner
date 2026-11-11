import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Register() {
    const [name,     setName]     = useState('')
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [error,    setError]    = useState(null)
    const [loading,  setLoading]  = useState(false)
    const signup   = useAuthStore((s) => s.signup)
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }
        setLoading(true)
        try {
            await signup(name, email, password)
            navigate('/dashboard')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Study Planner</h1>
                <h2>Create account</h2>
                <form onSubmit={handleSubmit}>
                    <label>
                        Name
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoFocus
                        />
                    </label>
                    <label>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </label>
                    <label>
                        Password <span className="hint">(min 8 characters)</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>
                    {error && <p className="error">{error}</p>}
                    <button type="submit" disabled={loading}>
                        {loading ? 'Creating account…' : 'Register'}
                    </button>
                </form>
                <p>Already have an account? <Link to="/login">Log in</Link></p>
            </div>
        </div>
    )
}
