import { create } from 'zustand'
import { goalsApi } from '../api/goals'

export const useGoalStore = create((set) => ({
    goals:   [],
    loading: false,
    error:   null,

    fetch: async () => {
        set({ loading: true, error: null })
        try {
            const data = await goalsApi.list()
            set({ goals: data.goals })
        } catch (e) {
            set({ error: e.message })
        } finally {
            set({ loading: false })
        }
    },

    create: async (payload) => {
        const data = await goalsApi.create(payload)
        set((s) => ({ goals: [...s.goals, data.goal].sort((a, b) => a.rank - b.rank) }))
    },

    update: async (id, payload) => {
        const data = await goalsApi.update(id, payload)
        set((s) => ({
            goals: s.goals.map((g) => g.id === id ? data.goal : g).sort((a, b) => a.rank - b.rank),
        }))
    },

    remove: async (id) => {
        await goalsApi.remove(id)
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
    },
}))
