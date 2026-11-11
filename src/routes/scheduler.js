/**
 * routes/scheduler.js
 *
 * Two layers:
 *
 * 1. Auth-protected real-data routes (prefix /scheduler):
 *    POST /scheduler/suggest        — pulls real DB data for the user, returns best slot
 *    POST /scheduler/week           — runs suggest across the full week for the user
 *
 * 2. Pure-function test routes (same prefix, no DB):
 *    POST /scheduler/suggest-slot   — body carries all data, used in tests
 *    POST /scheduler/overrun        — body carries all data
 *    POST /scheduler/group-slots    — body carries all data
 *    POST /scheduler/week-view      — body carries all data
 */

const express = require('express')
const router  = express.Router()
const prisma  = require('../db/prisma')
const auth    = require('../middleware/auth')

const {
    suggestSlot,
    mergeIntervals,
    getFreeSlots,
    findCandidateSlots,
} = require('../scheduler/index')

// ─── helpers ──────────────────────────────────────────────────────────────────

function weekStart(date) {
    const d = new Date(date)
    const day = d.getUTCDay()
    const diff = (day === 0 ? -6 : 1 - day)
    d.setUTCDate(d.getUTCDate() + diff)
    d.setUTCHours(0, 0, 0, 0)
    return d
}

// Expand weekly fixed events onto a specific date
function expandFixedEvents(events, dayDate) {
    const result = []
    for (const ev of events) {
        if (ev.repeatRule === 'none') {
            result.push({ start: ev.startTime, end: ev.endTime })
        } else if (ev.repeatRule === 'weekly') {
            // Check if the event's day-of-week matches dayDate's day-of-week
            if (ev.startTime.getUTCDay() === dayDate.getUTCDay()) {
                const start = new Date(dayDate)
                start.setUTCHours(
                    ev.startTime.getUTCHours(),
                    ev.startTime.getUTCMinutes(), 0, 0,
                )
                const end = new Date(dayDate)
                end.setUTCHours(
                    ev.endTime.getUTCHours(),
                    ev.endTime.getUTCMinutes(), 0, 0,
                )
                result.push({ start, end })
            }
        }
    }
    return result
}

// Build meal window intervals from user settings for a given UTC date
function mealIntervals(user, dayDate) {
    const intervals = []
    for (const [startStr, endStr] of [
        [user.lunchStart,  user.lunchEnd],
        [user.dinnerStart, user.dinnerEnd],
    ]) {
        const [sh, sm] = startStr.split(':').map(Number)
        const [eh, em] = endStr.split(':').map(Number)
        const start = new Date(dayDate)
        start.setUTCHours(sh, sm, 0, 0)
        const end = new Date(dayDate)
        end.setUTCHours(eh, em, 0, 0)
        intervals.push({ start, end })
    }
    return intervals
}

// ─── POST /scheduler/suggest ─────────────────────────────────────────────────
// Auth required. Pulls all data from DB for the requesting user.
// Body: { date: "2026-11-03" }
// Response: { task, start, end, blockDuration, gap, score } | { reason }

