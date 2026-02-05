// tests/middleware/datasheetPermissions.test.ts
import type { Request, Response, NextFunction } from 'express'
import { requirePermission } from '../../src/backend/middleware/authMiddleware'
import { checkUserPermission } from '../../src/backend/database/permissionQueries'
import { PERMISSIONS } from '../../src/constants/permissions'

jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: jest.fn(),
}))

const mockedCheckUserPermission = checkUserPermission as jest.Mock

function createResponseMock() {
  const send = jest.fn()
  const status = jest.fn(() => ({
    send,
  }))

  const res = {
    status,
    send,
  } as unknown as Response

  return { res, status, send }
}

function createNextMock() {
  const next = jest.fn() as unknown as NextFunction
  return next
}

describe('requirePermission middleware', () => {
  const permissionKey = PERMISSIONS.DATASHEET_EDIT

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls next when user has the required permission', async () => {
    const middleware = requirePermission(permissionKey)

    const req = {
      user: {
        userId: 1,
        accountId: 1,
        permissions: [permissionKey],
      },
      cookies: {},
    } as unknown as Request

    const { res } = createResponseMock()
    const next = createNextMock()

    mockedCheckUserPermission.mockResolvedValueOnce(true)

    await middleware(req, res, next)

    expect(mockedCheckUserPermission).toHaveBeenCalledWith(1, 1, permissionKey)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('returns 403 when user is present but does not have the permission', async () => {
    const middleware = requirePermission(permissionKey)

    const req = {
      user: {
        userId: 2,
        accountId: 1,
        permissions: [PERMISSIONS.DATASHEET_VIEW],
      },
      cookies: {},
    } as unknown as Request

    const { res, status, send } = createResponseMock()
    const next = createNextMock()

    mockedCheckUserPermission.mockResolvedValueOnce(false)

    await middleware(req, res, next)

    expect(mockedCheckUserPermission).toHaveBeenCalledWith(2, 1, permissionKey)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Permission denied', statusCode: 403 }))
  })

  it('returns 403 when req.user is missing', async () => {
    const middleware = requirePermission(permissionKey)

    const req = {
      cookies: {},
    } as unknown as Request

    const { res, status, send } = createResponseMock()
    const next = createNextMock()

    await middleware(req, res, next)

    expect(mockedCheckUserPermission).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Missing user in request', statusCode: 403 }))
  })

  it('returns 500 when checkUserPermission throws', async () => {
    const middleware = requirePermission(permissionKey)

    const req = {
      user: {
        userId: 3,
        accountId: 1,
        permissions: [],
      },
      cookies: {},
    } as unknown as Request

    const { res, status, send } = createResponseMock()
    const next = createNextMock()

    mockedCheckUserPermission.mockRejectedValueOnce(
      new Error('DB error test')
    )

    await middleware(req, res, next)

    expect(mockedCheckUserPermission).toHaveBeenCalledWith(3, 1, permissionKey)
    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Server error', statusCode: 500 }))
  })
})
