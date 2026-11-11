/**
 * src/routes/tasks.js
 *
 * GET    /tasks          — list own pending/in-progress tasks
 * POST   /tasks          — create a task
 * PATCH  /tasks/:id      — update fields or mark complete/cancelled
 * DELETE /tasks/:id      — delete a task
 */
const express = require('express')
const prisma  = require('../db/prisma')
const auth    = require('../middleware/auth')

const router = express.Router()
router.use(auth)

const VALID_STATUSES    = ['pending', 'in_progress', 'completed', 'cancelled']
const VALID_REPEAT_RULES = ['none', 'daily', 'weekly', 'weekdays']

// ─── GET /tasks ───────────────────────────────────────────────────────────────
// Returns pending and in_progress tasks, ordered by deadline asc

router.get('/', async (req, res) => {
    try {
        const tasks = await prisma.task.findMany({
            where:   { ownerId: req.user.id, status: { in: ['pending', 'in_progress'] } },
            orderBy: { deadline: 'asc' },
            include: { goal: { select: { id: true, name: true, weight: true, rank: true } } },
        })
        return res.status(200).json({ tasks })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── POST /tasks ──────────────────────────────────────────────────────────────
// Body: { goalId, title, estimateMinutes, deadline, repeatRule? }

router.post('/', async (req, res) => {
    const { goalId, title, estimateMinutes, deadline, repeatRule = 'none' } = req.body

    if (!goalId || typeof goalId !== 'string') {
        return res.status(400).json({ error: 'goalId is required' })
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'title is required' })
    }
    if (!Number.isInteger(estimateMinutes) || estimateMinutes <= 0) {
        return res.status(400).json({ error: 'estimateMinutes must be a positive integer' })
    }
    if (!deadline || isNaN(Date.parse(deadline))) {
        return res.status(400).json({ error: 'deadline must be a valid date string' })
    }
    if (!VALID_REPEAT_RULES.includes(repeatRule)) {
        return res.status(400).json({ error: `repeatRule must be one of: ${VALID_REPEAT_RULES.join(', ')}` })
    }

    // Verify goal belongs to this user
    const goal = await prisma.goal.findUnique({ where: { id: goalId } })
    if (!goal || goal.ownerId !== req.user.id) {
        return res.status(404).json({ error: 'Goal not found' })
    }

    try {
        const task = await prisma.task.create({
            data: {
                ownerId:              req.user.id,
                goalId,
                title:                title.trim(),
                estimateMinutes,
                timeRemainingMinutes: estimateMinutes,  // starts equal to estimate
                deadline:             new Date(deadline),
                repeatRule,
            },
            include: { goal: { select: { id: true, name: true, weight: true, rank: true } } },
        })
        return res.status(201).json({ task })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── PATCH /tasks/:id ─────────────────────────────────────────────────────────
// Body: any of { title, estimateMinutes, timeRemainingMinutes, deadline, repeatRule, status, goalId }

router.patch('/:id', async (req, res) => {
    const { id } = req.params

    const existing = await prisma.task.findUnique({ where: { id } })
    if (!existing || existing.ownerId !== req.user.id) {
        return res.status(404).json({ error: 'Task not found' })
    }

    const data = {}
    const { title, estimateMinutes, timeRemainingMinutes, deadline, repeatRule, status, goalId } = req.body

    if (title !== undefined) {
        if (typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ error: 'title must be a non-empty string' })
        }
        data.title = title.trim()
    }
    if (estimateMinutes !== undefined) {
        if (!Number.isInteger(estimateMinutes) || estimateMinutes <= 0) {
            return res.status(400).json({ error: 'estimateMinutes must be a positive integer' })
        }
        data.estimateMinutes = estimateMinutes
    }
    if (timeRemainingMinutes !== undefined) {
        if (!Number.isInteger(timeRemainingMinutes) || timeRemainingMinutes < 0) {
            return res.status(400).json({ error: 'timeRemainingMinutes must be a non-negative integer' })
        }
        data.timeRemainingMinutes = timeRemainingMinutes
    }
    if (deadline !== undefined) {
        if (isNaN(Date.parse(deadline))) {
            return res.status(400).json({ error: 'deadline must be a valid date string' })
        }
        data.deadline = new Date(deadline)
    }
    if (repeatRule !== undefined) {
        if (!VALID_REPEAT_RULES.includes(repeatRule)) {
            return res.status(400).json({ error: `repeatRule must be one of: ${VALID_REPEAT_RULES.join(', ')}` })
        }
        data.repeatRule = repeatRule
    }
    if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
        }
        data.status = status
    }
    if (goalId !== undefined) {
        const goal = await prisma.goal.findUnique({ where: { id: goalId } })
        if (!goal || goal.ownerId !== req.user.id) {
            return res.status(404).json({ error: 'Goal not found' })
        }
        data.goalId = goalId
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' })
    }

    try {
        const task = await prisma.task.update({
            where:   { id },
            data,
            include: { goal: { select: { id: true, name: true, weight: true, rank: true } } },
        })
        return res.status(200).json({ task })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── DELETE /tasks/:id ────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
    const { id } = req.params

    const existing = await prisma.task.findUnique({ where: { id } })
    if (!existing || existing.ownerId !== req.user.id) {
        return res.status(404).json({ error: 'Task not found' })
    }

    try {
        await prisma.task.delete({ where: { id } })
        return res.status(204).send()
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

module.exports = router
