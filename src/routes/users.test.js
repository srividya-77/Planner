/**
 * src/routes/users.test.js
 */
jest.mock('../db/prisma')

const request = require('supertest')
const jwt     = require('jsonwebtoken')
const app     = require('../../app')
const prisma  = require('../db/prisma')

process.env.JWT_SECRET = 'test-secret'

const USER_ID = 'user-1'
const token   = jwt.sign({ sub: USER_ID, email: 'sri@example.com' }, process.env.JWT_SECRET)

const fakeUser = {
    id: USER_ID, name: 'Srividya', email: 'sri@example.com',
    dayStartTime: '03:30:00', dayEndTime: '16:30:00',
    lunchStart: '07:30:00', lunchEnd: '08:30:00',
    dinnerStart: '14:30:00', dinnerEnd: '15:30:00',
    dayCutoff: '16:30:00', restDay: 0,
    timezone: 'Asia/Kolkata', createdAt: new Date().toISOString(),
}

beforeEach(() => jest.clearAllMocks())

// ─── GET /users/me ────────────────────────────────────────────────────────────

describe('GET /users/me', () => {
    test('returns the user profile when authenticated', async () => {
        prisma.user.findUnique.mockResolvedValue(fakeUser)

        const res = await request(app)
            .get('/users/me')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(200)
        expect(res.body.user).toHaveProperty('id', USER_ID)
        expect(res.body.user).toHaveProperty('dayStartTime')
        expect(res.body.user).not.toHaveProperty('passwordHash')
    })

    test('returns 401 without a token', async () => {
        const res = await request(app).get('/users/me')
        expect(res.status).toBe(401)
    })

    test('returns 401 with a malformed token', async () => {
        const res = await request(app)
            .get('/users/me')
            .set('Authorization', 'Bearer not.a.token')
        expect(res.status).toBe(401)
    })

    test('returns 404 if user no longer exists', async () => {
        prisma.user.findUnique.mockResolvedValue(null)

        const res = await request(app)
            .get('/users/me')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(404)
    })
})

// ─── PATCH /users/me ──────────────────────────────────────────────────────────

describe('PATCH /users/me', () => {
    test('updates name and returns the updated user', async () => {
        prisma.user.update.mockResolvedValue({ ...fakeUser, name: 'Sri' })

        const res = await request(app)
            .patch('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Sri' })

        expect(res.status).toBe(200)
        expect(res.body.user.name).toBe('Sri')
    })

    test('updates restDay when value is 0–6', async () => {
        prisma.user.update.mockResolvedValue({ ...fakeUser, restDay: 6 })

        const res = await request(app)
            .patch('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ restDay: 6 })

        expect(res.status).toBe(200)
        expect(res.body.user.restDay).toBe(6)
    })

    test('returns 400 when restDay is out of range', async () => {
        const res = await request(app)
            .patch('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ restDay: 7 })

        expect(res.status).toBe(400)
    })

    test('returns 400 when no valid fields are provided', async () => {
        const res = await request(app)
            .patch('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({ unknownField: 'value' })

        expect(res.status).toBe(400)
    })

    test('returns 401 without a token', async () => {
        const res = await request(app).patch('/users/me').send({ name: 'X' })
        expect(res.status).toBe(401)
    })
})
