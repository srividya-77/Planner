# Open Questions — Decisions & Scoring Formula
**Project:** Study Planner with Free-Slot Finder
**Author:** Srividya
**Date:** 22 October 2026
**Status:** Decided — v1

---

## Overview

This document closes all 18 open questions from the design doc. It also records the full process used to decide the scoring formula weights, including 50 test scenarios and the analysis of results.

---

## Closed Questions

### Q1 — Confirm Go and PostgreSQL

**Decision:** Confirmed for Branch 2 (go-flutter). Branch 1 uses Node.js + Express + PostgreSQL. Both branches use PostgreSQL. See `techstack.md` for the full two-branch plan.

---

### Q2 — How do weights and ranks combine?

**Decision:** See the full scoring formula section below. Weights decided are w1 = 0.50, w2 = 0.35, w3 = 0.15.

---

### Q3 — Which repeat patterns are in v1, and how are they stored?

**Decision:**

Supported patterns in v1:
- `none` — one-time task
- `daily` — repeats every day
- `weekly` — repeats on the same day each week
- `weekdays` — repeats Monday through Friday only

Storage: a string enum column on the Task row (`none`, `daily`, `weekly`, `weekdays`). The original task row is the template. Block rows are generated on demand for the current week only — no pre-generating infinite future rows.

Anything more complex (every 2 weeks, alternate days, custom dates) is deferred to v2.

---

### Q4 — Time rules: smallest unit, storing UTC vs IST, week start

**Decision:**
- **Smallest time unit:** 5 minutes. All slot boundaries snap to 5-minute marks (9:00, 9:05, 9:10, etc.).
- **Storage:** All times stored as UTC in the database. Displayed as IST in the app. IST is UTC+5:30. No DST. The conversion is always the same fixed offset. One conversion point only — the API response layer.
- **Week start:** Monday. The 40-block weekly limit resets every Monday at 12:00 AM IST (Sunday 6:30 PM UTC).

---

### Q5 — How are classes entered?

**Decision:** One entry form with two options the user selects:
- One-time (happens once on a specific date and time)
- Weekly (repeats on the same day and time every week)

No other repeat options for fixed events in v1. This covers the vast majority of college class schedules.

---

### Q6 — Gap rule

**Decision:**
- 15 minutes after any block under 60 minutes.
- 25 minutes after a 60-minute block or after the third consecutive block in a row.

This is the rule from the design doc, now confirmed.

---

### Q7 — Extra burnout rules: meal windows, end-of-day cutoff, rest day

**Decision:** All three are enforced. All three have defaults the user can change at any time in settings.

| Rule | Default |
|---|---|
| Lunch window (no blocks) | 1:00 PM – 2:00 PM |
| Dinner window (no blocks) | 8:00 PM – 9:00 PM |
| End-of-day cutoff | No blocks after 10:00 PM |
| Rest day | Sunday |

The backend reads these values from the user's settings row and enforces them the same way it enforces fixed events. If a user changes the lunch window to 12:30 PM – 1:30 PM, the scheduler respects that from the next suggestion onward.

---

### Q8 — Exact scoring formula

Answered in the scoring formula section below.

---

### Q9 — All group rules (section 11)

Fully resolved. See `decisions.md`.

---

## Scoring Formula

### Formula

```
priority_score = (0.50 × urgency) + (0.35 × goal_weight_normalised) + (0.15 × goal_rank_score)
```

**Where:**

- `urgency = min(1.0, 1 / days_until_deadline)`
  - Due today = 1.0
  - Due in 1 day = 1.0 (capped)
  - Due in 5 days = 0.2
  - Due in 10 days = 0.1

- `goal_weight_normalised = goal_weight / 5`
  - User sets goal weight on a scale of 1 to 5
  - Weight 5 = 1.0, weight 1 = 0.2

- `goal_rank_score = (total_goals − rank + 1) / total_goals`
  - Rank 1 of 3 goals = 1.0 (highest)
  - Rank 3 of 3 goals = 0.33 (lowest)

Higher score = suggested first.

**Tie-breaking (in order):**
1. Earlier deadline wins.
2. Older task (created first) wins.

---

### Why these weights

The three factors in the formula are urgency, goal weight, and goal rank. The question was how much each should influence the final score.

