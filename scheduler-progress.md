# Scheduler — Progress Log
**Project:** Study Planner with Free-Slot Finder
**Date:** 22 October 2026
**Branch:** mern (same logic applies to go-flutter)

---

## What we are building

A pure scheduler module — no database, no API, just logic. It takes a day's inputs and returns a suggested slot for a task. Because it is pure logic with no side effects, it can be tested completely in isolation.

This file tracks what has been understood, what has been written, and what still needs to be built.

---

## Core idea

The scheduler works in layers:

1. Find free time from busy time (interval problem)
2. Filter free slots to ones that can fit a block
3. Score and rank candidate slots using task priority
4. Return the best slot, or a clear reason why none exists

---

## What we have built so far

### Function 1 — mergeIntervals

**Purpose:** Takes a list of busy intervals that may overlap or be unsorted. Returns a clean, sorted, non-overlapping list.

**Why it is needed:** Busy intervals come from multiple sources — fixed events, existing blocks, meal windows. They can overlap. The free-slot algorithm only works correctly on a clean merged list.

**Algorithm (derived from first principles):**
```
sort intervals by start time
take the first interval as the starting point
for each remaining interval:
    if it overlaps the last merged interval (current.start < last.end):
        extend the last interval's end to max(last.end, current.end)
    else:
        add it as a new merged interval
```

**Code:**
```js
function mergeIntervals(intervals) {
    intervals.sort((a, b) => a.start - b.start)
    const merged = []
    merged.push(intervals[0])
    for (const interval of intervals.slice(1)) {
        const last = merged[merged.length - 1]
        if (interval.start < last.end) {
            last.end = new Date(Math.max(interval.end.getTime(), last.end.getTime()))
        } else {
            merged.push(interval)
        }
    }
    return merged
}
```

**Edge cases handled:**
- Overlapping intervals → merged into one
- One interval completely inside another → max(end) keeps the larger one
- Empty input → not handled yet (to do: guard for empty array)

---

### Function 2 — getFreeSlots

**Purpose:** Takes a merged, sorted list of busy intervals plus a day window. Returns all free gaps in that day.

**Why it is needed:** The scheduler needs to know where there is open time before it can suggest anything.

**Algorithm (derived from first principles):**
```
cursor = dayStart
for each busy interval:
    if interval starts after cursor:
        free slot = cursor to interval.start
    cursor = interval.end
after the loop:
    if cursor < dayEnd:
        free slot = cursor to dayEnd
```

**Code:**
```js
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
```

**Edge cases handled:**
- Busy interval starts before dayStart → `slot.start > cursor` check skips invalid free slot
- Busy interval ends after dayEnd → `cursor < dayEnd` check prevents invalid final slot
- Empty busy list → loop doesn't run, entire day returned as one free slot

---

### Function 3 — canFitBlock

**Purpose:** Given a free slot and a block duration + gap requirement, returns true if the block fits.

**Why it is needed:** Not every free slot is usable. A block needs 50–60 minutes plus a 15–25 minute gap after it. Minimum usable slot = blockDuration + gap minutes.

**Code:**
```js
function canFitBlock(start, end, blockDuration, gap) {
    return (end - start) / 60000 >= blockDuration + gap
}
```

**Notes:**
- `end - start` gives milliseconds. Dividing by 60000 converts to minutes.
- `blockDuration` and `gap` are in minutes.
- Gap varies: 15 min normally, 25 min after a 60-min block or after the third consecutive block. The caller is responsible for passing the correct gap value.

---

## What still needs to be built

### Next — findCandidateSlots
Given a list of free slots, return all possible start times for a block.
- Question to resolve first: can a block start anywhere in a free slot, or only at the beginning?

### After that — scoring
Given candidate slots, score each one using task priority:
```
priority = (0.50 × urgency) + (0.35 × goal_weight / 5) + (0.15 × rank_score)
```
Return the slot that scores highest.

### Then — suggestSlot (the top-level function)
Puts everything together:
1. Collect all busy intervals for the day (blocks + fixed events + meal windows)
2. Merge them
3. Get free slots
4. Filter to candidate slots using canFitBlock
5. Score tasks and pick best match
6. Return suggested slot or reason for rejection

### Then — limit checks
Before returning a suggestion, check:
- Daily block count < 8
- Weekly block count < 40
- Block does not overlap fixed events
- Block respects meal windows and day cutoff

### Then — overrun handling
Given a task that needs more time:
- Check if extending the current block breaks daily/weekly limits
- Check if it overlaps the next fixed event
- Return options: extend, move to next slot, postpone

### Then — group free slots
Generalisation of getFreeSlots for N users:
- Get free slots for each member
- Intersect all of them
- Filter to slots where every member has capacity under their limits

### Then — week view
Run the day scheduler across all 7 days of the week and return one suggestion per task.

---

## Key decisions that affect the scheduler

| Decision | Value |
|---|---|
| Block length | 50–60 minutes |
| Gap after block | 15 min normally, 25 min after 60-min block or third consecutive block |
| Max blocks per day | 8 (fixed events not counted) |
| Max blocks per week | 40 |
| Week starts | Monday |
| Smallest time unit | 5 minutes |
| All times | Stored UTC, computed in UTC, displayed as IST |
| Scoring weights | urgency 0.50, goal weight 0.35, goal rank 0.15 |
| Tie-breaking | Earlier deadline first, then older task first |

---

## File locations (mern branch)

```
src/scheduler/
    index.js              ← public interface, import from here
    mergeIntervals.js
    getFreeSlots.js
    canFitBlock.js
    findCandidateSlots.js
    computeScore.js
    suggestSlot.js
```

Branch go-flutter will have the equivalent in `internal/scheduler/` written in Go — after the mern branch is fully built and deployed.

All files are pure functions. No imports from the database or API layer. Tested independently with unit tests before connecting to anything else.

## Next session

Write unit tests for all six functions before adding anything else. Test file location: `src/scheduler/scheduler.test.js`

Test cases to cover (from design doc section 14):
- Empty day (no busy intervals)
- Full day (no free slots)
- Back-to-back fixed events
- Limit edges (exactly 8 blocks)
- Deadline urgency affecting score
- Tie-breaking between two tasks
- Overlapping busy intervals (merge test)
- Busy interval before dayStart
- Busy interval after dayEnd
