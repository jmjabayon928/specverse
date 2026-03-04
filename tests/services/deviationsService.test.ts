import {
  createDeviation,
  getDeviationById,
  listDeviations,
  updateDeviation,
  transitionDeviation,
} from '../../src/backend/services/deviationsService'
import { AppError } from '../../src/backend/errors/AppError'

const mockCreateDeviation = jest.fn()
const mockGetDeviationById = jest.fn()
const mockListDeviations = jest.fn()
const mockUpdateDeviation = jest.fn()
const mockTransitionDeviation = jest.fn()
const mockGetLifecycleStateId = jest.fn()
const mockAssertAllowedTransition = jest.fn()
const mockInsertAuditLog = jest.fn()

jest.mock('../../src/backend/repositories/deviationsRepository', () => ({
  createDeviation: (...args: unknown[]) => mockCreateDeviation(...args),
  getDeviationById: (...args: unknown[]) => mockGetDeviationById(...args),
  listDeviations: (...args: unknown[]) => mockListDeviations(...args),
  updateDeviation: (...args: unknown[]) => mockUpdateDeviation(...args),
  transitionDeviation: (...args: unknown[]) => mockTransitionDeviation(...args),
}))

jest.mock('../../src/backend/config/db', () => ({
  poolPromise: Promise.resolve({}),
}))

jest.mock('../../src/backend/services/lifecycle/lifecycleService', () => ({
  getLifecycleStateId: (...args: unknown[]) => mockGetLifecycleStateId(...args),
  assertAllowedTransition: (...args: unknown[]) => mockAssertAllowedTransition(...args),
}))

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: (entry: unknown) => mockInsertAuditLog(entry),
}))

const stubDeviation = {
  deviationId: 1,
  title: 'Test',
  description: null,
  lifecycleStateId: 10,
  lifecycleCode: 'OPEN',
  projectId: null,
  clientId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 1,
  updatedBy: null,
  accountId: 1,
}

describe('deviationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetLifecycleStateId.mockResolvedValue(10)
    mockGetDeviationById.mockResolvedValue(stubDeviation)
  })

  describe('transitionDeviation', () => {
    it('calls insertAuditLog with PerformedBy=userId after valid transition', async () => {
      mockAssertAllowedTransition.mockImplementation(() => {})
      mockGetLifecycleStateId.mockResolvedValue(20)
      mockTransitionDeviation.mockResolvedValue(undefined)
      mockGetDeviationById.mockResolvedValue({ ...stubDeviation, lifecycleCode: 'IN_REVIEW', lifecycleStateId: 20 })

      await transitionDeviation(1, 99, 1, 'IN_REVIEW', 'optional note')

      expect(mockInsertAuditLog).toHaveBeenCalledTimes(1)
      expect(mockInsertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          Action: 'DEVIATION_TRANSITION',
          TableName: 'Deviations',
          RecordID: 1,
          PerformedBy: 99,
        })
      )
    })

    it('throws on invalid transition', async () => {
      mockAssertAllowedTransition.mockImplementation(() => {
        throw new AppError('Transition not allowed: VOID -> OPEN', 400)
      })

      await expect(transitionDeviation(1, 99, 1, 'OPEN')).rejects.toThrow(AppError)
      await expect(transitionDeviation(1, 99, 1, 'OPEN')).rejects.toThrow('Transition not allowed')

      expect(mockTransitionDeviation).not.toHaveBeenCalled()
      expect(mockInsertAuditLog).not.toHaveBeenCalled()
    })
  })
})
