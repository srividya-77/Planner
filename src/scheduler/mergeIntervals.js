/**
 * mergeIntervals.js
 *
 * Takes a list of busy intervals that may overlap or be unsorted.
 * Returns a clean, sorted, non-overlapping list.
 *
 * @param {Array<{start: Date, end: Date}>} intervals
 * @returns {Array<{start: Date, end: Date}>}
 */
function mergeIntervals(intervals) {
    if (intervals.length === 0) return []

    intervals.sort((a, b) => a.start - b.start)

    const merged = []
    merged.push({ start: intervals[0].start, end: intervals[0].end })

    for (const interval of intervals.slice(1)) {
        const last = merged[merged.length - 1]
        if (interval.start < last.end) {
            last.end = new Date(Math.max(interval.end.getTime(), last.end.getTime()))
        } else {
            merged.push({ start: interval.start, end: interval.end })
        }
    }

    return merged
}

module.exports = { mergeIntervals }
