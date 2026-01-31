/**
 * Backend-only setup: enable manual mock for src/backend/config/db so no real mssql runs.
 * Tests that need a custom db mock can still use jest.mock('../../src/backend/config/db', factory).
 */
jest.mock('../src/backend/config/db')
