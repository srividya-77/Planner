/**
 * src/db/prisma.js
 *
 * Singleton Prisma client.
 * Import this everywhere instead of calling new PrismaClient() each time.
 * One connection pool shared across the whole app.
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

module.exports = prisma
