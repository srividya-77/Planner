import { create } from 'zustand'
import { authApi } from '../api/auth'

export const useAuthStore = create((set) => ({
    user:  JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || null,

    login: async (email, password) => {
        const data = await authApi.login(email, password)
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        set({ user: data.user, token: data.token })
    },

    signup: async (name, email, password) => {
        await authApi.signup(name, email, password)
        // After signup, log in automatically
        const data = await authApi.login(email, password)
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        set({ user: data.user, token: data.token })
    },

    logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ user: null, token: null })
    },
}))
