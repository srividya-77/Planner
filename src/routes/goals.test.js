/**
 * src/routes/goals.test.js
 */
jest.mock('../db/prisma')

const request = require('supertest')
const jwt     = require('jsonwebtoken')
const app     = require('../../app')
const prisma  = require('../db/prisma')

process.env.JWT_SECRET = 'test-secret'

const USER_ID = 'user-1'
const OTHER_ID = 'user-2'
const token   = jwt.sign({ sub: USER_ID, email: 'sri@example.com' }, process.env.JWT_SECRET)

const fakeGoal = { id: 'goal-1', ownerId: USER_ID, name: 'Maths', weight: 4, rank: 1, createdAt: new Date() }

beforeEach(() => jest.clearAllMocks())

// ─── GET /goals ───────────────────────────────────────────────────────────────

describe('GET /goals', () => {
    test('returns list of goals ordered by rank', async () => {
        prisma.goal.findMany.mockResolvedValue([fakeGoal])

        const res = await request(app)
            .get('/goals')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(200)
        expect(res.body.goals).toHaveLength(1)
        expect(res.body.goals[0].name).toBe('Maths')
    })

    test('returns 401 without token', async () => {
        const res = await request(app).get('/goals')
        expect(res.status).toBe(401)
    })
})

// ─── POST /goals ──────────────────────────────────────────────────────────────

describe('POST /goals', () => {
    test('creates a goal and returns 201', async () => {
        prisma.goal.create.mockResolvedValue(fakeGoal)

        const res = await request(app)
            .post('/goals')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Maths', weight: 4, rank: 1 })

        expect(res.status).toBe(201)
        expect(res.body.goal).toHaveProperty('id', 'goal-1')
    })

    test('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/goals')
            .set('Authorization', `Bearer ${token}`)
            .send({ weight: 4, rank: 1 })
        expect(res.status).toBe(400)
    })

    test('returns 400 when weight is out of range', async () => {
        const res = await request(app)
            .post('/goals')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Maths', weight: 6, rank: 1 })
        expect(res.status).toBe(400)
    })

    test('returns 400 when weight is not an integer', async () => {
        const res = await request(app)
            .post('/goals')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Maths', weight: 3.5, rank: 1 })
        expect(res.status).toBe(400)
    })

    test('returns 400 when rank is zero or negative', async () => {
        const res = await request(app)
            .post('/goals')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Maths', weight: 4, rank: 0 })
        expect(res.status).toBe(400)
    })

    test('returns 409 when rank is already taken', async () => {
        const err = new Error('Unique constraint failed')
        err.code = 'P2002'
        prisma.goal.create.mockRejectedValue(err)

        const res = await request(app)
            .post('/goals')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Physics', weight: 3, rank: 1 })

        expect(res.status).toBe(409)
        expect(res.body.error).toMatch(/Rank 1/)
    })
})

// ─── PATCH /goals/:id ─────────────────────────────────────────────────────────

describe('PATCH /goals/:id', () => {
    test('updates name and returns updated goal', async () => {
        prisma.goal.findUnique.mockResolvedValue(fakeGoal)
        prisma.goal.update.mockResolvedValue({ ...fakeGoal, name: 'Mathematics' })

        const res = await request(app)
            .patch('/goals/goal-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Mathematics' })

        expect(res.status).toBe(200)
        expect(res.body.goal.name).toBe('Mathematics')
    })

    test('returns 404 when goal belongs to another user', async () => {
        prisma.goal.findUnique.mockResolvedValue({ ...fakeGoal, ownerId: OTHER_ID })

        const res = await request(app)
            .patch('/goals/goal-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'X' })

        expect(res.status).toBe(404)
    })

    test('returns 404 when goal does not exist', async () => {
        prisma.goal.findUnique.mockResolvedValue(null)

        const res = await request(app)
            .patch('/goals/does-not-exist')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'X' })

        expect(res.status).toBe(404)
    })

    test('returns 400 when weight is invalid', async () => {
        prisma.goal.findUnique.mockResolvedValue(fakeGoal)

        const res = await request(app)
            .patch('/goals/goal-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ weight: 0 })

        expect(res.status).toBe(400)
    })

    test('returns 400 when no valid fields are provided', async () => {
        prisma.goal.findUnique.mockResolvedValue(fakeGoal)

        const res = await request(app)
            .patch('/goals/goal-1')
            .set('Authorization', `Bearer ${token}`)
            .send({ unknownField: 'value' })

        expect(res.status).toBe(400)
    })
})

// ─── DELETE /goals/:id ────────────────────────────────────────────────────────

describe('DELETE /goals/:id', () => {
    test('deletes goal and returns 204', async () => {
        prisma.goal.findUnique.mockResolvedValue(fakeGoal)
        prisma.goal.delete.mockResolvedValue(fakeGoal)

        const res = await request(app)
            .delete('/goals/goal-1')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(204)
    })

    test('returns 404 when goal does not exist', async () => {
        prisma.goal.findUnique.mockResolvedValue(null)

        const res = await request(app)
            .delete('/goals/does-not-exist')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(404)
    })

    test('returns 404 when goal belongs to another user', async () => {
        prisma.goal.findUnique.mockResolvedValue({ ...fakeGoal, ownerId: OTHER_ID })

        const res = await request(app)
            .delete('/goals/goal-1')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(404)
    })

    test('returns 409 when tasks still reference the goal', async () => {
        prisma.goal.findUnique.mockResolvedValue(fakeGoal)
        const err = new Error('Foreign key constraint failed')
        err.code = 'P2003'
        prisma.goal.delete.mockRejectedValue(err)

        const res = await request(app)
            .delete('/goals/goal-1')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(409)
        expect(res.body.error).toMatch(/tasks/)
    })
})