router.post('/suggest', auth, async (req, res) => {
    const { date } = req.body
    if (!date || isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'date must be a valid date string (e.g. 2026-11-03)' })
    }

    const dayDate = new Date(date)
    dayDate.setUTCHours(0, 0, 0, 0)

    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) return res.status(404).json({ error: 'User not found' })

        // Build day window from user settings
        const [dsh, dsm] = user.dayStartTime.split(':').map(Number)
        const [deh, dem] = user.dayEndTime.split(':').map(Number)
        const dayStart = new Date(dayDate)
        dayStart.setUTCHours(dsh, dsm, 0, 0)
        const dayEnd = new Date(dayDate)
        dayEnd.setUTCHours(deh, dem, 0, 0)

        const dayBegin  = new Date(dayDate)
        const dayFinish = new Date(dayDate)
        dayFinish.setUTCDate(dayFinish.getUTCDate() + 1)

        const wStart  = weekStart(dayDate)
        const wFinish = new Date(wStart)
        wFinish.setUTCDate(wFinish.getUTCDate() + 7)

        // Fetch everything in parallel
        const [tasks, goals, blocks, fixedEvents, blocksToday, blocksThisWeek] = await Promise.all([
            prisma.task.findMany({
                where:   { ownerId: req.user.id, status: { in: ['pending', 'in_progress'] } },
                include: { goal: true },
            }),
            prisma.goal.findMany({ where: { ownerId: req.user.id } }),
            prisma.block.findMany({
                where: {
                    userId:    req.user.id,
                    startTime: { gte: dayBegin, lt: dayFinish },
                    status:    { not: 'cancelled' },
                },
            }),
            prisma.fixedEvent.findMany({ where: { ownerId: req.user.id } }),
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
                    startTime: { gte: wStart, lt: wFinish },
                    status:    { not: 'cancelled' },
                },
            }),
        ])

        // Build busy intervals: existing blocks + fixed events + meal windows
        const blockIntervals = blocks.map(b => ({ start: b.startTime, end: b.endTime }))
        const eventIntervals = expandFixedEvents(fixedEvents, dayDate)
        // Only include meal intervals that overlap with the study window
        const meals          = mealIntervals(user, dayDate).filter(m => m.end > dayStart && m.start < dayEnd)
        const busyIntervals  = [...blockIntervals, ...eventIntervals, ...meals]

        // Compute consecutive blocks (back-to-back today, in order)
        const sortedBlocks = [...blocks].sort((a, b) => a.startTime - b.startTime)
        let consecutiveBlocks = 0
        for (let i = sortedBlocks.length - 1; i >= 0; i--) {
            if (i === sortedBlocks.length - 1) { consecutiveBlocks = 1; continue }
            const gap = (sortedBlocks[i + 1].startTime - sortedBlocks[i].endTime) / 60000
            if (gap <= 25) consecutiveBlocks++
            else break
        }

        // Shape tasks for the scheduler
        const schedulerTasks = tasks.map(t => ({
            id:                   t.id,
            deadline:             t.deadline,
            createdAt:            t.createdAt,
            timeRemainingMinutes: t.timeRemainingMinutes,
            goal: {
                weight: t.goal.weight,
                rank:   t.goal.rank,
            },
        }))

        const result = suggestSlot(
            schedulerTasks,
            goals.length,
            blocksToday,
            blocksThisWeek,
            consecutiveBlocks,
            busyIntervals,
            dayStart,
            dayEnd,
            req.body.breakAfter !== false, // default true; pass false to skip gap
        )

        return res.status(200).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── POST /scheduler/week ─────────────────────────────────────────────────────
// Auth required. Returns one suggestion per day for the week containing `date`.
// Body: { date: "2026-11-03" }

router.post('/week', auth, async (req, res) => {
    const { date } = req.body
    if (!date || isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'date must be a valid date string' })
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } })
        if (!user) return res.status(404).json({ error: 'User not found' })

        const [dsh, dsm] = user.dayStartTime.split(':').map(Number)
        const [deh, dem] = user.dayEndTime.split(':').map(Number)

        const monday = weekStart(new Date(date))
        const weekEnd = new Date(monday)
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

        const [tasks, goals, allBlocks, fixedEvents] = await Promise.all([
            prisma.task.findMany({
                where:   { ownerId: req.user.id, status: { in: ['pending', 'in_progress'] } },
                include: { goal: true },
            }),
            prisma.goal.findMany({ where: { ownerId: req.user.id } }),
            prisma.block.findMany({
                where: {
                    userId:    req.user.id,
                    startTime: { gte: monday, lt: weekEnd },
                    status:    { not: 'cancelled' },
                },
                orderBy: { startTime: 'asc' },
            }),
            prisma.fixedEvent.findMany({ where: { ownerId: req.user.id } }),
        ])

        const schedulerTasks = tasks.map(t => ({
            id:                   t.id,
            deadline:             t.deadline,
            createdAt:            t.createdAt,
            timeRemainingMinutes: t.timeRemainingMinutes,
            goal: { weight: t.goal.weight, rank: t.goal.rank },
        }))

        let runningWeeklyCount = allBlocks.length
        const suggestions = []

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(monday)
            dayDate.setUTCDate(dayDate.getUTCDate() + i)

            const dayStart = new Date(dayDate)
            dayStart.setUTCHours(dsh, dsm, 0, 0)
            const dayEnd = new Date(dayDate)
            dayEnd.setUTCHours(deh, dem, 0, 0)

            const dayFinish = new Date(dayDate)
            dayFinish.setUTCDate(dayFinish.getUTCDate() + 1)

            const dayBlocks = allBlocks.filter(
                b => b.startTime >= dayDate && b.startTime < dayFinish,
            )

            const blockIntervals = dayBlocks.map(b => ({ start: b.startTime, end: b.endTime }))
            const eventIntervals = expandFixedEvents(fixedEvents, dayDate)
            const meals          = mealIntervals(user, dayDate).filter(m => m.end > dayStart && m.start < dayEnd)
            const busyIntervals  = [...blockIntervals, ...eventIntervals, ...meals]

            // Consecutive blocks for this day
            let consecutiveBlocks = 0
            for (let j = dayBlocks.length - 1; j >= 0; j--) {
                if (j === dayBlocks.length - 1) { consecutiveBlocks = 1; continue }
                const gap = (dayBlocks[j + 1].startTime - dayBlocks[j].endTime) / 60000
                if (gap <= 25) consecutiveBlocks++
                else break
            }

            const result = suggestSlot(
                schedulerTasks,
                goals.length,
                dayBlocks.length,
                runningWeeklyCount,
                consecutiveBlocks,
                busyIntervals,
                dayStart,
                dayEnd,
            )

            if (result.start) runningWeeklyCount++

            suggestions.push({ date: dayDate.toISOString().slice(0, 10), result })
        }

        return res.status(200).json({ suggestions })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Internal server error' })
    }
})

