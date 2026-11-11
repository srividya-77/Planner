# Database Schema
**Project:** Study Planner with Free-Slot Finder
**Author:** Srividya
**Date:** 22 October 2026
**Status:** Decided — v1
**Applies to:** Both branches (mern and go-flutter). Same schema, same migrations.

---

## Design principles

- All times stored as UTC (timestamptz). Displayed as IST (UTC+5:30) in the app.
- All primary keys are UUIDs. No auto-increment integers — avoids enumeration attacks.
- The backend is the source of truth. Every constraint that matters is enforced in the database, not just in application code.
- Suggestions and group free slots are never stored. They are computed on demand.
- Priority scores are never stored. They are computed from the formula at query time.
- Every table has a `created_at` column for debugging and auditing.

---

## Naming conventions

| Thing | Convention |
|---|---|
| Table names | snake_case, plural |
| Column names | snake_case |
| Primary keys | `id` (UUID) |
| Foreign keys | `{singular_table}_id` |
| Audit timestamps | `*_at` suffix (e.g. `created_at`) |
| Domain timestamps | `*_time` suffix (e.g. `start_time`) |
| Enums | lowercase strings |

---

## Tables

### users

Stores one row per account.

```sql
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    email                   TEXT NOT NULL UNIQUE,
    password_hash           TEXT NOT NULL,              -- bcrypt hash, never plaintext

    -- Study window: when the user is willing to study each day
    day_start_time          TIME NOT NULL DEFAULT '09:00:00',  -- e.g. 9:00 AM IST
    day_end_time            TIME NOT NULL DEFAULT '22:00:00',  -- e.g. 10:00 PM IST

    -- Burnout settings (all times in IST, stored as TIME)
    lunch_start             TIME NOT NULL DEFAULT '13:00:00',
    lunch_end               TIME NOT NULL DEFAULT '14:00:00',
    dinner_start            TIME NOT NULL DEFAULT '20:00:00',
    dinner_end              TIME NOT NULL DEFAULT '21:00:00',
    day_cutoff              TIME NOT NULL DEFAULT '22:00:00',  -- no blocks after this
    rest_day                SMALLINT NOT NULL DEFAULT 0,        -- 0=Sunday, 1=Monday ... 6=Saturday

    timezone                TEXT NOT NULL DEFAULT 'Asia/Kolkata',  -- fixed IST, stored for v2

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Notes:**
- `password_hash` stores the bcrypt output. The plaintext password never touches the database.
- Meal windows and cutoff are stored here so the backend can enforce them per user without a separate query.
- `rest_day` uses ISO weekday numbering: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
- `timezone` is always `Asia/Kolkata` in v1 but stored so v2 can support other timezones without a migration.

---

### goals

Each user sets goals with a weight (importance) and rank (priority order).

```sql
CREATE TABLE goals (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    weight      SMALLINT NOT NULL CHECK (weight BETWEEN 1 AND 5),
    rank        SMALLINT NOT NULL CHECK (rank >= 1),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (owner_id, rank)   -- no two goals can share the same rank for one user
);
```

**Notes:**
- `weight` is 1 to 5. Used in the scoring formula as `weight / 5.0`.
- `rank` is 1 = highest priority. The unique constraint means the user must keep ranks sequential and non-duplicate. The application layer handles re-ranking when the user reorders goals.
- `ON DELETE CASCADE`: deleting a user deletes their goals. Deleting a goal does not automatically delete tasks — tasks have a direct FK with a restrict/set-null policy (see tasks table).

---

### tasks

Work to be scheduled. Each task belongs to a goal.

```sql
CREATE TYPE task_repeat_rule AS ENUM ('none', 'daily', 'weekly', 'weekdays');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

CREATE TABLE tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id                 UUID NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,

    title                   TEXT NOT NULL,
    estimate_minutes        INTEGER NOT NULL CHECK (estimate_minutes > 0),
    time_spent_minutes      INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_minutes >= 0),
    time_remaining_minutes  INTEGER NOT NULL CHECK (time_remaining_minutes >= 0),
    -- time_remaining is updated on every block completion and overrun.
    -- initial value = estimate_minutes.

    deadline                DATE NOT NULL,   -- day-level, not timestamp
    repeat_rule             task_repeat_rule NOT NULL DEFAULT 'none',
    status                  task_status NOT NULL DEFAULT 'pending',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Notes:**
