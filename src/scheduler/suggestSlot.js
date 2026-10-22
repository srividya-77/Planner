/**
 * suggestSlot.js
 *
 * Top-level scheduler function. Wires all the pieces together.
 * Given a task and a day's busy intervals, returns the best available
 * slot for the task, or null if none exists.
 *
 * This function is pure — no database calls, no API calls.
 * It can be tested completely in isolation.
 *
 * @param {Object} task              - the task to schedule
 * @param {number} totalGoals        - total goals the user has (for rank scoring)
 * @param {Array<{start: Date, end: Date}>} busyIntervals - all busy intervals for the day
 *                                     (blocks + fixed events + meal windows combined)
 * @param {Date}   dayStart          - start of user's study window
 * @param {Date}   dayEnd            - end of user's study window
 * @param {number} blockDuration     - in minutes (50 or 60)
 * @param {number} gap               - in minutes (15 or 25)
 * @returns {{ start: Date, end: Date, score: number } | null}
 */
const { mergeIntervals }      = require('./mergeIntervals')
const { getFreeSlots }        = require('./getFreeSlots')
const { findCandidateSlots }  = require('./findCandidateSlots')
const { computeScore }        = require('./computeScore')

function suggestSlot(task, totalGoals, busyIntervals, dayStart, dayEnd, blockDuration, gap) {
    const merged     = mergeIntervals(busyIntervals)
    const freeSlots  = getFreeSlots(merged, dayStart, dayEnd)
    const candidates = findCandidateSlots(freeSlots, blockDuration, gap)

    if (candidates.length === 0) {
        return null
    }

    const score = computeScore(task, totalGoals)
    const start = candidates[0]
    const end   = new Date(start.getTime() + blockDuration * 60000)

    return { start, end, score }
}

module.exports = { suggestSlot }