// ─── POST /scheduler/suggest-slot ────────────────────────────────────────────
// Body:
//   tasks              Array of { deadline, createdAt, timeRemainingMinutes,
//                                 goal: { weight, rank } }
//   totalGoals         number
//   blocksToday        number
//   blocksThisWeek     number
//   consecutiveBlocks  number  — back-to-back blocks scheduled today without a break
//   busyIntervals      [{ start: ISO string, end: ISO string }]
//   dayStart           ISO string
//   dayEnd             ISO string
//
// Response:
//   200 { task, start, end, blockDuration, gap, score }
//   200 { reason }   — DAILY_LIMIT | WEEKLY_LIMIT | NO_FREE_SLOT | NO_TASKS
//   400 { error }

router.post('/suggest-slot', (req, res) => {
    const {
        tasks,
        totalGoals,
        blocksToday,
        blocksThisWeek,
        consecutiveBlocks = 0,
        busyIntervals,
        dayStart,
        dayEnd,
    } = req.body

    // --- validation ---
    if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'tasks must be an array' })
    }
    if (typeof totalGoals !== 'number' || totalGoals < 1) {
        return res.status(400).json({ error: 'totalGoals must be a number >= 1' })
    }
    if (typeof blocksToday !== 'number' || typeof blocksThisWeek !== 'number') {
        return res.status(400).json({ error: 'blocksToday and blocksThisWeek must be numbers' })
    }
    if (!Array.isArray(busyIntervals)) {
        return res.status(400).json({ error: 'busyIntervals must be an array' })
    }
    if (!dayStart || !dayEnd) {
        return res.status(400).json({ error: 'dayStart and dayEnd are required' })
    }

    // --- parse dates ---
    const parsedTasks = tasks.map(t => ({
        ...t,
        deadline:  new Date(t.deadline),
        createdAt: new Date(t.createdAt),
    }))
    const parsedBusy = busyIntervals.map(i => ({
        start: new Date(i.start),
        end:   new Date(i.end),
    }))

    const result = suggestSlot(
        parsedTasks,
        totalGoals,
        blocksToday,
        blocksThisWeek,
        consecutiveBlocks,
        parsedBusy,
        new Date(dayStart),
        new Date(dayEnd),
    )

    return res.status(200).json(result)
})

// ─── POST /scheduler/overrun ──────────────────────────────────────────────────
// Called when a running block needs more time than originally planned.
// Returns a ranked list of options: extend, move to next slot, or postpone.
//
// Body:
//   currentBlockStart  ISO string  — when the current block started
//   currentBlockEnd    ISO string  — when it was originally supposed to end
//   extraMinutes       number      — how many extra minutes are needed
//   busyIntervals      [{ start, end }]  — remaining busy intervals for the day
//   dayEnd             ISO string
//   maxBlockDuration   number (minutes, default 60)
//
// Response:
//   200 { options: [ { type, ...details } ] }
//   400 { error }

