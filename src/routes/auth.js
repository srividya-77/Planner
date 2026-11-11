/**
 * src/routes/auth.js
 *
 * POST /auth/signup  — create account
 * POST /auth/login   — get JWT token
 */
const express  = require('express')
const bcrypt   = require('bcrypt')
const jwt      = require('jsonwebtoken')
const prisma   = require('../db/prisma')

const router = express.Router()
const SALT_ROUNDS = 12

// ─── POST /auth/signup ────────────────────────────────────────────────────────
// Body: { name, email, password }
// Response: 201 { user: { id, name, email } }

router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'name is required' })
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'valid email is required' })
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'password must be at least 8 characters' })
    }

    try {
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
            return res.status(409).json({ error: 'email already in use' })
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
        const user = await prisma.user.create({
            data: { name: name.trim(), email, passwordHash },
            select: { id: true, name: true, email: true },
        })

        return res.status(201).json({ user })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── POST /auth/login ─────────────────────────────────────────────────────────
// Body: { email, password }
// Response: 200 { token, user: { id, name, email } }

router.post('/login', async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' })
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
            // Same message for wrong email and wrong password — don't leak which one
            return res.status(401).json({ error: 'Invalid email or password' })
        }

        const match = await bcrypt.compare(password, user.passwordHash)
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' })
        }

        const token = jwt.sign(
            { sub: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
        )

        return res.status(200).json({
            token,
            user: { id: user.id, name: user.name, email: user.email },
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

module.exports = router
