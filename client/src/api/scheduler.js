import { api } from './client'

export const schedulerApi = {
    suggest:  (date, breakAfter = true) => api.post('/scheduler/suggest', { date, breakAfter }),
    weekView: (date)                    => api.post('/scheduler/week',    { date }),
}