router.post('/overrun', (req, res) => {
    const {
        currentBlockStart,
        currentBlockEnd,
        extraMinutes,
        busyIntervals,
        dayEnd,
        maxBlockDuration = 60,
    } = req.body

    if (!currentBlockStart || !currentBlockEnd) {
        return res.status(400).json({ error: 'currentBlockStart and currentBlockEnd are required' })
    }
    if (typeof extraMinutes !== 'number' || extraMinutes <= 0) {
        return res.status(400).json({ error: 'extraMinutes must be a positive number' })
    }
    if (!Array.isArray(busyIntervals)) {
        return res.status(400).json({ error: 'busyIntervals must be an array' })
    }
    if (!dayEnd) {
        return res.status(400).json({ error: 'dayEnd is required' })
    }

    const blockStart  = new Date(currentBlockStart)
    const blockEnd    = new Date(currentBlockEnd)
    const dayEndDate  = new Date(dayEnd)
    const parsedBusy  = busyIntervals.map(i => ({ start: new Date(i.start), end: new Date(i.end) }))

    const options = []

    // Option 1: extend the current block
    const extendedEnd      = new Date(blockEnd.getTime() + extraMinutes * 60000)
    const currentDuration  = (blockEnd - blockStart) / 60000
    const extendedDuration = currentDuration + extraMinutes

    // Check: does the extended block run into the next busy interval?
    const nextBusy = parsedBusy
        .filter(i => i.start >= blockEnd)
        .sort((a, b) => a.start - b.start)[0]

    const extendClear = !nextBusy || extendedEnd <= nextBusy.start
    const extendFits  = extendedDuration <= maxBlockDuration
    const extendInDay = extendedEnd <= dayEndDate

    if (extendClear && extendFits && extendInDay) {
        options.push({
            type:        'EXTEND',
            newEnd:      extendedEnd.toISOString(),
            extraMinutes,
            description: `Extend current block by ${extraMinutes} min (ends at ${extendedEnd.toISOString()})`,
        })
    }

    // Option 2: end now, find next available slot for remaining work
    const merged     = mergeIntervals([...parsedBusy, { start: blockStart, end: blockEnd }])
    const freeSlots  = getFreeSlots(merged, blockEnd, dayEndDate)
    const candidates = findCandidateSlots(freeSlots, extraMinutes, 15)

    if (candidates.length > 0) {
        const nextStart = candidates[0]
        const nextEnd   = new Date(nextStart.getTime() + extraMinutes * 60000)
        options.push({
            type:        'MOVE_TO_NEXT_SLOT',
            start:       nextStart.toISOString(),
            end:         nextEnd.toISOString(),
            description: `Continue remaining ${extraMinutes} min at next free slot (${nextStart.toISOString()})`,
        })
    }

    // Option 3: postpone to tomorrow — always available as a fallback
    options.push({
        type:        'POSTPONE',
        description: `Postpone remaining ${extraMinutes} min to the next scheduled session`,
    })

    return res.status(200).json({ options })
})

// ─── POST /scheduler/group-slots ─────────────────────────────────────────────
// Finds free slots where all members of a group are simultaneously available.
//
// Body:
//   members    [{ busyIntervals: [{ start, end }] }]  — one entry per person
//   dayStart   ISO string
//   dayEnd     ISO string
//   blockDuration  number (minutes)
//   gap            number (minutes)
//
// Response:
//   200 { freeSlots: [{ start, end }], candidateSlots: [ISO string] }
//   400 { error }

router.post('/group-slots', (req, res) => {
    const { members, dayStart, dayEnd, blockDuration, gap } = req.body

    if (!Array.isArray(members) || members.length < 2) {
        return res.status(400).json({ error: 'members must be an array with at least 2 people' })
    }
    if (!dayStart || !dayEnd) {
        return res.status(400).json({ error: 'dayStart and dayEnd are required' })
    }
    if (typeof blockDuration !== 'number' || typeof gap !== 'number') {
        return res.status(400).json({ error: 'blockDuration and gap must be numbers' })
    }

    const start = new Date(dayStart)
    const end   = new Date(dayEnd)

    // Get free slots for each member independently
    const perMemberFreeSlots = members.map(member => {
        const busy   = member.busyIntervals.map(i => ({ start: new Date(i.start), end: new Date(i.end) }))
        const merged = busy.length > 0 ? mergeIntervals(busy) : []
        return getFreeSlots(merged, start, end)
    })

    // Intersect all members' free slots
    // Start with first member's free slots and intersect each subsequent member
    let intersection = perMemberFreeSlots[0]

    for (let i = 1; i < perMemberFreeSlots.length; i++) {
        intersection = intersectFreeSlots(intersection, perMemberFreeSlots[i])
    }

    const candidateSlots = findCandidateSlots(intersection, blockDuration, gap)

    return res.status(200).json({
        freeSlots:      intersection,
        candidateSlots: candidateSlots.map(d => d.toISOString()),
    })
})

