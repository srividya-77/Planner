/**
 * app.js
 *
 * Express application setup.
 * Registers middleware and mounts all routes.
 * Exported so it can be required in tests without binding a port.
 */
require('dotenv').config()

const express = require('express')
const cors    = require('cors')
const app     = express()

app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
}))
app.use(express.json())

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth',          require('./src/routes/auth'))
app.use('/users',         require('./src/routes/users'))
app.use('/goals',         require('./src/routes/goals'))
app.use('/tasks',         require('./src/routes/tasks'))
app.use('/fixed-events',  require('./src/routes/fixedEvents'))
app.use('/blocks',        require('./src/routes/blocks'))
app.use('/scheduler',     require('./src/routes/scheduler'))

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ─── Error handler ───────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).json({ error: 'Internal server error' })
})

module.exports = app