- `goal_id` uses `ON DELETE RESTRICT` — you cannot delete a goal that still has tasks. The user must reassign or delete the tasks first. This prevents accidental data loss.
- `deadline` is a DATE (no time component). A task is due by end of that day.
- `time_remaining_minutes` is stored (not computed on the fly) to keep limit-check queries simple. It is updated atomically whenever a block is completed or an overrun is recorded.
- `estimate_minutes` vs `time_spent_minutes` are both kept. Their ratio feeds the per-user average accuracy calculation (plain arithmetic, no AI — see design doc section 10).

---

### fixed_events

Classes, commitments, and other time blocks the user cannot move.

```sql
CREATE TYPE fixed_event_repeat AS ENUM ('none', 'weekly');

CREATE TABLE fixed_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ NOT NULL,
    repeat_rule  fixed_event_repeat NOT NULL DEFAULT 'none',

    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (end_time > start_time)
);
```

**Notes:**
- `repeat_rule` is only `none` or `weekly` in v1 (one-time or same day/time every week).
- For a weekly event, `start_time` is the first occurrence. The scheduler generates future occurrences on demand using the time and day-of-week from this row.
- Fixed events are never counted toward the 8-block or 40-block limits. They are only used as "busy" intervals when computing free slots.

---

### blocks

A scheduled work session. Either linked to a task (personal block) or to a group booking.

```sql
CREATE TYPE block_status AS ENUM ('scheduled', 'completed', 'cancelled', 'overrun');

CREATE TABLE blocks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Exactly one of these must be set. The other must be NULL.
    task_id             UUID REFERENCES tasks(id) ON DELETE CASCADE,
    group_booking_id    UUID REFERENCES group_bookings(id) ON DELETE CASCADE,

    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ NOT NULL,
    actual_minutes      INTEGER CHECK (actual_minutes >= 0),  -- filled when block ends
    status              block_status NOT NULL DEFAULT 'scheduled',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (end_time > start_time),
    CHECK (
        (task_id IS NOT NULL AND group_booking_id IS NULL) OR
        (task_id IS NULL AND group_booking_id IS NOT NULL)
    )
);
```

**Notes:**
- `user_id` is stored directly on the block. This makes the daily/weekly limit query trivial: `SELECT COUNT(*) FROM blocks WHERE user_id = $1 AND start_time >= $week_start AND status != 'cancelled'`.
- The CHECK constraint on `task_id` / `group_booking_id` is enforced at the database level, not just application level.
- `actual_minutes` is NULL until the block is completed or an overrun is recorded.
- The `group_bookings` table is defined below. PostgreSQL forward-reference: define `group_bookings` before `blocks` in the migration, or use a deferred FK.

**Migration order:** `users` → `goals` → `tasks` → `groups` → `group_bookings` → `blocks`

---

### groups

A study group. Members are managed in the `group_members` join table.

```sql
CREATE TABLE groups (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    invite_code  TEXT NOT NULL UNIQUE,   -- short random string, e.g. "XK92P"
    created_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Notes:**
- `invite_code` is generated by the backend on group creation (e.g. 6 random uppercase alphanumeric characters). Stored as plain text — it is not a secret, just a convenience mechanism.
- `created_by` uses `ON DELETE RESTRICT` — a user who created a group cannot delete their account while the group exists. v2 can add a "transfer ownership" flow.

---

### group_members

Join table for the many-to-many between users and groups.

```sql
CREATE TABLE group_members (
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (group_id, user_id)
);
```

**Notes:**
- Composite primary key — a user can be in a group only once.
- `ON DELETE CASCADE` on both sides: if a group is deleted, all membership rows are deleted. If a user is deleted, their group memberships are deleted.

---

### group_bookings

A booked group session. When confirmed, the backend creates one Block row per member.

```sql
CREATE TYPE group_booking_status AS ENUM ('confirmed', 'cancelled');

CREATE TABLE group_bookings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    booked_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ NOT NULL,
    status       group_booking_status NOT NULL DEFAULT 'confirmed',

    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (end_time > start_time)
);
```

**Notes:**
- `booked_by` uses `ON DELETE RESTRICT` — only the booker can cancel (see decisions.md). Deleting the booker's account while an active booking exists is blocked. v2 can handle account deletion edge cases.
- When `status` is set to `cancelled`, the backend also sets all linked Block rows to `cancelled` in the same transaction.
- Group free slots are never stored here. This table only holds confirmed or cancelled bookings.

---

## Indexes

```sql
-- Limit queries: count blocks in a day or week for a user
CREATE INDEX idx_blocks_user_time ON blocks (user_id, start_time);

