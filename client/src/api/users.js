import { api } from './client'

export const usersApi = {
    me:     ()     => api.get('/users/me'),
    update: (data) => api.patch('/users/me', data),
}
