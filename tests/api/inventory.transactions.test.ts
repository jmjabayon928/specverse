// tests/api/inventory.transactions.test.ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'
import cookieParser from 'cookie-parser'
import { errorHandler } from '../../src/backend/middleware/errorHandler'

// Jest runs in jsdom in this repo; Express/router expects setImmediate in Node-like env.
globalThis.setImmediate ??= ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  setTimeout(fn, 0, ...args)) as unknown as typeof setImmediate

function createAuthCookie(role: string, permissions: string[] = []): string {
  const token = jwt.sign(
    {
      userId: 1,
      email: 'test@example.com',
      fullName: 'Test User',
      role,
      roleId: 1,
      profilePic: null,
      permissions,
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' },
  )

  return `token=${token}`
}

process.env.JWT_SECRET ??= 'secret'

// Mock the database queries
const mockGetInventoryTransactionsPaged = jest.fn()
const mockGetInventoryTransactionsForCsv = jest.fn()

jest.mock('../../src/backend/database/inventoryTransactionQueries', () => ({
  getInventoryTransactionsPaged: (...args: unknown[]) => mockGetInventoryTransactionsPaged(...args),
  getInventoryTransactionsForCsv: (...args: unknown[]) => mockGetInventoryTransactionsForCsv(...args),
  getInventoryTransactions: jest.fn(),
  addInventoryTransaction: jest.fn(),
  getAllInventoryTransactions: jest.fn(),
  getAllInventoryMaintenanceLogs: jest.fn(),
  getAllInventoryAuditLogs: jest.fn(),
}))

function buildTestApp() {
  // Require after mocks so the route uses mocked DB modules
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const inventoryRoutes = require('../../src/backend/routes/inventoryRoutes').default

  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/backend/inventory', inventoryRoutes)
  app.use(errorHandler)
  return app
}

describe('Inventory Transactions API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock responses
    mockGetInventoryTransactionsPaged.mockResolvedValue({
      total: 2,
      rows: [
        {
          transactionId: 1,
          itemId: 10,
          itemName: 'Test Item 1',
          warehouseId: 1,
          warehouseName: 'Warehouse A',
          quantityChanged: 5,
          transactionType: 'Receive',
          performedAt: '2026-01-28T10:00:00.000Z',
          performedBy: 'John Doe',
        },
        {
          transactionId: 2,
          itemId: 11,
          itemName: 'Test Item 2',
          warehouseId: 2,
          warehouseName: 'Warehouse B',
          quantityChanged: -3,
          transactionType: 'Issue',
          performedAt: '2026-01-28T11:00:00.000Z',
          performedBy: 'Jane Smith',
        },
      ],
    })
    mockGetInventoryTransactionsForCsv.mockResolvedValue([
      {
        transactionId: 1,
        itemId: 10,
        itemName: 'Test Item 1',
        warehouseId: 1,
        warehouseName: 'Warehouse A',
        quantityChanged: 5,
        transactionType: 'Receive',
        performedAt: '2026-01-28T10:00:00.000Z',
        performedBy: 'John Doe',
      },
    ])
  })

  describe('Authentication', () => {
    it('returns 401 when unauthenticated', async () => {
      const app = buildTestApp()
      const res = await request(app).get('/api/backend/inventory/all/transactions')

      expect(res.statusCode).toBe(401)
    })

    it('returns 200 when authenticated with INVENTORY_VIEW permission', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body).toHaveProperty('page')
      expect(res.body).toHaveProperty('pageSize')
      expect(res.body).toHaveProperty('total')
      expect(res.body).toHaveProperty('rows')
    })
  })

  describe('List Endpoint Response Shape', () => {
    it('returns { page, pageSize, total, rows } with defaults', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(20)
      expect(res.body.total).toBe(2)
      expect(Array.isArray(res.body.rows)).toBe(true)
      expect(res.body.rows.length).toBe(2)

      // Check DTO shape (camelCase)
      const row = res.body.rows[0]
      expect(row).toHaveProperty('transactionId')
      expect(row).toHaveProperty('itemId')
      expect(row).toHaveProperty('itemName')
      expect(row).toHaveProperty('warehouseId')
      expect(row).toHaveProperty('warehouseName')
      expect(row).toHaveProperty('quantityChanged')
      expect(row).toHaveProperty('transactionType')
      expect(row).toHaveProperty('performedAt')
      expect(row).toHaveProperty('performedBy')
    })
  })

  describe('Filtering', () => {
    it('filter by warehouseId reduces results', async () => {
      mockGetInventoryTransactionsPaged.mockResolvedValueOnce({
        total: 1,
        rows: [
          {
            transactionId: 1,
            itemId: 10,
            itemName: 'Test Item 1',
            warehouseId: 1,
            warehouseName: 'Warehouse A',
            quantityChanged: 5,
            transactionType: 'Receive',
            performedAt: '2026-01-28T10:00:00.000Z',
            performedBy: 'John Doe',
          },
        ],
      })

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions?warehouseId=1')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(mockGetInventoryTransactionsPaged).toHaveBeenCalledWith(
        expect.objectContaining({ warehouseId: 1 }),
        1,
        20
      )
      expect(res.body.rows.length).toBe(1)
      expect(res.body.rows[0].warehouseId).toBe(1)
    })

    it('filter by transactionType reduces results', async () => {
      mockGetInventoryTransactionsPaged.mockResolvedValueOnce({
        total: 1,
        rows: [
          {
            transactionId: 1,
            itemId: 10,
            itemName: 'Test Item 1',
            warehouseId: 1,
            warehouseName: 'Warehouse A',
            quantityChanged: 5,
            transactionType: 'Receive',
            performedAt: '2026-01-28T10:00:00.000Z',
            performedBy: 'John Doe',
          },
        ],
      })

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions?transactionType=Receive')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(mockGetInventoryTransactionsPaged).toHaveBeenCalledWith(
        expect.objectContaining({ transactionType: 'Receive' }),
        1,
        20
      )
      expect(res.body.rows.length).toBe(1)
      expect(res.body.rows[0].transactionType).toBe('Receive')
    })

    it('filter by dateFrom and dateTo reduces results', async () => {
      mockGetInventoryTransactionsPaged.mockResolvedValueOnce({
        total: 1,
        rows: [
          {
            transactionId: 1,
            itemId: 10,
            itemName: 'Test Item 1',
            warehouseId: 1,
            warehouseName: 'Warehouse A',
            quantityChanged: 5,
            transactionType: 'Receive',
            performedAt: '2026-01-28T10:00:00.000Z',
            performedBy: 'John Doe',
          },
        ],
      })

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions?dateFrom=2026-01-28T00:00:00.000Z&dateTo=2026-01-28T23:59:59.999Z')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(mockGetInventoryTransactionsPaged).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: expect.any(Date),
          dateTo: expect.any(Date),
        }),
        1,
        20
      )
      expect(res.body.rows.length).toBe(1)
    })

    it('filter by itemId reduces results', async () => {
      mockGetInventoryTransactionsPaged.mockResolvedValueOnce({
        total: 1,
        rows: [
          {
            transactionId: 1,
            itemId: 42,
            itemName: 'Test Item 42',
            warehouseId: 1,
            warehouseName: 'Warehouse A',
            quantityChanged: 5,
            transactionType: 'Receive',
            performedAt: '2026-01-28T10:00:00.000Z',
            performedBy: 'John Doe',
          },
        ],
      })

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions?itemId=42')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(mockGetInventoryTransactionsPaged).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 42 }),
        1,
        20
      )
      expect(res.body.rows.length).toBe(1)
      expect(res.body.rows[0].itemId).toBe(42)
    })
  })

  describe('CSV Export', () => {
    it('returns text/csv content type', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions.csv')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/csv')
    })

    it('includes header row in CSV', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions.csv')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      const csv = res.text
      expect(csv).toContain('Transaction ID')
      expect(csv).toContain('Item ID')
      expect(csv).toContain('Item Name')
      expect(csv).toContain('Warehouse ID')
      expect(csv).toContain('Warehouse Name')
      expect(csv).toContain('Quantity Changed')
      expect(csv).toContain('Transaction Type')
      expect(csv).toContain('Performed At')
      expect(csv).toContain('Performed By')
    })

    it('includes data rows in CSV', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions.csv')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      const csv = res.text
      const lines = csv.split('\n')
      expect(lines.length).toBeGreaterThan(1) // Header + at least one data row
      expect(csv).toContain('Test Item 1')
      expect(csv).toContain('Warehouse A')
    })

    it('applies filters to CSV export', async () => {
      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions.csv?warehouseId=1')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(mockGetInventoryTransactionsForCsv).toHaveBeenCalledWith(
        expect.objectContaining({ warehouseId: 1 }),
        10000
      )
    })

    it('returns 413 when CSV limit exceeded', async () => {
      // Mock to return exactly 10,000 rows, but total count > 10,000
      const manyRows = Array.from({ length: 10000 }, (_, i) => ({
        transactionId: i + 1,
        itemId: 10,
        itemName: 'Test Item',
        warehouseId: 1,
        warehouseName: 'Warehouse A',
        quantityChanged: 5,
        transactionType: 'Receive',
        performedAt: '2026-01-28T10:00:00.000Z',
        performedBy: 'John Doe',
      }))
      mockGetInventoryTransactionsForCsv.mockResolvedValueOnce(manyRows)
      mockGetInventoryTransactionsPaged.mockResolvedValueOnce({
        total: 10001, // More than limit
        rows: [],
      })

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions.csv')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(413)
      expect(res.body.message).toContain('10,000')
      expect(res.body.message).toContain('limit')
    })
  })

  describe('Pagination', () => {
    it('pageSize=1 returns 1 row', async () => {
      mockGetInventoryTransactionsPaged.mockResolvedValueOnce({
        total: 2,
        rows: [
          {
            transactionId: 1,
            itemId: 10,
            itemName: 'Test Item 1',
            warehouseId: 1,
            warehouseName: 'Warehouse A',
            quantityChanged: 5,
            transactionType: 'Receive',
            performedAt: '2026-01-28T10:00:00.000Z',
            performedBy: 'John Doe',
          },
        ],
      })

      const app = buildTestApp()
      const authCookie = createAuthCookie('Admin', ['INVENTORY_VIEW'])

      const res = await request(app)
        .get('/api/backend/inventory/all/transactions?pageSize=1')
        .set('Cookie', [authCookie])

      expect(res.statusCode).toBe(200)
      expect(res.body.pageSize).toBe(1)
      expect(res.body.rows.length).toBe(1)
    })
  })
})
