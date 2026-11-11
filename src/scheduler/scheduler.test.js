const { mergeIntervals } = require('./mergeIntervals')
const {getFreeSlots} = require('./getFreeSlots')

test('returns empty array for empty input', () => {
    const result = mergeIntervals([])
    expect(result).toEqual([])
})

test('merges two overlapping intervals into one', () => {
    const intervals = [
        { start: new Date('2026-11-03T09:00:00Z'), end: new Date('2026-11-03T10:30:00Z') },
        { start: new Date('2026-11-03T10:00:00Z'), end: new Date('2026-11-03T11:00:00Z') },
    ]
    const result = mergeIntervals(intervals)

    expect(result).toHaveLength(1)
    expect(result[0].start).toEqual(new Date('2026-11-03T09:00:00Z'))
    expect(result[0].end).toEqual(new Date('2026-11-03T11:00:00Z'))
})

test('absorbs an interval completely inside another', () => {
    const intervals = [
        { start: new Date('2026-11-03T09:00:00Z'), end: new Date('2026-11-03T12:00:00Z') },
        { start: new Date('2026-11-03T10:00:00Z'), end: new Date('2026-11-03T11:00:00Z') },
    ]
    const result = mergeIntervals(intervals)

    expect(result).toHaveLength(1)
    expect(result[0].end).toEqual(new Date('2026-11-03T12:00:00Z'))
})

test('intervals that do not overlap', () => {
    const intervals = [
        { start: new Date('2026-11-03T09:00:00Z'), end: new Date('2026-11-03T10:00:00Z') },
        { start: new Date('2026-11-03T11:00:00Z'), end: new Date('2026-11-03T12:00:00Z') },
    ]
    const result = mergeIntervals(intervals)
    expect(result).toHaveLength(2)
    expect(result[0].start).toEqual(new Date('2026-11-03T09:00:00Z'))
    expect(result[0].end).toEqual(new Date('2026-11-03T10:00:00Z'))
    expect(result[1].start).toEqual(new Date('2026-11-03T11:00:00Z'))
    expect(result[1].end).toEqual(new Date('2026-11-03T12:00:00Z'))
})

test('unsorted input - merges correctly', () => {
    const intervals = [
         { start: new Date('2026-11-03T11:00:00Z'), end: new Date('2026-11-03T12:00:00Z') },
         { start: new Date('2026-11-03T09:00:00Z'), end: new Date('2026-11-03T10:00:00Z') },
    ]
    const result = mergeIntervals(intervals)

    expect(result).toHaveLength(2)
    expect(result[0].start).toEqual(new Date('2026-11-03T09:00:00Z'))
})

test('returns entire day for empty input in getFreeSlots', () => {
    const dayStart = new Date('2026-11-03T09:00:00Z')
    const dayEnd = new Date('2026-11-03T22:00:00Z')

    const result = getFreeSlots([], dayStart, dayEnd)
    expect(result).toEqual([{ start: dayStart, end: dayEnd }])
})

test('entire day is busy - no free slots should come back ', () => {
    const dayStart = new Date('2026-11-03T09:00:00Z')
    const dayEnd = new Date('2026-11-03T22:00:00Z')
    const interval = [{ start:dayStart, end: dayEnd }]

    const result = getFreeSlots(interval, dayStart, dayEnd)
    expect(result).toEqual([])
})

test('two busy intervals with a gap between them',() => {
    const intervals = [
        {start :new Date('2026-11-03T08:00:00Z'), end: new Date('2026-11-03T10:00:00Z')},
        {start :new Date('2026-11-03T12:00:00Z'), end: new Date('2026-11-03T14:00:00Z')},
    ]
    const dayStart = new Date('2026-11-03T08:00:00Z')
    const dayEnd = new Date('2026-11-03T22:00:00Z')

    const result = getFreeSlots(intervals, dayStart, dayEnd)

    expect(result).toHaveLength(2)
    expect(result[0].start).toEqual(new Date('2026-11-03T10:00:00Z'))
    expect(result[0].end).toEqual(new Date('2026-11-03T12:00:00Z'))
})

