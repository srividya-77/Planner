/**
 * canFitBlock.js
 *
 * Checks whether a block of given duration (plus its required gap after)
 * fits inside a free slot.
 *
 * @param {Date} start - start of the free slot
 * @param {Date} end - end of the free slot
 * @param {number} blockDuration - in minutes (50 or 60)
 * @param {number} gap - in minutes (15 or 25, depending on context)
 * @returns {boolean}
 */
function canFitBlock(start, end, blockDuration, gap) {
    return (end - start) / 60000 >= blockDuration + gap
}

module.exports = { canFitBlock }
