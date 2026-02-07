import request from 'supertest'
import jwt from 'jsonwebtoken'

import router from '../../src/backend/routes/accountsRoutes'
import { requireAdmin } from '../../src/backend/middleware/requireAdmin'
import * as accountsService from '../../src/backend/services/accountsService'

import * as accountContextQueries from '../../src/backend/database/accountContextQueries'
import * as userActiveAccountRepository from '../../src/backend/repositories/userActiveAccountRepository'
import * as accountsRepository from '../../src/backend/repositories/accountsRepository'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

jest.mock('../../src/backend/database/accountContextQueries', () => ({
  __esModule: true,
  getAccountContextForUser: jest.fn(),
  getAccountContextForUserAndAccount: jest.fn(),
  getDefaultAccountId: jest.fn(),
  getActiveAccountId: jest.fn(),
}))

jest.mock('../../src/backend/repositories/userActiveAccountRepository', () => ({
  __esModule: true,
  getActiveAccountId: jest.fn(),
  setActiveAccount: jest.fn(),
  clearActiveAccount: jest.fn(),
}))

jest.mock('../../src/backend/repositories/accountsRepository', () => ({
  __esModule: true,
  listAccountsForUser: jest.fn(),
  getAccountById: jest.fn(),
  createAccount: jest.fn(),
  updateAccount: jest.fn(),
}))

function makeToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? 'secret', { expiresIn: '1h' })
}

function getApp(): any {
  // Import after mocks are registered.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/backend/app').default
}

const defaultContext = {
  accountId: 1,
  roleId: 1,
  roleName: 'Admin',
  permissions: [] as string[],
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(accountContextQueries.getAccountContextForUser as unknown as jest.Mock).mockResolvedValue(defaultContext)
  ;(accountContextQueries.getAccountContextForUserAndAccount as unknown as jest.Mock).mockResolvedValue(null)
  ;(accountContextQueries.getDefaultAccountId as unknown as jest.Mock).mockResolvedValue(1)
  ;(accountContextQueries.getActiveAccountId as unknown as jest.Mock).mockResolvedValue(1)

  ;(userActiveAccountRepository.getActiveAccountId as unknown as jest.Mock).mockResolvedValue(null)
  ;(userActiveAccountRepository.clearActiveAccount as unknown as jest.Mock).mockResolvedValue(undefined)

  ;(accountsRepository.listAccountsForUser as unknown as jest.Mock).mockResolvedValue([
    { accountId: 1, accountName: 'Default Account', slug: 'default', isActive: true, roleName: 'Admin' },
    { accountId: 2, accountName: 'Other Account', slug: 'other', isActive: true, roleName: 'Engineer' },
  ])
  ;(accountsRepository.getAccountById as unknown as jest.Mock).mockResolvedValue(null)
  ;(accountsRepository.createAccount as unknown as jest.Mock).mockImplementation(
    async (accountName: string, slug: string, isActive: boolean) => ({
      accountId: 123,
      accountName,
      slug,
      isActive,
    }),
  )
  ;(accountsRepository.updateAccount as unknown as jest.Mock).mockImplementation(
    async (accountId: number, patch: { accountName?: string; slug?: string; isActive?: boolean }) => ({
      accountId,
      accountName: patch.accountName ?? 'A',
      slug: patch.slug ?? 'a-1',
      isActive: patch.isActive ?? true,
    }),
  )
})

function getRouteLayers(): Array<{ method: string; path: string; handlers: string[] }> {
  const stack: any[] = (router as any).stack ?? []
  return stack
    .filter((l) => l && l.route)
    .flatMap((l) => {
      const methods = Object.keys(l.route.methods ?? {}).filter((m) => l.route.methods[m])
      const path = l.route.path as string
      const handlers = (l.route.stack ?? []).map((s: any) => s.handle?.name ?? '(anonymous)')
      return methods.map((method) => ({ method: method.toUpperCase(), path, handlers }))
    })
}

describe('accountsRoutes wiring', () => {
  test('wires admin-only endpoints behind verifyToken + requireAdmin', () => {
    const routes = getRouteLayers()

    const list = routes.find((r) => r.method === 'GET' && r.path === '/')
    const getById = routes.find((r) => r.method === 'GET' && r.path === '/:id')
    const post = routes.find((r) => r.method === 'POST' && r.path === '/')
    const patch = routes.find((r) => r.method === 'PATCH' && r.path === '/:id')

    expect(list?.handlers).toEqual(['verifyToken', 'requireAdmin', 'listAccounts'])
    expect(getById?.handlers).toEqual(['verifyToken', 'requireAdmin', 'getAccountById'])
    expect(post?.handlers).toEqual(['verifyToken', 'requireAdmin', 'createAccount'])
    expect(patch?.handlers).toEqual(['verifyToken', 'requireAdmin', 'updateAccount'])
  })
})

describe('requireAdmin', () => {
  test('allows platform superadmin', () => {
    const req: any = { user: { isSuperadmin: true, role: 'viewer' } }
    const res: any = {}
    const next = jest.fn()

    requireAdmin(req, res, next)

    expect(next).toHaveBeenCalledWith()
  })
})

