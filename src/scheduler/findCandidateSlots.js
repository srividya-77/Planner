/**
 * findCandidateSlots.js
 *
 * Given a list of free slots, returns the start time of every slot
 * where a block of the given duration (plus gap) can fit.
 * Always uses the earliest available time in each valid slot.
 *
 * @param {Array<{start: Date, end: Date}>} freeSlots
 * @param {number} blockDuration - in minutes
 * @param {number} gap - in minutes
 * @returns {Array<Date>} - possible block start times
 */
const { canFitBlock } = require('./canFitBlock')

function findCandidateSlots(freeSlots, blockDuration, gap) {
    const valid = []
    for (const slot of freeSlots) {
        if (canFitBlock(slot.start, slot.end, blockDuration, gap)) {
            valid.push(slot.start)
        }
    }
    return valid
}

module.exports = { findCandidateSlots }
