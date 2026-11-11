/**
 * src/middleware/auth.js
 *
 * JWT authentication middleware.
 * Verifies the Bearer token from the Authorization header.
 * On success, attaches { id, email } to req.user and calls next().
 * On failure, returns 401.
 */
const jwt = require('jsonwebtoken')

function auth(req, res, next) {
    const header = req.headers['authorization']
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header missing or malformed' })
    }

    const token = header.slice(7) // strip "Bearer "
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        req.user = { id: payload.sub, email: payload.email }
        next()
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }
}

module.exports = auth
