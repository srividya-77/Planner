/**
 * src/routes/auth.test.js
 */
jest.mock('../db/prisma')

const request = require('supertest')
const bcrypt  = require('bcrypt')
const app     = require('../../app')
const prisma  = require('../db/prisma')

// A hashed version of 'password123' — generated once so tests don't slow down
let hashedPassword
beforeAll(async () => {
    hashedPassword = await bcrypt.hash('password123', 1) // rounds=1 for speed in tests
})

beforeEach(() => jest.clearAllMocks())

const fakeUser = {
    id:           'user-1',
    name:         'Srividya',
    email:        'sri@example.com',
    passwordHash: '',  // set in beforeAll
}

// ─── POST /auth/signup ────────────────────────────────────────────────────────

describe('POST /auth/signup', () => {
    test('creates a user and returns 201', async () => {
        prisma.user.findUnique.mockResolvedValue(null)
        prisma.user.create.mockResolvedValue({ id: 'user-1', name: 'Srividya', email: 'sri@example.com' })

        const res = await request(app).post('/auth/signup').send({
            name:     'Srividya',
            email:    'sri@example.com',
            password: 'password123',
        })

        expect(res.status).toBe(201)
        expect(res.body.user).toHaveProperty('id')
        expect(res.body.user).toHaveProperty('name', 'Srividya')
        expect(res.body.user).not.toHaveProperty('passwordHash')
    })

    test('returns 409 when email is already in use', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'user-1' })

        const res = await request(app).post('/auth/signup').send({
            name:     'Srividya',
            email:    'sri@example.com',
            password: 'password123',
        })

        expect(res.status).toBe(409)
        expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when name is missing', async () => {
        const res = await request(app).post('/auth/signup').send({
            email: 'sri@example.com', password: 'password123',
        })
        expect(res.status).toBe(400)
    })

    test('returns 400 when email has no @', async () => {
        const res = await request(app).post('/auth/signup').send({
            name: 'Srividya', email: 'notanemail', password: 'password123',
        })
        expect(res.status).toBe(400)
    })

    test('returns 400 when password is shorter than 8 characters', async () => {
        const res = await request(app).post('/auth/signup').send({
            name: 'Srividya', email: 'sri@example.com', password: 'short',
        })
        expect(res.status).toBe(400)
    })
})

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
    test('returns 200 with token and user on valid credentials', async () => {
        prisma.user.findUnique.mockResolvedValue({
            ...fakeUser,
            passwordHash: hashedPassword,
        })

        const res = await request(app).post('/auth/login').send({
            email: 'sri@example.com', password: 'password123',
        })

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('token')
        expect(res.body.user).toHaveProperty('id', 'user-1')
        expect(res.body.user).not.toHaveProperty('passwordHash')
    })

    test('returns 401 when user does not exist', async () => {
        prisma.user.findUnique.mockResolvedValue(null)

        const res = await request(app).post('/auth/login').send({
            email: 'nobody@example.com', password: 'password123',
        })

        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Invalid email or password')
    })

    test('returns 401 when password is wrong', async () => {
        prisma.user.findUnique.mockResolvedValue({
            ...fakeUser,
            passwordHash: hashedPassword,
        })

        const res = await request(app).post('/auth/login').send({
            email: 'sri@example.com', password: 'wrongpassword',
        })

        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Invalid email or password')
    })

    test('returns 400 when email or password is missing', async () => {
        const res = await request(app).post('/auth/login').send({ email: 'sri@example.com' })
        expect(res.status).toBe(400)
    })

    test('does not leak which field was wrong — same error message for bad email vs bad password', async () => {
        prisma.user.findUnique.mockResolvedValue(null)
        const res1 = await request(app).post('/auth/login').send({ email: 'x@x.com', password: 'pass1234' })

        prisma.user.findUnique.mockResolvedValue({ ...fakeUser, passwordHash: hashedPassword })
        const res2 = await request(app).post('/auth/login').send({ email: 'sri@example.com', password: 'wrongpass' })

        expect(res1.body.error).toBe(res2.body.error)
    })
})
