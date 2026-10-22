# Tech Stack & Learning Plan
**Project:** Study Planner with Free-Slot Finder
**Author:** Srividya
**Date:** 22 October 2026
**Status:** Decided

---

## Overview

This project is built twice, on two separate branches. The problem, the rules, the data model, and the API shape are identical across both. Only the tools change. The goal is to learn two industry-relevant stacks on the same well-understood domain.

Build them **sequentially, not in parallel.** Finish and deploy Branch 1 completely before starting Branch 2.

---

## Branch 1 — MERN (build first)

**`branch: mern`**

| Layer | Technology |
|---|---|
| Frontend | React (web app) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT |
| State management | Zustand |
| DB layer | Prisma |

### Why this branch is first

JavaScript runs on both the frontend and the backend. While learning the domain — the scheduler logic, the auth flow, the group booking, the burnout rules — using one language across the stack removes one source of friction. You will make mistakes on the product. Better to make them here.

React is the most demanded frontend skill in entry-level and internship job postings in India. Node.js + Express is widely listed alongside it. Finishing this branch gives you a deployable web app and a resume entry that recruiters recognise by name.

### Why PostgreSQL and not MongoDB

MongoDB is the default M in MERN but it is the wrong database for this project. The scheduler has hard relational constraints, transactions, interval logic, and strict limit enforcement. These are relational problems. PostgreSQL handles them natively. MongoDB would require workarounds at every step.

Using PostgreSQL here also means you learn SQL once, deeply, and carry that knowledge into Branch 2 without relearning anything.

### Why Prisma

Prisma is a Node.js ORM that generates a type-safe client from your schema. For a learning project it makes the database layer readable and catches mistakes early. It also handles migrations cleanly.

### What you learn in this branch

- JavaScript (Node.js and browser)
- React: components, hooks, forms, routing, API calls, timeline view
- Zustand: simple state management
- Express: routing, middleware, validation, error handling
- REST API design: resources, status codes, clear error messages
- JWT auth: signup, login, protected routes
- PostgreSQL: schema design, queries, transactions, constraints
- Prisma: schema definition, migrations, queries
- Interval algorithms and date/time handling in JavaScript
- Concurrency: `SELECT FOR UPDATE` inside a transaction
- Testing: Jest for unit tests, Supertest for API tests
- Deployment: Node server + PostgreSQL on a VPS or platform

---

## Branch 2 — Go + Flutter (build second)

**`branch: go-flutter`**

| Layer | Technology |
|---|---|
| Frontend | Flutter (Android app) |
| Backend | Go |
| Database | PostgreSQL |
| Auth | JWT |
| State management | Provider |
| DB layer | pgx (raw queries) |

### Why this branch is second

By the time you start this branch, you know the domain completely. You know exactly what the API must do, what the database schema looks like, and where the edge cases are. The scheduler logic is already written and tested. You can focus entirely on learning Go and Flutter without also figuring out the product.

Go is a strong backend language for companies that need performance and correctness — product startups, infra teams, fintech. It is a specialist skill that pays well. Flutter is the leading cross-platform mobile framework. Together they represent a different and complementary part of the job market.

### Why pgx and not an ORM

Go developers typically write raw SQL. pgx is the standard PostgreSQL driver for Go. Writing queries by hand in this branch teaches you SQL at a deeper level and reflects what you will actually do in Go jobs. The schema is already designed from Branch 1, so this is not extra design work.

### What you learn in this branch

- Go: types, interfaces, error handling, structs, packages
- Go standard library: HTTP server, JSON, time
- Go concurrency primitives: goroutines, channels (background for the double-booking lesson)
- Flutter: widgets, navigation, forms, API calls, timeline view
- Dart: language basics
- Provider: state management in Flutter
- Pure function design: the scheduler as isolated, testable logic
- pgx: connecting to PostgreSQL, running queries, transactions
- JWT in Go
- Testing in Go: table-driven unit tests for the scheduler
- Deployment: Go binary + PostgreSQL, build an Android APK

---

## What is the same in both branches

Everything in the design doc and decisions.md applies to both branches without change.

| Thing | Same? |
|---|---|
| All scheduling rules | Yes |
| Burnout limits (8/day, 40/week) | Yes |
| Block and gap lengths | Yes |
| Data model and entities | Yes |
| API resources and shape | Yes |
| Group feature decisions | Yes |
| JWT auth | Yes |
| PostgreSQL schema | Yes (same schema, same migrations logic) |
| Scheduler as pure logic, separate from DB and API | Yes |
| Backend is source of truth | Yes |
| Suggestions never stored | Yes |

---

## Git structure

```
main                  ← design docs only, no code
├── mern              ← Branch 1, built first
└── go-flutter        ← Branch 2, built after mern is deployed
```

`main` holds:
- `decisions.md`
- `techstack.md`
- `design-doc.md` (when written up)

No application code lives on `main`.

---

## Sequence

1. Complete Branch 1 (mern) through all 7 milestones in the learning plan.
2. Deploy Branch 1. Test with real users.
3. Then start Branch 2 (go-flutter) from milestone 1.
4. Deploy Branch 2. Compare what felt different.

Do not switch between branches mid-milestone. Finish what you started.

---

## Resume impact

After Branch 1: React, Node.js, Express, PostgreSQL, REST APIs, JWT, Zustand, Prisma, Jest, deployment. Covers most entry-level full-stack web job requirements in India.

After Branch 2: Go, Flutter, Dart, pgx, Provider, Android APK build. Adds mobile and systems backend skills. Differentiates your resume from the typical MERN-only candidate.

Both together: you have built the same non-trivial product twice, in two different stacks, with tests and deployment. That is a strong portfolio story.
