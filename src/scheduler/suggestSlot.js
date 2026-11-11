/**
 * suggestSlot.js
 *
 * Top-level scheduler function. Wires all the pieces together.
 *
 * Given a list of pending tasks and a day's busy intervals, it:
 *   1. Checks daily and weekly block limits
 *   2. Picks the highest-priority task (score → deadline → age tie-breaking)
 *   3. Decides block duration and gap based on consecutive blocks and task time remaining
 *   4. Finds free slots, filters to candidates, and returns the best one
 *
 * This function is pure — no database calls, no API calls.
 *
 * @param {Array<Object>} tasks          - pending/in-progress tasks to choose from
 * @param {Date}   tasks[].deadline
 * @param {Date}   tasks[].createdAt
 * @param {number} tasks[].timeRemainingMinutes
 * @param {Object} tasks[].goal
 * @param {number} tasks[].goal.weight
 * @param {number} tasks[].goal.rank
 * @param {number} totalGoals            - total goals the user has (for rank scoring)
 * @param {number} blocksToday           - blocks already scheduled today
 * @param {number} blocksThisWeek        - blocks already scheduled this week
 * @param {number} consecutiveBlocks     - back-to-back blocks scheduled today without a break
 * @param {Array<{start: Date, end: Date}>} busyIntervals - merged busy intervals for the day
 * @param {Date}   dayStart
 * @param {Date}   dayEnd
 * @returns {{ task: Object, start: Date, end: Date, blockDuration: number, gap: number, score: number }
 *          | { reason: string }}
 */
const { mergeIntervals }     = require('./mergeIntervals')
const { getFreeSlots }       = require('./getFreeSlots')
const { findCandidateSlots } = require('./findCandidateSlots')
const { computeScore }       = require('./computeScore')
const { pickTask }           = require('./pickTask')
const { chooseBlockDuration } = require('./chooseBlockDuration')

function suggestSlot(
    tasks,
    totalGoals,
    blocksToday,
    blocksThisWeek,
    consecutiveBlocks,
    busyIntervals,
    dayStart,
    dayEnd,
    breakAfter = true,
) {
    if (blocksToday >= 8) {
        return { reason: 'DAILY_LIMIT' }
    }

    if (blocksThisWeek >= 40) {
        return { reason: 'WEEKLY_LIMIT' }
    }

    if (!tasks || tasks.length === 0) {
        return { reason: 'NO_TASKS' }
    }

    const task = pickTask(tasks, totalGoals)

    const { blockDuration, gap: defaultGap } = chooseBlockDuration(consecutiveBlocks, task.timeRemainingMinutes)
    const gap = breakAfter ? defaultGap : 0

    const merged     = mergeIntervals(busyIntervals)
    const freeSlots  = getFreeSlots(merged, dayStart, dayEnd)
    const candidates = findCandidateSlots(freeSlots, blockDuration, gap)

    if (candidates.length === 0) {
        return { reason: 'NO_FREE_SLOT' }
    }

    const score = computeScore(task, totalGoals)
    const start = candidates[0]
    const end   = new Date(start.getTime() + blockDuration * 60000)

    return { task, start, end, blockDuration, gap, score }
}

module.exports = { suggestSlot }
