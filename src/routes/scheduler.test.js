/**
 * routes/scheduler.test.js
 *
 * Integration tests for the scheduler API routes.
 * Uses supertest — no real server port needed.
 * Prisma client is mocked — no real database required.
 */

jest.mock('../db/prisma')

const request = require('supertest')
const app     = require('../../app')

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const task = {
    deadline: new Date(Date.now() + 3 * 86400000).toISOString(), // 3 days from now
    goal: { weight: 4, rank: 2 },
}

const dayStart = '2026-11-03T08:00:00.000Z'
const dayEnd   = '2026-11-03T22:00:00.000Z'

const openDay  = []
const fullDay  = [{ start: dayStart, end: dayEnd }]

// ─── POST /scheduler/suggest-slot ────────────────────────────────────────────

describe('POST /scheduler/suggest-slot', () => {
    const tasks = [
        {
            deadline:             new Date(Date.now() + 3 * 86400000).toISOString(),
            createdAt:            new Date('2026-10-01T00:00:00Z').toISOString(),
            timeRemainingMinutes: 60,
            goal:                 { weight: 4, rank: 2 },
        },
    ]

    const base = {
        tasks,
        totalGoals:        3,
        blocksToday:       0,
        blocksThisWeek:    0,
        consecutiveBlocks: 0,
        busyIntervals:     openDay,
        dayStart,
        dayEnd,
    }

    test('returns a slot for an open day', async () => {
        const res = await request(app).post('/scheduler/suggest-slot').send(base)
        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('start')
        expect(res.body).toHaveProperty('end')
        expect(res.body).toHaveProperty('score')
        expect(res.body).toHaveProperty('blockDuration')
    })

    test('returns NO_FREE_SLOT when entire day is busy', async () => {
        const res = await request(app).post('/scheduler/suggest-slot').send({ ...base, busyIntervals: fullDay })
        expect(res.status).toBe(200)
        expect(res.body.reason).toBe('NO_FREE_SLOT')
    })

    test('returns NO_TASKS when tasks array is empty', async () => {
        const res = await request(app).post('/scheduler/suggest-slot').send({ ...base, tasks: [] })
        expect(res.status).toBe(200)
        expect(res.body.reason).toBe('NO_TASKS')
    })

    test('returns DAILY_LIMIT when 8 blocks already scheduled', async () => {
        const res = await request(app).post('/scheduler/suggest-slot').send({ ...base, blocksToday: 8 })
        expect(res.status).toBe(200)
        expect(res.body.reason).toBe('DAILY_LIMIT')
    })

    test('returns WEEKLY_LIMIT when 40 blocks already scheduled', async () => {
        const res = await request(app).post('/scheduler/suggest-slot').send({ ...base, blocksThisWeek: 40 })
        expect(res.status).toBe(200)
        expect(res.body.reason).toBe('WEEKLY_LIMIT')
    })

    test('returns 400 when tasks is not an array', async () => {
        const res = await request(app).post('/scheduler/suggest-slot').send({ ...base, tasks: null })
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when totalGoals is missing', async () => {
        const { totalGoals: _removed, ...rest } = base
        const res = await request(app).post('/scheduler/suggest-slot').send(rest)
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

// ─── POST /scheduler/overrun ──────────────────────────────────────────────────

describe('POST /scheduler/overrun', () => {
    const base = {
        currentBlockStart: '2026-11-03T09:00:00.000Z',
        currentBlockEnd:   '2026-11-03T09:50:00.000Z',
        extraMinutes:      10,   // 50 + 10 = 60 min, fits within default maxBlockDuration of 60
        busyIntervals:     [],
        dayEnd,
    }

    test('returns EXTEND option when next slot is free and block fits', async () => {
        const res = await request(app).post('/scheduler/overrun').send(base)
        expect(res.status).toBe(200)
        expect(res.body.options.some(o => o.type === 'EXTEND')).toBe(true)
    })

    test('always returns POSTPONE as a fallback option', async () => {
        const res = await request(app).post('/scheduler/overrun').send(base)
        expect(res.status).toBe(200)
        expect(res.body.options.some(o => o.type === 'POSTPONE')).toBe(true)
    })

    test('does not offer EXTEND when next busy interval blocks it', async () => {
        const res = await request(app).post('/scheduler/overrun').send({
            ...base,
            busyIntervals: [{ start: '2026-11-03T09:55:00.000Z', end: '2026-11-03T11:00:00.000Z' }],
        })
        expect(res.status).toBe(200)
        expect(res.body.options.some(o => o.type === 'EXTEND')).toBe(false)
    })

    test('offers MOVE_TO_NEXT_SLOT when there is a free slot later in the day', async () => {
        const res = await request(app).post('/scheduler/overrun').send({
            ...base,
            busyIntervals: [{ start: '2026-11-03T09:55:00.000Z', end: '2026-11-03T11:00:00.000Z' }],
        })
        expect(res.status).toBe(200)
        expect(res.body.options.some(o => o.type === 'MOVE_TO_NEXT_SLOT')).toBe(true)
    })

    test('returns 400 when extraMinutes is missing', async () => {
        const { extraMinutes: _removed, ...rest } = base
        const res = await request(app).post('/scheduler/overrun').send(rest)
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when currentBlockStart is missing', async () => {
        const { currentBlockStart: _removed, ...rest } = base
        const res = await request(app).post('/scheduler/overrun').send(rest)
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

// ─── POST /scheduler/group-slots ─────────────────────────────────────────────

describe('POST /scheduler/group-slots', () => {
    const base = {
        members: [
            { busyIntervals: [{ start: '2026-11-03T08:00:00.000Z', end: '2026-11-03T10:00:00.000Z' }] },
            { busyIntervals: [{ start: '2026-11-03T13:00:00.000Z', end: '2026-11-03T15:00:00.000Z' }] },
        ],
        dayStart,
        dayEnd,
        blockDuration: 50,
        gap:           15,
    }

    test('returns freeSlots and candidateSlots for a group', async () => {
        const res = await request(app).post('/scheduler/group-slots').send(base)
        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('freeSlots')
        expect(res.body).toHaveProperty('candidateSlots')
        expect(Array.isArray(res.body.freeSlots)).toBe(true)
        expect(Array.isArray(res.body.candidateSlots)).toBe(true)
    })

    test('returns no candidate slots when members have no overlapping free time', async () => {
        const res = await request(app).post('/scheduler/group-slots').send({
            ...base,
            members: [
                { busyIntervals: [{ start: '2026-11-03T08:00:00.000Z', end: '2026-11-03T15:00:00.000Z' }] },
                { busyIntervals: [{ start: '2026-11-03T15:00:00.000Z', end: '2026-11-03T22:00:00.000Z' }] },
            ],
        })
        expect(res.status).toBe(200)
        expect(res.body.candidateSlots).toHaveLength(0)
    })

    test('returns 400 when members has fewer than 2 entries', async () => {
        const res = await request(app).post('/scheduler/group-slots').send({
            ...base,
            members: [{ busyIntervals: [] }],
        })
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when dayStart is missing', async () => {
        const { dayStart: _removed, ...rest } = base
        const res = await request(app).post('/scheduler/group-slots').send(rest)
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

// ─── POST /scheduler/week-view ────────────────────────────────────────────────

describe('POST /scheduler/week-view', () => {
    // Build a 7-day week starting 2026-11-03 (Monday)
    const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date('2026-11-03T00:00:00.000Z')
        d.setUTCDate(d.getUTCDate() + i)
        return {
            date:             d.toISOString(),
            busyIntervals:    [],
            blocksToday:      0,
            consecutiveBlocks: 0,
        }
    })

    const tasks = [
        {
            deadline:             new Date(Date.now() + 3 * 86400000).toISOString(),
            createdAt:            new Date('2026-10-01T00:00:00Z').toISOString(),
            timeRemainingMinutes: 60,
            goal:                 { weight: 4, rank: 2 },
        },
    ]

    const base = {
        tasks,
        totalGoals:     3,
        week,
        blocksThisWeek: 0,
        dayStartHour:   8,
        dayEndHour:     22,
    }

    test('returns 7 suggestions for a full open week', async () => {
        const res = await request(app).post('/scheduler/week-view').send(base)
        expect(res.status).toBe(200)
        expect(res.body.suggestions).toHaveLength(7)
    })

    test('each suggestion has a date and result field', async () => {
        const res = await request(app).post('/scheduler/week-view').send(base)
        for (const s of res.body.suggestions) {
            expect(s).toHaveProperty('date')
            expect(s).toHaveProperty('result')
        }
    })

    test('WEEKLY_LIMIT is returned once 40 blocks are reached mid-week', async () => {
        const res = await request(app).post('/scheduler/week-view').send({ ...base, blocksThisWeek: 39 })
        expect(res.status).toBe(200)
        // First day should succeed (39 + 1 = 40), rest should hit WEEKLY_LIMIT
        expect(res.body.suggestions[0].result).toHaveProperty('start')
        expect(res.body.suggestions[1].result.reason).toBe('WEEKLY_LIMIT')
    })

    test('returns 400 when week array does not have exactly 7 entries', async () => {
        const res = await request(app).post('/scheduler/week-view').send({ ...base, week: week.slice(0, 5) })
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when tasks is not an array', async () => {
        const res = await request(app).post('/scheduler/week-view').send({ ...base, tasks: null })
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})
