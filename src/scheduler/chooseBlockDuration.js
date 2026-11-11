/**
 * chooseBlockDuration.js
 *
 * Decides how long the next block should be (50 or 60 minutes)
 * and what the required gap after it should be (15 or 25 minutes).
 *
 * Rules (from decisions.md):
 *   - Normal block:                            50 min, 15 min gap
 *   - After the 3rd consecutive block:         50 min, 25 min gap  (longer rest needed)
 *   - Task has >= 60 min remaining and
 *     fewer than 3 consecutive blocks so far:  60 min, 25 min gap
 *
 * "Consecutive blocks" means blocks scheduled back-to-back today
 * without a gap or rest day in between.
 *
 * @param {number} consecutiveBlocks  - how many blocks have been scheduled back-to-back today
 * @param {number} timeRemainingMinutes - minutes left on the task being scheduled
 * @returns {{ blockDuration: number, gap: number }}
 */
function chooseBlockDuration(consecutiveBlocks, timeRemainingMinutes) {
    // After 3 consecutive blocks, force a longer gap regardless of block size
    if (consecutiveBlocks >= 3) {
        return { blockDuration: 50, gap: 25 }
    }

    // If the task has enough remaining work, use a 60-min block with a 25-min gap
    if (timeRemainingMinutes >= 60) {
        return { blockDuration: 60, gap: 25 }
    }

    // Default: 50-min block, 15-min gap
    return { blockDuration: 50, gap: 15 }
}

module.exports = { chooseBlockDuration }