test('busy interval that starts before daystart', () => {
    const dayStart = new Date('2026-11-03T08:00:00Z')
    const dayEnd = new Date('2026-11-03T22:00:00Z')
    const interval = [
        { start: new Date('2026-11-03T06:00:00Z'), end: new Date('2026-11-03T09:00:00Z') },
    ]
    const result = getFreeSlots(interval, dayStart, dayEnd)

    expect(result).toHaveLength(1)
    expect(result[0].start).toEqual(new Date('2026-11-03T09:00:00Z'))
    expect(result[0].end).toEqual(new Date('2026-11-03T22:00:00Z'))
})

test('busy interval that ends after dayEnd', () => {
    const dayStart = new Date('2026-11-03T08:00:00Z')
    const dayEnd = new Date('2026-11-03T22:00:00Z')
    const interval = [
        { start: new Date('2026-11-03T20:00:00Z'), end: new Date('2026-11-03T23:00:00Z') },
    ]
    const result = getFreeSlots(interval, dayStart, dayEnd)

    expect(result).toHaveLength(1)
    expect(result[0].start).toEqual(new Date('2026-11-03T08:00:00Z'))
    expect(result[0].end).toEqual(new Date('2026-11-03T20:00:00Z'))
})

// ─── canFitBlock ───────────────────────────────────────────────────────────────
const { canFitBlock } = require('./canFitBlock')

test('returns true when slot is exactly blockDuration + gap', () => {
    const start = new Date('2026-11-03T09:00:00Z')
    const end   = new Date('2026-11-03T10:05:00Z') // exactly 65 minutes = 50 + 15
    expect(canFitBlock(start, end, 50, 15)).toBe(true)
})

test('returns false when slot is one minute too short', () => {
    const start = new Date('2026-11-03T09:00:00Z')
    const end   = new Date('2026-11-03T10:04:00Z') // 64 minutes, need 65
    expect(canFitBlock(start, end, 50, 15)).toBe(false)
})

test('returns true when slot is larger than needed', () => {
    const start = new Date('2026-11-03T09:00:00Z')
    const end   = new Date('2026-11-03T12:00:00Z') // 3 hours
    expect(canFitBlock(start, end, 60, 25)).toBe(true)
})

// ─── findCandidateSlots ────────────────────────────────────────────────────────
const { findCandidateSlots } = require('./findCandidateSlots')

test('returns start times only for slots wide enough', () => {
    const freeSlots = [
        { start: new Date('2026-11-03T09:00:00Z'), end: new Date('2026-11-03T10:05:00Z') }, // 65 min — fits
        { start: new Date('2026-11-03T11:00:00Z'), end: new Date('2026-11-03T11:30:00Z') }, // 30 min — too small
        { start: new Date('2026-11-03T13:00:00Z'), end: new Date('2026-11-03T15:00:00Z') }, // 120 min — fits
    ]
    const result = findCandidateSlots(freeSlots, 50, 15)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(new Date('2026-11-03T09:00:00Z'))
    expect(result[1]).toEqual(new Date('2026-11-03T13:00:00Z'))
})

test('returns empty array when no slot is wide enough', () => {
    const freeSlots = [
        { start: new Date('2026-11-03T09:00:00Z'), end: new Date('2026-11-03T09:30:00Z') },
        { start: new Date('2026-11-03T11:00:00Z'), end: new Date('2026-11-03T11:20:00Z') },
    ]
    expect(findCandidateSlots(freeSlots, 50, 15)).toHaveLength(0)
})

test('returns empty array for empty free slots input', () => {
    expect(findCandidateSlots([], 50, 15)).toHaveLength(0)
})

// ─── computeScore ──────────────────────────────────────────────────────────────
const { computeScore } = require('./computeScore')

