import { create } from 'zustand'
import { tasksApi } from '../api/tasks'

export const useTaskStore = create((set) => ({
    tasks:   [],
    loading: false,
    error:   null,

    fetch: async () => {
        set({ loading: true, error: null })
        try {
            const data = await tasksApi.list()
            set({ tasks: data.tasks })
        } catch (e) {
            set({ error: e.message })
        } finally {
            set({ loading: false })
        }
    },

    create: async (payload) => {
        const data = await tasksApi.create(payload)
        set((s) => ({ tasks: [...s.tasks, data.task] }))
    },

    update: async (id, payload) => {
        const data = await tasksApi.update(id, payload)
        set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? data.task : t) }))
    },

    remove: async (id) => {
        await tasksApi.remove(id)
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    },
}))
