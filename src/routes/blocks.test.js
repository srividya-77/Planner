/**
 * src/routes/blocks.test.js
 */
jest.mock('../db/prisma')

const request = require('supertest')
const jwt     = require('jsonwebtoken')
const app     = require('../../app')
const prisma  = require('../db/prisma')

process.env.JWT_SECRET = 'test-secret'

const USER_ID  = 'user-1'
const OTHER_ID = 'user-2'
const token    = jwt.sign({ sub: USER_ID, email: 'sri@example.com' }, process.env.JWT_SECRET)

const fakeTask = {
    id: 'task-1', ownerId: USER_ID, title: 'Chapter 3',
    timeRemainingMinutes: 120, taskId: 'task-1',
}

const fakeBlock = {
    id: 'block-1', userId: USER_ID, taskId: 'task-1',
    startTime: new Date('2026-11-03T09:00:00Z').toISOString(),
    endTime:   new Date('2026-11-03T10:00:00Z').toISOString(),
    status: 'scheduled', actualMinutes: null,
    createdAt: new Date().toISOString(),
    task: { id: 'task-1', title: 'Chapter 3' },
}

beforeEach(() => jest.clearAllMocks())

// ─── GET /blocks ──────────────────────────────────────────────────────────────

describe('GET /blocks', () => {
    test('returns blocks for the given date', async () => {
        prisma.block.findMany.mockResolvedValue([fakeBlock])

        const res = await request(app)
            .get('/blocks?date=2026-11-03')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(200)
        expect(res.body.blocks).toHaveLength(1)
        expect(res.body.blocks[0].id).toBe('block-1')
    })

    test('returns 400 when date query param is missing', async () => {
        const res = await request(app)
            .get('/blocks')
            .set('Authorization', `Bearer ${token}`)
        expect(res.status).toBe(400)
    })

    test('returns 400 when date is invalid', async () => {
        const res = await request(app)
            .get('/blocks?date=not-a-date')
            .set('Authorization', `Bearer ${token}`)
        expect(res.status).toBe(400)
    })

    test('returns 401 without token', async () => {
        const res = await request(app).get('/blocks?date=2026-11-03')
        expect(res.status).toBe(401)
    })
})

// ─── POST /blocks ─────────────────────────────────────────────────────────────

describe('POST /blocks', () => {
    const validBody = {
        taskId:    'task-1',
        startTime: '2026-11-03T09:00:00.000Z',
        endTime:   '2026-11-03T10:00:00.000Z',
    }

    test('creates a block when limits are not reached', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)
        prisma.block.count
            .mockResolvedValueOnce(3)   // blocksToday
            .mockResolvedValueOnce(15)  // blocksThisWeek
        prisma.block.create.mockResolvedValue(fakeBlock)

        const res = await request(app)
            .post('/blocks')
            .set('Authorization', `Bearer ${token}`)
            .send(validBody)

        expect(res.status).toBe(201)
        expect(res.body.block).toHaveProperty('id', 'block-1')
    })

    test('returns 422 with DAILY_LIMIT when 8 blocks already exist today', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)
        prisma.block.count
            .mockResolvedValueOnce(8)   // blocksToday — at limit
            .mockResolvedValueOnce(20)  // blocksThisWeek

        const res = await request(app)
            .post('/blocks')
            .set('Authorization', `Bearer ${token}`)
            .send(validBody)

        expect(res.status).toBe(422)
        expect(res.body.reason).toBe('DAILY_LIMIT')
    })

    test('returns 422 with WEEKLY_LIMIT when 40 blocks already exist this week', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)
        prisma.block.count
            .mockResolvedValueOnce(2)   // blocksToday
            .mockResolvedValueOnce(40)  // blocksThisWeek — at limit

        const res = await request(app)
            .post('/blocks')
            .set('Authorization', `Bearer ${token}`)
            .send(validBody)

        expect(res.status).toBe(422)
        expect(res.body.reason).toBe('WEEKLY_LIMIT')
    })

    test('returns 400 when endTime is before startTime', async () => {
        const res = await request(app)
            .post('/blocks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                taskId:    'task-1',
                startTime: '2026-11-03T10:00:00.000Z',
                endTime:   '2026-11-03T09:00:00.000Z',
            })
        expect(res.status).toBe(400)
    })

    test('returns 404 when task belongs to another user', async () => {
        prisma.task.findUnique.mockResolvedValue({ ...fakeTask, ownerId: OTHER_ID })

        const res = await request(app)
            .post('/blocks')
            .set('Authorization', `Bearer ${token}`)
            .send(validBody)

        expect(res.status).toBe(404)
    })

    test('returns 400 when taskId is missing', async () => {
        const { taskId: _, ...rest } = validBody
        const res = await request(app)
            .post('/blocks')
            .set('Authorization', `Bearer ${token}`)
            .send(rest)
        expect(res.status).toBe(400)
    })
})

// ─── PATCH /blocks/:id ────────────────────────────────────────────────────────

describe('PATCH /blocks/:id', () => {
    test('marks a block as cancelled and returns 200', async () => {
        prisma.block.findUnique.mockResolvedValue({ ...fakeBlock, userId: USER_ID })
        prisma.block.update.mockResolvedValue({ ...fakeBlock, status: 'cancelled' })

        const res = await request(app)
            .patch('/blocks/block-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'cancelled' })

        expect(res.status).toBe(200)
        expect(res.body.block.status).toBe('cancelled')
    })

    test('marks a block as completed and updates task time atomically', async () => {
        prisma.block.findUnique.mockResolvedValue({ ...fakeBlock, userId: USER_ID, taskId: 'task-1' })
        const updatedBlock = { ...fakeBlock, status: 'completed', actualMinutes: 50 }
        prisma.$transaction.mockResolvedValue([updatedBlock, {}])

        const res = await request(app)
            .patch('/blocks/block-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'completed', actualMinutes: 50 })

        expect(res.status).toBe(200)
        expect(prisma.$transaction).toHaveBeenCalled()
    })

    test('returns 400 when completing without actualMinutes', async () => {
        prisma.block.findUnique.mockResolvedValue({ ...fakeBlock, userId: USER_ID })

        const res = await request(app)
            .patch('/blocks/block-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'completed' })

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/actualMinutes/)
    })

    test('returns 400 when status is invalid', async () => {
        prisma.block.findUnique.mockResolvedValue({ ...fakeBlock, userId: USER_ID })

        const res = await request(app)
            .patch('/blocks/block-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'pending' })

        expect(res.status).toBe(400)
    })

    test('returns 404 when block belongs to another user', async () => {
        prisma.block.findUnique.mockResolvedValue({ ...fakeBlock, userId: OTHER_ID })

        const res = await request(app)
            .patch('/blocks/block-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'cancelled' })

        expect(res.status).toBe(404)
    })

    test('returns 404 when block does not exist', async () => {
        prisma.block.findUnique.mockResolvedValue(null)

        const res = await request(app)
            .patch('/blocks/does-not-exist')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'cancelled' })

        expect(res.status).toBe(404)
    })
})
