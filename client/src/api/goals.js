import { api } from './client'

export const goalsApi = {
    list:   ()             => api.get('/goals'),
    create: (data)         => api.post('/goals', data),
    update: (id, data)     => api.patch(`/goals/${id}`, data),
    remove: (id)           => api.delete(`/goals/${id}`),
}
