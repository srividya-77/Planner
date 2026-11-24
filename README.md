# Planner

A study planner API with a free-slot finder. The backend is built in Node.js and is planned to be built twice — once with the MERN stack and once with Go and Flutter — on separate branches, using the same schema and API shape.

## What it does

The API lets users:
- Register and log in with JWT authentication
- Create goals (with a 1–5 weight and a priority rank) and tasks under those goals
- Add fixed events (classes, commitments) that block time
- Book study sessions (blocks), with daily and weekly limits enforced
- Create study groups, join them by invite code, and book shared group sessions
- Ask the scheduler for a suggested next study slot, calculated from free time, deadlines, and goal weights

Suggestions and group free slots are computed on demand and never stored. The scheduler lives as pure logic in `src/scheduler/`, separate from routes and database code, so it can be unit-tested independently.

## Built with

- Node.js + Express
- PostgreSQL (via Prisma ORM)
- JWT authentication (`jsonwebtoken`)
- bcrypt (password hashing)
- Jest + Supertest (tests)

The `client/` folder contains a Vite + React frontend (work in progress).

## How to run

**Prerequisites:** Node.js, PostgreSQL running locally, a `.env` file with at least `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_URL`.

```bash
cd Planner
npm install
npx prisma migrate dev   # run database migrations
npm start                # starts the API on port 3000
```

Run tests:
```bash
npm test
```

See `techstack.md` and `schema.md` for detailed design decisions and the full database schema.
