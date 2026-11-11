/**
 * src/routes/tasks.test.js
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

const fakeGoal = { id: 'goal-1', ownerId: USER_ID, name: 'Maths', weight: 4, rank: 1 }
const fakeTask = {
    id: 'task-1', ownerId: USER_ID, goalId: 'goal-1',
    title: 'Chapter 3', estimateMinutes: 120,
    timeSpentMinutes: 0, timeRemainingMinutes: 120,
    deadline: new Date('2026-11-10').toISOString(),
    repeatRule: 'none', status: 'pending',
    createdAt: new Date().toISOString(),
    goal: fakeGoal,
}

beforeEach(() => jest.clearAllMocks())

// ─── GET /tasks ───────────────────────────────────────────────────────────────

describe('GET /tasks', () => {
    test('returns pending and in_progress tasks', async () => {
        prisma.task.findMany.mockResolvedValue([fakeTask])

        const res = await request(app)
            .get('/tasks')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(200)
        expect(res.body.tasks).toHaveLength(1)
        expect(res.body.tasks[0].title).toBe('Chapter 3')
    })

    test('returns 401 without token', async () => {
        const res = await request(app).get('/tasks')
        expect(res.status).toBe(401)
    })
})

// ─── POST /tasks ──────────────────────────────────────────────────────────────

describe('POST /tasks', () => {
    const validBody = {
        goalId:          'goal-1',
        title:           'Chapter 3',
        estimateMinutes: 120,
        deadline:        '2026-11-10',
    }

    test('creates a task and returns 201', async () => {
        prisma.goal.findUnique.mockResolvedValue(fakeGoal)
        prisma.task.create.mockResolvedValue(fakeTask)

        const res = await request(app)
            .post('/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send(validBody)

        expect(res.status).toBe(201)
        expect(res.body.task).toHaveProperty('id', 'task-1')
    })

    test('timeRemainingMinutes equals estimateMinutes on create', async () => {
        prisma.goal.findUnique.mockResolvedValue(fakeGoal)
        prisma.task.create.mockResolvedValue(fakeTask)

        await request(app)
            .post('/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send(validBody)

        // Verify what was passed to prisma.task.create
        const createCall = prisma.task.create.mock.calls[0][0]
        expect(createCall.data.timeRemainingMinutes).toBe(validBody.estimateMinutes)
    })

    test('returns 400 when goalId is missing', async () => {
        const { goalId: _, ...rest } = validBody
        const res = await request(app)
            .post('/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send(rest)
        expect(res.status).toBe(400)
    })

    test('returns 400 when estimateMinutes is zero', async () => {
        const res = await request(app)
            .post('/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...validBody, estimateMinutes: 0 })
        expect(res.status).toBe(400)
    })

    test('returns 400 when deadline is invalid', async () => {
        const res = await request(app)
            .post('/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...validBody, deadline: 'not-a-date' })
        expect(res.status).toBe(400)
    })

    test('returns 400 when repeatRule is invalid', async () => {
        const res = await request(app)
            .post('/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...validBody, repeatRule: 'monthly' })
        expect(res.status).toBe(400)
    })

    test('returns 404 when goal belongs to another user', async () => {
        prisma.goal.findUnique.mockResolvedValue({ ...fakeGoal, ownerId: OTHER_ID })

        const res = await request(app)
            .post('/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send(validBody)

        expect(res.status).toBe(404)
    })

    test('returns 404 when goal does not exist', async () => {
        prisma.goal.findUnique.mockResolvedValue(null)

        const res = await request(app)
            .post('/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send(validBody)

        expect(res.status).toBe(404)
    })
})

// ─── PATCH /tasks/:id ─────────────────────────────────────────────────────────

describe('PATCH /tasks/:id', () => {
    test('updates title and returns 200', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)
        prisma.task.update.mockResolvedValue({ ...fakeTask, title: 'Chapter 4' })

        const res = await request(app)
            .patch('/tasks/task-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Chapter 4' })

        expect(res.status).toBe(200)
        expect(res.body.task.title).toBe('Chapter 4')
    })

    test('can mark task as completed', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)
        prisma.task.update.mockResolvedValue({ ...fakeTask, status: 'completed' })

        const res = await request(app)
            .patch('/tasks/task-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'completed' })

        expect(res.status).toBe(200)
        expect(res.body.task.status).toBe('completed')
    })

    test('returns 400 when status is invalid', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)

        const res = await request(app)
            .patch('/tasks/task-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'archived' })

        expect(res.status).toBe(400)
    })

    test('returns 400 when timeRemainingMinutes is negative', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)

        const res = await request(app)
            .patch('/tasks/task-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ timeRemainingMinutes: -5 })

        expect(res.status).toBe(400)
    })

    test('returns 404 when task belongs to another user', async () => {
        prisma.task.findUnique.mockResolvedValue({ ...fakeTask, ownerId: OTHER_ID })

        const res = await request(app)
            .patch('/tasks/task-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'X' })

        expect(res.status).toBe(404)
    })

    test('returns 400 when no valid fields provided', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)

        const res = await request(app)
            .patch('/tasks/task-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ unknownField: 'x' })

        expect(res.status).toBe(400)
    })
})

// ─── DELETE /tasks/:id ────────────────────────────────────────────────────────

describe('DELETE /tasks/:id', () => {
    test('deletes task and returns 204', async () => {
        prisma.task.findUnique.mockResolvedValue(fakeTask)
        prisma.task.delete.mockResolvedValue(fakeTask)

        const res = await request(app)
            .delete('/tasks/task-1')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(204)
    })

    test('returns 404 when task does not exist', async () => {
        prisma.task.findUnique.mockResolvedValue(null)

        const res = await request(app)
            .delete('/tasks/does-not-exist')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(404)
    })

    test('returns 404 when task belongs to another user', async () => {
        prisma.task.findUnique.mockResolvedValue({ ...fakeTask, ownerId: OTHER_ID })

        const res = await request(app)
            .delete('/tasks/task-1')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(404)
    })
})
