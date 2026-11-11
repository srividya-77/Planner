/**
 * server.js
 *
 * Entry point. Starts the HTTP server.
 * app.js is kept separate so routes can be tested without binding a port.
 */

const app  = require('./app')
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`Planner API running on port ${PORT}`)
})