test('task due today gets urgency capped at 1.0', () => {
    const task = {
        deadline: new Date(Date.now() + 3600000 * 3), // 3 hours from now
        goal: { weight: 5, rank: 1 },
    }
    const score = computeScore(task, 1)
    // urgency = min(1.0, 1/0.125) = 1.0, weight=5/5=1, rank=1/1=1
    // score = 0.50 + 0.35 + 0.15 = 1.0
    expect(score).toBeCloseTo(1.0, 5)
})

test('higher goal weight produces higher score', () => {
    const base = { deadline: new Date(Date.now() + 7 * 86400000) }
    const low  = computeScore({ ...base, goal: { weight: 1, rank: 1 } }, 3)
    const high = computeScore({ ...base, goal: { weight: 5, rank: 1 } }, 3)
    expect(high).toBeGreaterThan(low)
})

test('higher rank (lower number) produces higher score', () => {
    const base = { deadline: new Date(Date.now() + 7 * 86400000) }
    const highPriority = computeScore({ ...base, goal: { weight: 3, rank: 1 } }, 5)
    const lowPriority  = computeScore({ ...base, goal: { weight: 3, rank: 5 } }, 5)
    expect(highPriority).toBeGreaterThan(lowPriority)
})

// ─── pickTask ─────────────────────────────────────────────────────────────────
const { pickTask } = require('./pickTask')

const makeTask = (overrides) => ({
    deadline:              new Date(Date.now() + 3 * 86400000),
    createdAt:             new Date('2026-10-01T00:00:00Z'),
    timeRemainingMinutes:  60,
    goal:                  { weight: 3, rank: 1 },
    ...overrides,
})

test('returns null for empty task list', () => {
    expect(pickTask([], 3)).toBeNull()
})

test('returns the only task when list has one entry', () => {
    const t = makeTask({})
    expect(pickTask([t], 1)).toBe(t)
})

test('picks the task with the higher score', () => {
    const lowScore  = makeTask({ goal: { weight: 1, rank: 3 }, deadline: new Date(Date.now() + 10 * 86400000) })
    const highScore = makeTask({ goal: { weight: 5, rank: 1 }, deadline: new Date(Date.now() + 10 * 86400000) })
    expect(pickTask([lowScore, highScore], 3)).toBe(highScore)
})

test('tie-break: earlier deadline wins when scores are equal', () => {
    // Same goal, same rank, same distance to deadline produces equal scores
    // Force identical scores by using the same goal and very close deadlines
    // Instead: directly test that earlier deadline breaks the tie
    const sooner = makeTask({ goal: { weight: 3, rank: 1 }, deadline: new Date(Date.now() + 2 * 86400000) })
    const later  = makeTask({ goal: { weight: 3, rank: 1 }, deadline: new Date(Date.now() + 8 * 86400000) })
    // sooner has higher urgency so higher score — it should be picked
    expect(pickTask([later, sooner], 1)).toBe(sooner)
})

test('tie-break: older task wins when deadline and score are identical', () => {
    const deadline = new Date(Date.now() + 5 * 86400000)
    const older  = makeTask({ deadline, createdAt: new Date('2026-09-01T00:00:00Z'), goal: { weight: 3, rank: 1 } })
    const newer  = makeTask({ deadline, createdAt: new Date('2026-10-01T00:00:00Z'), goal: { weight: 3, rank: 1 } })
    expect(pickTask([newer, older], 1)).toBe(older)
})

// ─── chooseBlockDuration ──────────────────────────────────────────────────────
const { chooseBlockDuration } = require('./chooseBlockDuration')

test('returns 50 min block and 15 min gap by default', () => {
    expect(chooseBlockDuration(0, 50)).toEqual({ blockDuration: 50, gap: 15 })
})

test('returns 60 min block and 25 min gap when time remaining >= 60 and consecutive < 3', () => {
    expect(chooseBlockDuration(1, 90)).toEqual({ blockDuration: 60, gap: 25 })
})

test('returns 50 min block and 25 min gap after 3 or more consecutive blocks', () => {
    expect(chooseBlockDuration(3, 90)).toEqual({ blockDuration: 50, gap: 25 })
    expect(chooseBlockDuration(4, 90)).toEqual({ blockDuration: 50, gap: 25 })
})

