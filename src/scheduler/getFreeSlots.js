/**
 * getFreeSlots.js
 *
 * Takes a merged, sorted list of busy intervals and a day window.
 * Returns all free gaps in that day where study blocks could go.
 *
 * @param {Array<{start: Date, end: Date}>} busyIntervals - already merged and sorted
 * @param {Date} dayStart
 * @param {Date} dayEnd
 * @returns {Array<{start: Date, end: Date}>}
 */
function getFreeSlots(busyIntervals, dayStart, dayEnd) {
    let cursor = dayStart
    const freeSlots = []

    for (const slot of busyIntervals) {
        if (slot.start > cursor) {
            freeSlots.push({ start: cursor, end: slot.start })
        }
        cursor = slot.end
    }

    if (cursor < dayEnd) {
        freeSlots.push({ start: cursor, end: dayEnd })
    }

    return freeSlots
}

module.exports = { getFreeSlots }
