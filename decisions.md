# Group Feature Decisions
**Project:** Study Planner with Free-Slot Finder
**Author:** Srividya
**Date:** 22 October 2026
**Status:** Decided — v1

---

## Context

Section 11 of the design doc listed the group feature as partially open. This document records the final decisions for v1, the reasoning behind each, and what is explicitly deferred to v2.

---

## Decisions

### 1. How groups are created and joined

**Decision:** Invite code only.

A group creator generates a short random code. Anyone with the code can join. No approval flow in v1.

**Reasoning:** An approval flow requires async state (pending / accepted / rejected), extra API endpoints, and notification logic. For v1 with 10 known users, an invite code is sufficient. The data cost is one extra field on the Group table.

**Deferred to v2:** Approval-based joining, invite expiry, revoke invite.

---

### 2. Can a user be in multiple groups?

**Decision:** Yes, a user can be in any number of groups.

**Reasoning:** The data model already requires a many-to-many join between users and groups. There is no scheduling conflict risk because a group booking is always checked against each member's individual limits before it is confirmed. Restricting this would hurt real use cases with no benefit.

**Deferred to v2:** A per-user group limit if needed.

---

### 3. What do members see of each other?

**Decision:** Free/busy only. No task titles, goal names, or estimates are visible to other members.

**Reasoning:** Task details reveal what a person is studying and how far behind they are. That is sensitive. Free/busy is enough to compute common slots. Starting restrictive is easier to relax later than the reverse.

**Deferred to v2:** Optional sharing of task titles within a group, if users ask for it.

---

### 4. Does a group session count toward each member's block limits?

**Decision:** Yes. A group booking counts as one block for every attending member, toward both the 8-block daily limit and the 40-block weekly limit.

**Reasoning:** A group session is real focused time. Excluding it from limits would let users exceed burnout thresholds by filling their schedule with group sessions. The backend's limit checker must see a block row per member; it has no concept of "group" vs "personal."

**Implementation note:** When a group booking is confirmed, the backend creates one Block row per attending member. The GroupBooking row links them. Limit checks run before the booking is written.

---

### 5. Booking model — does everyone confirm, or does first booking win?

**Decision:** First booking wins. The first member to book a free slot locks it for the group.

**Reasoning:** A confirmation flow requires a pending state, a notification system, and timeout logic — significant complexity for v1. With 10 known users coordinating casually, first-booking is practical. The booking screen shows a clear confirmation step: "Book this slot for the group?" before the request is sent, so it is not accidental.

**Deferred to v2:** All-must-confirm model, booking proposals, notifications.

---

### 6. Who can cancel a booking?

**Decision:** Only the member who made the booking can cancel it. This is a permanent rule, not a v1 limitation. There is no edit flow — cancel and rebook instead.

**Reasoning:** Allowing any member to cancel creates coordination problems (someone cancels without telling others). Only-the-booker is simpler and predictable. An edit flow (change the time) requires re-running availability checks for all members and is equivalent to cancel-and-rebook anyway, so it is not worth building.

---

### 7. Concurrency — preventing two members booking the same slot simultaneously

**Decision:** Use a database transaction with `SELECT ... FOR UPDATE` on the affected rows. The availability check and the insert happen inside a single serializable transaction.

**Reasoning:** Without a lock, two members could both pass the availability check at the same time and both write a booking, resulting in an overbooked slot. `SELECT FOR UPDATE` ensures only one transaction proceeds; the second reads the updated state and fails cleanly with a "slot no longer available" error, which the app surfaces to the user.

**Implementation note:** This is a learning objective. The concurrency test in the testing plan (section 14 of the design doc) must cover this case explicitly: simulate two simultaneous booking requests for the same slot and assert that exactly one succeeds.

---

### 8. Block rows on booking

**Decision:** Confirming a group booking creates one Block row per attending member. The GroupBooking row stores the group-level metadata and links to the individual Block rows.

**Reasoning:** The limit checker (daily and weekly block counts) only reads Block rows. If group bookings did not produce Block rows, the checker would be blind to them. This keeps the limit logic simple and uniform — it does not need to know about groups at all.

**Schema implication:**

```
GroupBooking
  id
  group_id
  start
  end
  booked_by (user_id)
  status

Block
  id
  task_id          -- NULL for a group booking block
  group_booking_id -- NULL for a personal block; set for group booking blocks
  user_id
  start
  end
  actual_time_spent
  status
```

One of `task_id` or `group_booking_id` is set; the other is null. The limit checker counts all Block rows for a user regardless of which column is set.

---

### 9. Minimum group size

**Decision:** A group must have at least 2 members before a booking can be made. A group can be created with 1 member (the creator), but the "view free slots" and "book" actions are disabled until a second member joins.

**Reasoning:** A group session with one person is just a personal block. Enforcing the minimum on the booking action (not on creation) avoids blocking the natural flow of creating a group and then sharing the invite code.

---

### 10. Group free slots — computation, not storage

**Decision:** Group free slots are always computed on demand and never stored.

**Reasoning:** Consistent with the core principle in section 6 of the design doc: suggestions are never stored as facts. A group free slot is the intersection of all members' free intervals, filtered to times where every member has capacity under their limits. This result changes whenever any member's schedule changes, so caching it would require invalidation logic that is not worth building in v1.

**Algorithm note:** The group free-slot computation is a generalisation of the personal free-slot computation. Given N members, intersect their free intervals pairwise, then filter the result to slots of at least 65 minutes (50-minute block + 15-minute gap minimum). This belongs in the scheduler module (pure logic, no database or API dependencies) alongside the personal slot finder.

**API note:** `GET /groups/{id}/free-slots` is accessible only to members of that group. A non-member receives 403. This must be enforced on the backend, not the client.

---

## What is not in v1 (Group)

| Feature | Reason deferred |
|---|---|
| Approval-based joining | Async complexity |
| All-must-confirm booking | Notification and state complexity |
| Booking edit (change time) | Equivalent to cancel + rebook |
| Task detail visibility | Privacy; free/busy is enough |
| Invite expiry or revoke | Not needed for 10 known users |
| Group size limit | Not needed for v1 scale |
| Automatic group slot suggestions | Explicitly out of scope (design doc section 2) |

---

## Permanently out of scope (any version)

| Feature | Reason |
|---|---|
| Any member can cancel a booking | Only the booker can cancel; this is a permanent design decision, not a v1 limitation |

---

## Open questions resolved by these decisions

All open questions from section 11 of the design doc are now resolved.

The only remaining group-related item from section 18 (open questions) was whether a group session counts toward limits. **Answered: yes, it does.**
