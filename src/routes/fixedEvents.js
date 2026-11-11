/**
 * src/routes/fixedEvents.js
 *
 * GET    /fixed-events       — list own fixed events
 * POST   /fixed-events       — create a fixed event
 * PATCH  /fixed-events/:id   — update a fixed event
 * DELETE /fixed-events/:id   — delete a fixed event
 */
const express = require('express')
const prisma  = require('../db/prisma')
const auth    = require('../middleware/auth')

const router = express.Router()
router.use(auth)

const VALID_REPEAT_RULES = ['none', 'weekly']

// ─── GET /fixed-events ────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const events = await prisma.fixedEvent.findMany({
            where:   { ownerId: req.user.id },
            orderBy: { startTime: 'asc' },
        })
        return res.status(200).json({ events })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── POST /fixed-events ───────────────────────────────────────────────────────
// Body: { title, startTime, endTime, repeatRule? }

router.post('/', async (req, res) => {
    const { title, startTime, endTime, repeatRule = 'none' } = req.body

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'title is required' })
    }
    if (!startTime || isNaN(Date.parse(startTime))) {
        return res.status(400).json({ error: 'startTime must be a valid ISO date string' })
    }
    if (!endTime || isNaN(Date.parse(endTime))) {
        return res.status(400).json({ error: 'endTime must be a valid ISO date string' })
    }
    if (new Date(endTime) <= new Date(startTime)) {
        return res.status(400).json({ error: 'endTime must be after startTime' })
    }
    if (!VALID_REPEAT_RULES.includes(repeatRule)) {
        return res.status(400).json({ error: `repeatRule must be one of: ${VALID_REPEAT_RULES.join(', ')}` })
    }

    try {
        const event = await prisma.fixedEvent.create({
            data: {
                ownerId:    req.user.id,
                title:      title.trim(),
                startTime:  new Date(startTime),
                endTime:    new Date(endTime),
                repeatRule,
            },
        })
        return res.status(201).json({ event })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── PATCH /fixed-events/:id ──────────────────────────────────────────────────

router.patch('/:id', async (req, res) => {
    const { id } = req.params

    const existing = await prisma.fixedEvent.findUnique({ where: { id } })
    if (!existing || existing.ownerId !== req.user.id) {
        return res.status(404).json({ error: 'Fixed event not found' })
    }

    const data = {}
    const { title, startTime, endTime, repeatRule } = req.body

    if (title !== undefined) {
        if (typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ error: 'title must be a non-empty string' })
        }
        data.title = title.trim()
    }
    if (startTime !== undefined) {
        if (isNaN(Date.parse(startTime))) return res.status(400).json({ error: 'startTime must be a valid ISO date string' })
        data.startTime = new Date(startTime)
    }
    if (endTime !== undefined) {
        if (isNaN(Date.parse(endTime))) return res.status(400).json({ error: 'endTime must be a valid ISO date string' })
        data.endTime = new Date(endTime)
    }
    // Validate end > start using updated or existing values
    const resolvedStart = data.startTime || existing.startTime
    const resolvedEnd   = data.endTime   || existing.endTime
    if (resolvedEnd <= resolvedStart) {
        return res.status(400).json({ error: 'endTime must be after startTime' })
    }
    if (repeatRule !== undefined) {
        if (!VALID_REPEAT_RULES.includes(repeatRule)) {
            return res.status(400).json({ error: `repeatRule must be one of: ${VALID_REPEAT_RULES.join(', ')}` })
        }
        data.repeatRule = repeatRule
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' })
    }

    try {
        const event = await prisma.fixedEvent.update({ where: { id }, data })
        return res.status(200).json({ event })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── DELETE /fixed-events/:id ─────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
    const { id } = req.params

    const existing = await prisma.fixedEvent.findUnique({ where: { id } })
    if (!existing || existing.ownerId !== req.user.id) {
        return res.status(404).json({ error: 'Fixed event not found' })
    }

    try {
        await prisma.fixedEvent.delete({ where: { id } })
        return res.status(204).send()
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

module.exports = router
