import { api } from './client'

export const blocksApi = {
    listForDate: (date)    => api.get(`/blocks?date=${date}`),
    create:      (data)    => api.post('/blocks', data),
    update:      (id, data) => api.patch(`/blocks/${id}`, data),
}
