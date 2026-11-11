/**
 * src/routes/goals.js
 *
 * GET    /goals          — list own goals ordered by rank
 * POST   /goals          — create a goal
 * PATCH  /goals/:id      — update name, weight, or rank
 * DELETE /goals/:id      — delete (blocked if tasks exist)
 */
const express = require('express')
const prisma  = require('../db/prisma')
const auth    = require('../middleware/auth')

const router = express.Router()
router.use(auth)

// ─── GET /goals ───────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const goals = await prisma.goal.findMany({
            where:   { ownerId: req.user.id },
            orderBy: { rank: 'asc' },
        })
        return res.status(200).json({ goals })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── POST /goals ──────────────────────────────────────────────────────────────
// Body: { name, weight, rank }

router.post('/', async (req, res) => {
    const { name, weight, rank } = req.body

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'name is required' })
    }
    if (!Number.isInteger(weight) || weight < 1 || weight > 5) {
        return res.status(400).json({ error: 'weight must be an integer 1–5' })
    }
    if (!Number.isInteger(rank) || rank < 1) {
        return res.status(400).json({ error: 'rank must be a positive integer' })
    }

    try {
        const goal = await prisma.goal.create({
            data: { ownerId: req.user.id, name: name.trim(), weight, rank },
        })
        return res.status(201).json({ goal })
    } catch (err) {
        // Unique constraint on (ownerId, rank)
        if (err.code === 'P2002') {
            return res.status(409).json({ error: `Rank ${rank} is already taken by another goal` })
        }
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── PATCH /goals/:id ─────────────────────────────────────────────────────────
// Body: any of { name, weight, rank }

router.patch('/:id', async (req, res) => {
    const { id } = req.params
    const { name, weight, rank } = req.body

    // Verify ownership
    const existing = await prisma.goal.findUnique({ where: { id } })
    if (!existing || existing.ownerId !== req.user.id) {
        return res.status(404).json({ error: 'Goal not found' })
    }

    const data = {}
    if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ error: 'name must be a non-empty string' })
        }
        data.name = name.trim()
    }
    if (weight !== undefined) {
        if (!Number.isInteger(weight) || weight < 1 || weight > 5) {
            return res.status(400).json({ error: 'weight must be an integer 1–5' })
        }
        data.weight = weight
    }
    if (rank !== undefined) {
        if (!Number.isInteger(rank) || rank < 1) {
            return res.status(400).json({ error: 'rank must be a positive integer' })
        }
        data.rank = rank
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' })
    }

    try {
        const goal = await prisma.goal.update({ where: { id }, data })
        return res.status(200).json({ goal })
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ error: `Rank ${rank} is already taken by another goal` })
        }
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── DELETE /goals/:id ────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
    const { id } = req.params

    const existing = await prisma.goal.findUnique({ where: { id } })
    if (!existing || existing.ownerId !== req.user.id) {
        return res.status(404).json({ error: 'Goal not found' })
    }

    try {
        await prisma.goal.delete({ where: { id } })
        return res.status(204).send()
    } catch (err) {
        // P2003 = foreign key constraint (tasks still reference this goal)
        if (err.code === 'P2003') {
            return res.status(409).json({ error: 'Cannot delete a goal that still has tasks. Delete or reassign tasks first.' })
        }
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

module.exports = router
