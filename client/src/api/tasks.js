import { api } from './client'

export const tasksApi = {
    list:   ()         => api.get('/tasks'),
    create: (data)     => api.post('/tasks', data),
    update: (id, data) => api.patch(`/tasks/${id}`, data),
    remove: (id)       => api.delete(`/tasks/${id}`),
}
