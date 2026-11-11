/**
 * pickTask.js
 *
 * Given a list of pending tasks, returns the one that should be scheduled next.
 *
 * Ranking rules (in order):
 *   1. Highest priority score  (0.50 × urgency + 0.35 × goal_weight/5 + 0.15 × rank_score)
 *   2. Tie-break: earlier deadline
 *   3. Tie-break: older task (lower created_at — the task that has been waiting longer)
 *
 * Returns null if tasks array is empty.
 *
 * @param {Array<Object>} tasks
 * @param {Date}   tasks[].deadline
 * @param {Date}   tasks[].createdAt
 * @param {Object} tasks[].goal
 * @param {number} tasks[].goal.weight  - 1 to 5
 * @param {number} tasks[].goal.rank    - 1 = highest priority
 * @param {number} totalGoals  - total number of goals the user has (for rank_score)
 * @returns {Object|null} - the task to schedule next, or null
 */
const { computeScore } = require('./computeScore')

function pickTask(tasks, totalGoals) {
    if (!tasks || tasks.length === 0) return null

    // Attach score to each task, then sort
    const scored = tasks.map(task => ({
        task,
        score: computeScore(task, totalGoals),
    }))

    scored.sort((a, b) => {
        // Rule 1: higher score wins
        if (b.score !== a.score) return b.score - a.score

        // Rule 2: earlier deadline wins
        const deadlineDiff = new Date(a.task.deadline) - new Date(b.task.deadline)
        if (deadlineDiff !== 0) return deadlineDiff

        // Rule 3: older task wins (has been waiting longer)
        return new Date(a.task.createdAt) - new Date(b.task.createdAt)
    })

    return scored[0].task
}

module.exports = { pickTask }