describe('accountsService validation', () => {
  test('createAccount trims and validates slug format', async () => {
    await expect(accountsService.createAccount('   ', 'abc')).rejects.toMatchObject({ statusCode: 400 })
    await expect(accountsService.createAccount('Name', 'AbC')).rejects.toMatchObject({ statusCode: 400 })
    await expect(accountsService.createAccount('Name', 'ab')).rejects.toMatchObject({ statusCode: 400 })
    await expect(accountsService.createAccount('Name', 'ab_c')).rejects.toMatchObject({ statusCode: 400 })

    const created = await accountsService.createAccount('  My Account  ', 'my-account-1')
    expect(created).toMatchObject({ accountId: 123, accountName: 'My Account', slug: 'my-account-1', isActive: true })
  })
})

describe('accounts API (admin-only)', () => {
  test('GET /api/backend/accounts returns my accounts + activeAccountId', async () => {
    const app = getApp()
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app).get('/api/backend/accounts').set('Cookie', [`token=${token}`])

    expect(res.status).toBe(200)
    expect(res.body.accounts).toHaveLength(2)
    expect(res.body.activeAccountId).toBe(1)
  })

  test('GET /api/backend/accounts is forbidden for non-admin', async () => {
    const app = getApp()
    ;(accountContextQueries.getAccountContextForUser as unknown as jest.Mock).mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Viewer',
      permissions: [],
    })

    const token = makeToken({
      userId: 1,
      roleId: 2,
      role: 'Viewer',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app).get('/api/backend/accounts').set('Cookie', [`token=${token}`])
    expect(res.status).toBe(403)
  })

  test('GET /api/backend/accounts/:id returns account DTO', async () => {
    const app = getApp()
    ;(accountsRepository.getAccountById as unknown as jest.Mock).mockResolvedValueOnce({
      accountId: 5,
      accountName: 'Acme',
      slug: 'acme',
      isActive: true,
    })

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app).get('/api/backend/accounts/5').set('Cookie', [`token=${token}`])
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountId: 5, accountName: 'Acme', slug: 'acme', isActive: true })
  })

  test('POST /api/backend/accounts creates account (validates + trims)', async () => {
    const app = getApp()
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/accounts')
      .set('Cookie', [`token=${token}`])
      .send({ accountName: '  New Account  ', slug: 'new-account' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ accountId: 123, accountName: 'New Account', slug: 'new-account', isActive: true })
    expect(accountsRepository.createAccount).toHaveBeenCalledWith('New Account', 'new-account', true)
  })

  test('POST /api/backend/accounts returns 409 on duplicate slug', async () => {
    const app = getApp()
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const dupErr: any = new Error('Violation of UNIQUE KEY constraint')
    dupErr.number = 2627

    ;(accountsRepository.createAccount as unknown as jest.Mock)
      .mockResolvedValueOnce({ accountId: 200, accountName: 'One', slug: 'dup-slug', isActive: true })
      .mockRejectedValueOnce(dupErr)

    const r1 = await request(app)
      .post('/api/backend/accounts')
      .set('Cookie', [`token=${token}`])
      .send({ accountName: 'One', slug: 'dup-slug' })
    expect(r1.status).toBe(201)

    const r2 = await request(app)
      .post('/api/backend/accounts')
      .set('Cookie', [`token=${token}`])
      .send({ accountName: 'Two', slug: 'dup-slug' })
    expect(r2.status).toBe(409)
    expect(r2.body).toMatchObject({ message: expect.stringContaining('slug') })
  })

  test('PATCH /api/backend/accounts/:id updates account', async () => {
    const app = getApp()
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .patch('/api/backend/accounts/10')
      .set('Cookie', [`token=${token}`])
      .send({ accountName: '  Updated  ', isActive: false })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ accountId: 10, accountName: 'Updated', isActive: false })
    expect(accountsRepository.updateAccount).toHaveBeenCalledWith(10, { accountName: 'Updated', isActive: false })
  })

  test('PATCH /api/backend/accounts/:id returns 400 for empty body', async () => {
    const app = getApp()
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .patch('/api/backend/accounts/10')
      .set('Cookie', [`token=${token}`])
      .send({})

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ message: 'No fields to update' })
  })

  test('PATCH /api/backend/accounts/:id returns 409 on duplicate slug', async () => {
    const app = getApp()
    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: 'Admin',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const dupErr: any = new Error('Cannot insert duplicate key row')
    dupErr.number = 2601
    ;(accountsRepository.updateAccount as unknown as jest.Mock).mockRejectedValueOnce(dupErr)

    const res = await request(app)
      .patch('/api/backend/accounts/10')
      .set('Cookie', [`token=${token}`])
      .send({ slug: 'dup-slug' })

    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ message: expect.stringContaining('slug') })
  })

  test('POST /api/backend/accounts is forbidden for non-admin', async () => {
    const app = getApp()
    ;(accountContextQueries.getAccountContextForUser as unknown as jest.Mock).mockResolvedValueOnce({
      accountId: 1,
      roleId: 2,
      roleName: 'Viewer',
      permissions: [],
    })

    const token = makeToken({
      userId: 1,
      roleId: 2,
      role: 'Viewer',
      email: 'u@example.com',
      name: 'User',
      profilePic: null,
      permissions: [],
    })

    const res = await request(app)
      .post('/api/backend/accounts')
      .set('Cookie', [`token=${token}`])
      .send({ accountName: 'Name', slug: 'name-123' })

    expect(res.status).toBe(403)
  })
})