-- Task progress: find blocks for a task
CREATE INDEX idx_blocks_task ON blocks (task_id);

-- Group booking cancellation: find all blocks for a booking
CREATE INDEX idx_blocks_group_booking ON blocks (group_booking_id);

-- Free-slot computation: find fixed events for a user in a time window
CREATE INDEX idx_fixed_events_owner_time ON fixed_events (owner_id, start_time);

-- Scoring query: find pending tasks for a user ordered by deadline
CREATE INDEX idx_tasks_owner_deadline ON tasks (owner_id, deadline);

-- Status filter: find only active tasks for a user
CREATE INDEX idx_tasks_owner_status ON tasks (owner_id, status);

-- Group lookup: find all groups a user belongs to
CREATE INDEX idx_group_members_user ON group_members (user_id);

-- Member lookup: find all members of a group
CREATE INDEX idx_group_members_group ON group_members (group_id);
```

---

## Entity relationship summary

```
users
  ├── goals          (owner_id → users.id)
  ├── tasks          (owner_id → users.id, goal_id → goals.id)
  ├── fixed_events   (owner_id → users.id)
  ├── blocks         (user_id → users.id)
  ├── group_members  (user_id → users.id)
  └── group_bookings (booked_by → users.id)

groups
  ├── group_members  (group_id → groups.id)
  └── group_bookings (group_id → groups.id)

group_bookings
  └── blocks         (group_booking_id → group_bookings.id)

tasks
  └── blocks         (task_id → tasks.id)
```

---

## What is not stored

| Thing | Reason |
|---|---|
| Suggestions | Computed on demand. Change when anything changes. |
| Group free slots | Computed on demand from member schedules. |
| Priority scores | Computed from the formula at query time. |
| Future repeat occurrences | Generated per-week on demand from the repeat_rule. |

---

## Key query patterns

**Daily block count for a user (for limit check):**
```sql
SELECT COUNT(*)
FROM blocks
WHERE user_id = $1
  AND start_time >= $day_start_utc
  AND start_time < $day_end_utc
  AND status != 'cancelled';
```

**Weekly block count for a user (for limit check):**
```sql
SELECT COUNT(*)
FROM blocks
WHERE user_id = $1
  AND start_time >= $week_start_utc
  AND start_time < $week_end_utc
  AND status != 'cancelled';
```

**All busy intervals for a user on a day (for free-slot computation):**
```sql
-- Personal blocks
SELECT start_time, end_time FROM blocks
WHERE user_id = $1
  AND start_time >= $day_start AND start_time < $day_end
  AND status = 'scheduled'

UNION ALL

-- Fixed events (one-time)
SELECT start_time, end_time FROM fixed_events
WHERE owner_id = $1
  AND repeat_rule = 'none'
  AND start_time >= $day_start AND start_time < $day_end

UNION ALL

-- Fixed events (weekly, matching day of week)
SELECT
  ($day_date + start_time::time) AS start_time,
  ($day_date + end_time::time)   AS end_time
FROM fixed_events
WHERE owner_id = $1
  AND repeat_rule = 'weekly'
  AND EXTRACT(DOW FROM start_time) = EXTRACT(DOW FROM $day_date::timestamptz);
```

**Scoring query — rank pending tasks for a user:**
```sql
SELECT
    t.id,
    t.title,
    t.deadline,
    t.estimate_minutes,
    t.time_remaining_minutes,
    g.weight,
    g.rank,
    (SELECT COUNT(*) FROM goals WHERE owner_id = t.owner_id) AS total_goals
FROM tasks t
JOIN goals g ON t.goal_id = g.id
WHERE t.owner_id = $1
  AND t.status IN ('pending', 'in_progress')
ORDER BY t.deadline ASC;
-- Priority score is computed in application code using the formula,
-- not in SQL, because it belongs in the pure scheduler module.
```

---

## Migration order

Run migrations in this order to satisfy foreign key dependencies:

1. `users`
2. `goals`
3. `tasks`
4. `groups`
5. `group_members`
6. `group_bookings`
7. `blocks`
8. All indexes

---

## Open schema questions (none — all resolved)

All schema decisions follow directly from the closed open questions in `open-questions.md` and the group decisions in `decisions.md`.