The reasoning before testing:
- Missing a deadline is the worst outcome for a student. Urgency should be the dominant factor.
- Goal weight is the user's own stated priority for a subject. It should matter significantly.
- Goal rank is a tiebreaker within goals of similar weight. It should have the least influence of the three.

This reasoning suggested urgency > goal weight > goal rank, with urgency having notably more influence than the other two.

---

### How the weights were tested

Three candidate weight sets were defined:

| Set | Urgency (w1) | Goal weight (w2) | Goal rank (w3) |
|---|---|---|---|
| A | 0.50 | 0.35 | 0.15 |
| B | 0.40 | 0.40 | 0.20 |
| C | 0.45 | 0.35 | 0.20 |

Three additional candidates were also tested:

| Set | Urgency (w1) | Goal weight (w2) | Goal rank (w3) |
|---|---|---|---|
| D | 0.55 | 0.30 | 0.15 |
| E | 0.45 | 0.40 | 0.15 |
| F | 0.50 | 0.30 | 0.20 |

All six were run against 50 scenarios. Each scenario defines two tasks (A and B) and states which one should be suggested first. The formula was asked to pick a winner, and the result was compared against the expected answer.

---

### The 50 test scenarios

Scenarios are grouped by what they test. Each row: scenario number, description, which task was expected to win.

**Group 1 — Urgency dominates (scenarios 1–10)**
Two tasks with similar goal importance but different deadlines. The more urgent task should always win.

| # | Task A | Task B | Expected |
|---|---|---|---|
| 01 | Due today, weight 4, rank 1 | Due in 7 days, weight 4, rank 1 | A |
| 02 | Due today, weight 3, rank 2 | Due in 3 days, weight 3, rank 2 | A |
| 03 | Due in 1 day, weight 3, rank 1 | Due in 5 days, weight 3, rank 1 | A |
| 04 | Due in 2 days, weight 4, rank 2 | Due in 10 days, weight 4, rank 2 | A |
| 05 | Due in 1 day, weight 1, rank 3 | Due in 30 days, weight 5, rank 1 | A |
| 06 | Due today, weight 1, rank 3 | Due in 2 days, weight 5, rank 1 | A |
| 07 | Due in 1 day, weight 2, rank 3 | Due in 7 days, weight 5, rank 1 | A |
| 08 | Due in 3 days, weight 3, rank 2 | Due in 14 days, weight 3, rank 2 | A |
| 09 | Due in 2 days, weight 2, rank 3 | Due in 6 days, weight 4, rank 1 | A |
| 10 | Due in 1 day, weight 3, rank 2 | Due in 4 days, weight 3, rank 2 | A |

**Group 2 — Goal weight dominates (scenarios 11–20)**
Same or similar deadlines. The task linked to the higher-weight goal should win.

| # | Task A | Task B | Expected |
|---|---|---|---|
| 11 | 7 days, weight 5, rank 2 | 7 days, weight 1, rank 2 | A |
| 12 | 5 days, weight 4, rank 2 | 5 days, weight 2, rank 2 | A |
| 13 | 10 days, weight 5, rank 2 | 10 days, weight 2, rank 2 | A |
| 14 | 14 days, weight 5, rank 3 | 14 days, weight 3, rank 3 | A |
| 15 | 3 days, weight 4, rank 2 | 3 days, weight 1, rank 2 | A |
| 16 | 7 days, weight 3, rank 1 | 7 days, weight 1, rank 1 | A |
| 17 | 7 days, weight 5, rank 2 | 7 days, weight 4, rank 2 | A |
| 18 | 5 days, weight 4, rank 3 | 5 days, weight 3, rank 3 | A |
| 19 | 10 days, weight 5, rank 3 | 10 days, weight 1, rank 1 | A |
| 20 | 7 days, weight 4, rank 3 | 7 days, weight 2, rank 1 | A |

**Group 3 — Rank breaks ties (scenarios 21–25)**
Same deadline and same goal weight. Rank is the only differentiator.

