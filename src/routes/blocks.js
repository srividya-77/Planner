/**
 * src/routes/blocks.js
 *
 * GET   /blocks          — list own blocks for a given date
 * POST  /blocks          — create a scheduled block (with limit checks)
 * PATCH /blocks/:id      — complete or cancel a block, record actual minutes
 */
const express = require('express')
const prisma  = require('../db/prisma')
const auth    = require('../middleware/auth')

const router = express.Router()
router.use(auth)

const DAILY_LIMIT  = 8
const WEEKLY_LIMIT = 40

// ─── helpers ──────────────────────────────────────────────────────────────────

// Returns the Monday of the week containing `date` at UTC midnight
function weekStart(date) {
    const d = new Date(date)
    const day = d.getUTCDay()                   // 0 = Sunday
    const diff = (day === 0 ? -6 : 1 - day)    // shift to Monday
    d.setUTCDate(d.getUTCDate() + diff)
    d.setUTCHours(0, 0, 0, 0)
    return d
}

// ─── GET /blocks ──────────────────────────────────────────────────────────────
// Query: ?date=2026-11-03   (returns all blocks for that UTC date)

router.get('/', async (req, res) => {
    const { date } = req.query
    if (!date || isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'date query param must be a valid date string (e.g. 2026-11-03)' })
    }

    const dayStart = new Date(date)
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

    try {
        const blocks = await prisma.block.findMany({
            where: {
                userId:    req.user.id,
                startTime: { gte: dayStart, lt: dayEnd },
                status:    { not: 'cancelled' },
            },
            orderBy: { startTime: 'asc' },
            include: { task: { select: { id: true, title: true } } },
        })
        return res.status(200).json({ blocks })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── POST /blocks ─────────────────────────────────────────────────────────────
// Body: { taskId, startTime, endTime }
// Checks daily and weekly limits before creating.

router.post('/', async (req, res) => {
    const { taskId, startTime, endTime } = req.body

    if (!taskId || typeof taskId !== 'string') {
        return res.status(400).json({ error: 'taskId is required' })
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

    // Verify task belongs to this user
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.ownerId !== req.user.id) {
        return res.status(404).json({ error: 'Task not found' })
    }

    const start = new Date(startTime)

    // Daily limit check
    const dayBegin = new Date(start)
    dayBegin.setUTCHours(0, 0, 0, 0)
    const dayFinish = new Date(dayBegin)
    dayFinish.setUTCDate(dayFinish.getUTCDate() + 1)

    const weekBegin = weekStart(start)
    const weekFinish = new Date(weekBegin)
    weekFinish.setUTCDate(weekFinish.getUTCDate() + 7)

    try {
        const [blocksToday, blocksThisWeek] = await Promise.all([
            prisma.block.count({
                where: {
                    userId:    req.user.id,
                    startTime: { gte: dayBegin, lt: dayFinish },
                    status:    { not: 'cancelled' },
                },
            }),
            prisma.block.count({
                where: {
                    userId:    req.user.id,
                    startTime: { gte: weekBegin, lt: weekFinish },
                    status:    { not: 'cancelled' },
                },
            }),
        ])

        if (blocksToday >= DAILY_LIMIT) {
            return res.status(422).json({ error: 'Daily block limit reached (8 blocks)', reason: 'DAILY_LIMIT' })
        }
        if (blocksThisWeek >= WEEKLY_LIMIT) {
            return res.status(422).json({ error: 'Weekly block limit reached (40 blocks)', reason: 'WEEKLY_LIMIT' })
        }

        const block = await prisma.block.create({
            data: {
                userId:    req.user.id,
                taskId,
                startTime: start,
                endTime:   new Date(endTime),
            },
            include: { task: { select: { id: true, title: true } } },
        })
        return res.status(201).json({ block })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── PATCH /blocks/:id ────────────────────────────────────────────────────────
// Body: { status, actualMinutes? }
// Used to mark a block completed (with actual time) or cancelled.

router.patch('/:id', async (req, res) => {
    const { id } = req.params
    const { status, actualMinutes } = req.body

    const existing = await prisma.block.findUnique({ where: { id } })
    if (!existing || existing.userId !== req.user.id) {
        return res.status(404).json({ error: 'Block not found' })
    }

    const VALID_TRANSITIONS = ['completed', 'cancelled', 'overrun']
    if (!status || !VALID_TRANSITIONS.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${VALID_TRANSITIONS.join(', ')}` })
    }

    const data = { status }

    if (status === 'completed' || status === 'overrun') {
        if (actualMinutes === undefined || !Number.isInteger(actualMinutes) || actualMinutes < 0) {
            return res.status(400).json({ error: 'actualMinutes must be a non-negative integer when completing or marking overrun' })
        }
        data.actualMinutes = actualMinutes
    }

    try {
        // If completing a block, update task's timeSpent and timeRemaining atomically
        if (status === 'completed' || status === 'overrun') {
            const [block] = await prisma.$transaction([
                prisma.block.update({ where: { id }, data }),
                prisma.task.update({
                    where: { id: existing.taskId },
                    data: {
                        timeSpentMinutes:     { increment: actualMinutes },
                        timeRemainingMinutes: {
                            decrement: actualMinutes,
                        },
                    },
                }),
            ])
            return res.status(200).json({ block })
        }

        const block = await prisma.block.update({ where: { id }, data })
        return res.status(200).json({ block })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

module.exports = router
