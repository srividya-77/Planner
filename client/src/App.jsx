import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Nav        from './components/Nav'
import Login      from './pages/Login'
import Register   from './pages/Register'
import Dashboard  from './pages/Dashboard'
import Goals      from './pages/Goals'
import Tasks      from './pages/Tasks'
import Schedule   from './pages/Schedule'
import Settings   from './pages/Settings'

function RequireAuth({ children }) {
    const token = useAuthStore((s) => s.token)
    if (!token) return <Navigate to="/login" replace />
    return children
}

export default function App() {
    return (
        <BrowserRouter>
            <Nav />
            <main className="main">
                <Routes>
                    <Route path="/login"    element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                    <Route path="/goals"     element={<RequireAuth><Goals /></RequireAuth>} />
                    <Route path="/tasks"     element={<RequireAuth><Tasks /></RequireAuth>} />
                    <Route path="/schedule"  element={<RequireAuth><Schedule /></RequireAuth>} />
                    <Route path="/settings"  element={<RequireAuth><Settings /></RequireAuth>} />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </main>
        </BrowserRouter>
    )
}