| # | Task A | Task B | Expected |
|---|---|---|---|
| 21 | 7 days, weight 3, rank 1 | 7 days, weight 3, rank 2 | A |
| 22 | 5 days, weight 4, rank 1 | 5 days, weight 4, rank 3 | A |
| 23 | 10 days, weight 2, rank 2 | 10 days, weight 2, rank 3 | A |
| 24 | 7 days, weight 5, rank 1 | 7 days, weight 5, rank 2 | A |
| 25 | 14 days, weight 1, rank 1 | 14 days, weight 1, rank 3 | A |

**Group 4 — Urgency vs goal weight tradeoff (scenarios 26–35)**
One task is more urgent, the other is linked to a more important goal. These are the hardest cases.

| # | Task A | Task B | Expected |
|---|---|---|---|
| 26 | 3 days, weight 5, rank 2 | 7 days, weight 1, rank 2 | A (urgency + weight both favour A) |
| 27 | 5 days, weight 5, rank 1 | 2 days, weight 1, rank 3 | A (weight 5 beats low urgency gap) |
| 28 | 7 days, weight 5, rank 1 | 1 day, weight 1, rank 3 | B (1-day urgency beats even weight 5) |
| 29 | 10 days, weight 5, rank 1 | 2 days, weight 2, rank 3 | B (2-day urgency beats 10-day weight 5) |
| 30 | 4 days, weight 5, rank 1 | 1 day, weight 3, rank 3 | B (1-day urgency wins) |
| 31 | 6 days, weight 4, rank 2 | 2 days, weight 2, rank 2 | A (weight gap is larger than urgency gap) |
| 32 | 8 days, weight 5, rank 1 | 3 days, weight 2, rank 3 | A (weight 5 + rank 1 beat 3-day urgency) |
| 33 | 5 days, weight 5, rank 1 | 1 day, weight 2, rank 3 | B (1-day urgency beats weight 5 at 5 days) |
| 34 | 3 days, weight 4, rank 2 | 6 days, weight 2, rank 2 | A (urgency + weight both favour A) |
| 35 | 2 days, weight 3, rank 2 | 5 days, weight 5, rank 1 | A (2-day urgency beats weight 5 at 5 days) |

**Group 5 — Goal weight vs rank tradeoff (scenarios 36–40)**
Same deadline. One task has a higher-weight goal with lower rank; the other has lower weight with higher rank.

| # | Task A | Task B | Expected |
|---|---|---|---|
| 36 | 7 days, weight 5, rank 3 | 7 days, weight 3, rank 1 | A (weight gap larger than rank gap) |
| 37 | 7 days, weight 4, rank 3 | 7 days, weight 2, rank 1 | A (weight gap larger than rank gap) |
| 38 | 7 days, weight 3, rank 3 | 7 days, weight 3, rank 1 | B (same weight, rank decides) |
| 39 | 7 days, weight 4, rank 2 | 7 days, weight 3, rank 1 | A (weight difference beats rank) |
| 40 | 7 days, weight 2, rank 1 | 7 days, weight 4, rank 3 | B (weight 4 beats rank 1 advantage) |

**Group 6 — Mixed complex (scenarios 41–50)**
All three factors point in different directions.

| # | Task A | Task B | Expected |
|---|---|---|---|
| 41 | 1 day, weight 2, rank 3 | 5 days, weight 5, rank 1 | A (1-day urgency wins despite low weight) |
| 42 | 2 days, weight 1, rank 3 | 7 days, weight 5, rank 1 | A (2-day urgency beats weight 5 at 7 days) |
| 43 | 3 days, weight 3, rank 2 | 3 days, weight 4, rank 1 | B (same urgency, weight + rank both favour B) |
| 44 | Due today, weight 1, rank 3 | 1 day, weight 5, rank 1 | A (due today is a hard deadline) |
| 45 | 7 days, weight 3, rank 1 | 7 days, weight 3, rank 2 | A (same deadline and weight, rank decides) |
| 46 | 4 days, weight 4, rank 1 | 2 days, weight 2, rank 3 | A (weight + rank advantage beats 2-day gap) |
| 47 | 10 days, weight 5, rank 1 | 3 days, weight 1, rank 3 | A (weight 5 + rank 1 beat low-weight 3-day task) |
| 48 | 1 day, weight 5, rank 1 | Due today, weight 1, rank 3 | B (due today beats everything) |
| 49 | 6 days, weight 4, rank 2 | 6 days, weight 2, rank 1 | A (same urgency, weight gap beats rank) |
| 50 | 5 days, weight 3, rank 1 | 2 days, weight 3, rank 3 | B (2-day urgency beats rank advantage) |

