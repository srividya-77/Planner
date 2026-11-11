/**
 * src/__mocks__/db/prisma.js
 *
 * Jest manual mock for the Prisma client.
 * Every method returns jest.fn() so individual tests can override with
 * mockResolvedValue / mockRejectedValue as needed.
 *
 * Usage in a test file:
 *   jest.mock('../db/prisma')
 *   const prisma = require('../db/prisma')
 *   prisma.user.findUnique.mockResolvedValue({ id: '1', ... })
 */
const prisma = {
    user: {
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
    },
    goal: {
        findMany:   jest.fn(),
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
        delete:     jest.fn(),
    },
    task: {
        findMany:   jest.fn(),
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
        delete:     jest.fn(),
    },
    fixedEvent: {
        findMany:   jest.fn(),
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
        delete:     jest.fn(),
    },
    block: {
        findMany:   jest.fn(),
        findUnique: jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
        delete:     jest.fn(),
        count:      jest.fn(),
    },
    $transaction: jest.fn(),
}

module.exports = prisma
