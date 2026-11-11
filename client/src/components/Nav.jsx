import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Nav() {
    const user = useAuthStore((s) => s.user)
    if (!user) return null

    return (
        <nav className="nav">
            <span className="nav-brand">📚 Planner</span>
            <div className="nav-links">
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/tasks">Tasks</NavLink>
                <NavLink to="/goals">Goals</NavLink>
                <NavLink to="/schedule">Schedule</NavLink>
                <NavLink to="/settings">Settings</NavLink>
            </div>
            <span className="nav-user">{user.name}</span>
        </nav>
    )
}
