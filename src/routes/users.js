/**
 * src/routes/users.js
 *
 * GET  /users/me        — get own profile + settings
 * PATCH /users/me       — update name or study/burnout settings
 */
const express = require('express')
const prisma  = require('../db/prisma')
const auth    = require('../middleware/auth')

const router = express.Router()

// All routes require authentication
router.use(auth)

// ─── GET /users/me ────────────────────────────────────────────────────────────

router.get('/me', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where:  { id: req.user.id },
            select: {
                id: true, name: true, email: true,
                dayStartTime: true, dayEndTime: true,
                lunchStart: true, lunchEnd: true,
                dinnerStart: true, dinnerEnd: true,
                dayCutoff: true, restDay: true,
                timezone: true, createdAt: true,
            },
        })
        if (!user) return res.status(404).json({ error: 'User not found' })
        return res.status(200).json({ user })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── PATCH /users/me ──────────────────────────────────────────────────────────
// Accepts any subset of: name, dayStartTime, dayEndTime,
//   lunchStart, lunchEnd, dinnerStart, dinnerEnd, dayCutoff, restDay

router.patch('/me', async (req, res) => {
    const allowed = [
        'name', 'dayStartTime', 'dayEndTime',
        'lunchStart', 'lunchEnd', 'dinnerStart', 'dinnerEnd',
        'dayCutoff', 'restDay',
    ]

    const data = {}
    for (const key of allowed) {
        if (req.body[key] !== undefined) data[key] = req.body[key]
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' })
    }

    // Validate restDay if provided
    if (data.restDay !== undefined) {
        if (!Number.isInteger(data.restDay) || data.restDay < 0 || data.restDay > 6) {
            return res.status(400).json({ error: 'restDay must be an integer 0–6' })
        }
    }

    try {
        const user = await prisma.user.update({
            where:  { id: req.user.id },
            data,
            select: {
                id: true, name: true, email: true,
                dayStartTime: true, dayEndTime: true,
                lunchStart: true, lunchEnd: true,
                dinnerStart: true, dinnerEnd: true,
                dayCutoff: true, restDay: true,
            },
        })
        return res.status(200).json({ user })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

module.exports = router