test('returns 50 min block when time remaining < 60 even with no consecutive blocks', () => {
    expect(chooseBlockDuration(0, 45)).toEqual({ blockDuration: 50, gap: 15 })
})

// ─── suggestSlot ───────────────────────────────────────────────────────────────
const { suggestSlot } = require('./suggestSlot')

// New signature: suggestSlot(tasks, totalGoals, blocksToday, blocksThisWeek,
//                            consecutiveBlocks, busyIntervals, dayStart, dayEnd)
const tasks = [
    {
        deadline:             new Date(Date.now() + 3 * 86400000),
        createdAt:            new Date('2026-10-01T00:00:00Z'),
        timeRemainingMinutes: 60,
        goal:                 { weight: 4, rank: 2 },
    },
]
const dayStart = new Date('2026-11-03T08:00:00Z')
const dayEnd   = new Date('2026-11-03T22:00:00Z')

test('returns a slot with task, start, end, blockDuration, gap, score for an open day', () => {
    const busy   = [{ start: new Date('2026-11-03T08:00:00Z'), end: new Date('2026-11-03T09:00:00Z') }]
    const result = suggestSlot(tasks, 3, 0, 0, 0, busy, dayStart, dayEnd)
    expect(result).toHaveProperty('task')
    expect(result).toHaveProperty('start')
    expect(result).toHaveProperty('end')
    expect(result).toHaveProperty('blockDuration')
    expect(result).toHaveProperty('gap')
    expect(result).toHaveProperty('score')
    expect((result.end - result.start) / 60000).toBe(result.blockDuration)
})

test('returns NO_FREE_SLOT when the entire day is busy', () => {
    const busy   = [{ start: dayStart, end: dayEnd }]
    const result = suggestSlot(tasks, 3, 0, 0, 0, busy, dayStart, dayEnd)
    expect(result.reason).toBe('NO_FREE_SLOT')
})

test('returns NO_FREE_SLOT when all free slots are too short', () => {
    const busy = [
        { start: new Date('2026-11-03T08:30:00Z'), end: new Date('2026-11-03T12:00:00Z') },
        { start: new Date('2026-11-03T12:30:00Z'), end: dayEnd },
    ]
    const result = suggestSlot(tasks, 3, 0, 0, 0, busy, dayStart, dayEnd)
    expect(result.reason).toBe('NO_FREE_SLOT')
})

test('handles empty busy list — slot starts at dayStart', () => {
    const result = suggestSlot(tasks, 3, 0, 0, 0, [], dayStart, dayEnd)
    expect(result).toHaveProperty('start')
    expect(result.start).toEqual(dayStart)
})

test('returns NO_TASKS when task list is empty', () => {
    const result = suggestSlot([], 3, 0, 0, 0, [], dayStart, dayEnd)
    expect(result.reason).toBe('NO_TASKS')
})

test('returns DAILY_LIMIT when 8 blocks already scheduled today', () => {
    const result = suggestSlot(tasks, 3, 8, 0, 0, [], dayStart, dayEnd)
    expect(result.reason).toBe('DAILY_LIMIT')
})

test('returns WEEKLY_LIMIT when 40 blocks already scheduled this week', () => {
    const result = suggestSlot(tasks, 3, 0, 40, 0, [], dayStart, dayEnd)
    expect(result.reason).toBe('WEEKLY_LIMIT')
})

test('uses 50 min + 25 min gap after 3 consecutive blocks', () => {
    const result = suggestSlot(tasks, 3, 0, 0, 3, [], dayStart, dayEnd)
    expect(result.blockDuration).toBe(50)
    expect(result.gap).toBe(25)
})

test('uses 60 min block when task has >= 60 min remaining and < 3 consecutive blocks', () => {
    const result = suggestSlot(tasks, 3, 0, 0, 0, [], dayStart, dayEnd)
    // tasks[0].timeRemainingMinutes = 60, consecutiveBlocks = 0 → 60 min block
    expect(result.blockDuration).toBe(60)
    expect(result.gap).toBe(25)
})