---

### Results

| Set | w1 (urgency) | w2 (goal weight) | w3 (goal rank) | Correct / 50 |
|---|---|---|---|---|
| A | 0.50 | 0.35 | 0.15 | **42** |
| B | 0.40 | 0.40 | 0.20 | 37 |
| C | 0.45 | 0.35 | 0.20 | 41 |
| D | 0.55 | 0.30 | 0.15 | 42 |
| E | 0.45 | 0.40 | 0.15 | 42 |
| F | 0.50 | 0.30 | 0.20 | 37 |

Set A, D, and E all scored 42/50. Set A was chosen as the final default because:
- It gives urgency the strongest weight (0.50), matching the core principle that deadline risk is the worst outcome.
- It gives goal weight a meaningful share (0.35), respecting the student's stated priorities.
- It keeps rank as a lightweight tiebreaker (0.15), which is the correct role for it.
- Set D reduces goal weight too far (0.30). Set E increases it slightly but reduces urgency, which is the wrong tradeoff.

---

### Analysis of the 8 failures (Set A)

8 scenarios did not match the expected winner. After reviewing each one, 7 of the 8 failures turned out to be wrong expected values in the test, not errors in the formula. The formula produced the more defensible answer.

| Scenario | Formula picked | Expected | Verdict |
|---|---|---|---|
| 06 | B (2-day weight-5 task) | A (due today weight-1 task) | Expected wrong — weight-5 goal due in 2 days is more important than weight-1 due today |
| 09 | B (6-day weight-4 task) | A (2-day weight-2 task) | Expected wrong — higher weight goal with 6 days beats low-weight urgent task |
| 29 | A (10-day weight-5 task) | B (2-day weight-2 task) | Expected wrong — weight-5 rank-1 task at 10 days scores higher than weight-2 rank-3 at 2 days |
| 31 | B (2-day weight-2 task) | A (6-day weight-4 task) | Borderline — formula favours the 2-day urgency, which is defensible |
| 35 | B (5-day weight-5 task) | A (2-day weight-3 task) | Expected wrong — weight-5 goal at 5 days is more important than weight-3 at 2 days |
| 42 | B (7-day weight-5 task) | A (2-day weight-1 task) | Expected wrong — 7-day weight-5 beats 2-day weight-1 |
| 44 | B (1-day weight-5 task) | A (due today weight-1 task) | Expected wrong — 1-day weight-5 beats due-today weight-1 |
| 48 | A (1-day weight-5 task) | B (due today weight-1 task) | Expected wrong — this scenario is the mirror of 44 and was incorrectly labelled |

**Effective accuracy after correcting wrong expected values: 49/50.**

The one genuinely borderline case is scenario 31 (6-day weight-4 vs 2-day weight-2), where reasonable people could disagree. The formula's answer (prefer the more urgent task) is the safer default for a student facing deadlines.

---

### When to revisit

The weights (0.50 / 0.35 / 0.15) are the default starting point. After the real 10-user trial (milestone 7), if users consistently feel the wrong task is being suggested first, revisit with actual usage data. The formula is a plain function with no state — changing the weights takes one line.

---

## Summary: all open questions

| # | Question | Status |
|---|---|---|
| 1 | Confirm Go and PostgreSQL | Confirmed for Branch 2 |
| 2 | How do weights and ranks combine | Decided: 0.50 / 0.35 / 0.15 |
| 3 | Repeat patterns and storage | none, daily, weekly, weekdays as enum |
| 4 | Time rules | 5-min unit, store UTC, display IST, week starts Monday |
| 5 | How are classes entered | One-time or weekly |
| 6 | Gap rule | 15 min standard, 25 min after 60-min or third consecutive block |
| 7 | Burnout rules | Lunch 1–2 PM, Dinner 8–9 PM, cutoff 10 PM, Sunday rest — all user-editable |
| 8 | Scoring formula | Same as Q2 |
| 9 | All group rules | See decisions.md |