/**
 * Returns intervals where both sets overlap.
 * Both inputs must be sorted and non-overlapping (i.e. already merged).
 *
 * @param {Array<{start: Date, end: Date}>} a
 * @param {Array<{start: Date, end: Date}>} b
 * @returns {Array<{start: Date, end: Date}>}
 */
function intersectFreeSlots(a, b) {
    const result = []
    let i = 0
    let j = 0

    while (i < a.length && j < b.length) {
        const overlapStart = new Date(Math.max(a[i].start, b[j].start))
        const overlapEnd   = new Date(Math.min(a[i].end,   b[j].end))

        if (overlapStart < overlapEnd) {
            result.push({ start: overlapStart, end: overlapEnd })
        }

        // Advance the pointer whose interval ends sooner
        if (a[i].end < b[j].end) {
            i++
        } else {
            j++
        }
    }

    return result
}

// ─── POST /scheduler/week-view ────────────────────────────────────────────────
// Runs suggestSlot for each day of the week and returns one suggestion per day.
//
// Body:
//   tasks              Array of { deadline, createdAt, timeRemainingMinutes,
//                                 goal: { weight, rank } }
//   totalGoals         number
//   week               [ { date: ISO string, busyIntervals: [...],
//                          blocksToday: number, consecutiveBlocks: number } ]
//                      — 7 entries, one per day (Mon–Sun)
//   blocksThisWeek     number  — blocks already scheduled before this week's suggestions
//   dayStartHour       number  — e.g. 8  (hour in UTC)
//   dayEndHour         number  — e.g. 22 (hour in UTC)
//
// Response:
//   200 { suggestions: [ { date, result } ] }
//   400 { error }

router.post('/week-view', (req, res) => {
    const {
        tasks,
        totalGoals,
        week,
        blocksThisWeek: initialWeeklyCount,
        dayStartHour,
        dayEndHour,
    } = req.body

    if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'tasks must be an array' })
    }
    if (!Array.isArray(week) || week.length !== 7) {
        return res.status(400).json({ error: 'week must be an array of exactly 7 days' })
    }
    if (typeof totalGoals !== 'number' || totalGoals < 1) {
        return res.status(400).json({ error: 'totalGoals must be a number >= 1' })
    }
    if (typeof dayStartHour !== 'number' || typeof dayEndHour !== 'number') {
        return res.status(400).json({ error: 'dayStartHour and dayEndHour must be numbers' })
    }

    const parsedTasks = tasks.map(t => ({
        ...t,
        deadline:  new Date(t.deadline),
        createdAt: new Date(t.createdAt),
    }))

    let runningWeeklyCount = typeof initialWeeklyCount === 'number' ? initialWeeklyCount : 0
    const suggestions = []

    for (const day of week) {
        if (!day.date) {
            return res.status(400).json({ error: 'each day entry must have a date field' })
        }

        const dateBase = new Date(day.date)
        const dayStart = new Date(dateBase)
        dayStart.setUTCHours(dayStartHour, 0, 0, 0)
        const dayEnd = new Date(dateBase)
        dayEnd.setUTCHours(dayEndHour, 0, 0, 0)

        const parsedBusy = (day.busyIntervals || []).map(i => ({
            start: new Date(i.start),
            end:   new Date(i.end),
        }))

        const blocksToday      = typeof day.blocksToday      === 'number' ? day.blocksToday      : 0
        const consecutiveBlocks = typeof day.consecutiveBlocks === 'number' ? day.consecutiveBlocks : 0

        const result = suggestSlot(
            parsedTasks,
            totalGoals,
            blocksToday,
            runningWeeklyCount,
            consecutiveBlocks,
            parsedBusy,
            dayStart,
            dayEnd,
        )

        // If a slot was found, count it toward the weekly total for subsequent days
        if (result.start) {
            runningWeeklyCount++
        }

        suggestions.push({ date: day.date, result })
    }

    return res.status(200).json({ suggestions })
})

module.exports = router
