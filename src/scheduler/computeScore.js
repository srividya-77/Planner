/**
 * computeScore.js
 *
 * Scores a task using the priority formula:
 *   score = (0.50 × urgency) + (0.35 × goal_weight/5) + (0.15 × rank_score)
 *
 * urgency     = min(1.0, 1 / days_until_deadline)
 * rank_score  = (totalGoals - goal.rank + 1) / totalGoals
 *
 * Higher score = should be suggested first.
 *
 * @param {Object} task
 * @param {Date}   task.deadline
 * @param {Object} task.goal
 * @param {number} task.goal.weight  - 1 to 5
 * @param {number} task.goal.rank    - 1 = highest priority
 * @param {number} totalGoals - total number of goals the user has
 * @returns {number} - score between 0 and 1
 */
function computeScore(task, totalGoals) {
    const today = new Date()
    const daysUntil = (task.deadline - today) / 86400000
    const urgency = Math.min(1.0, 1 / daysUntil)
    const rankScore = (totalGoals - task.goal.rank + 1) / totalGoals
    return (0.50 * urgency) + (0.35 * task.goal.weight / 5) + (0.15 * rankScore)
}

module.exports = { computeScore }
