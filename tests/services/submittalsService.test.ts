import {
  createSubmittal,
  getSubmittalById,
  listSubmittals,
  updateSubmittal,
  transitionSubmittal,
} from '../../src/backend/services/submittalsService'
import { AppError } from '../../src/backend/errors/AppError'

const mockCreateSubmittal = jest.fn()
const mockGetSubmittalById = jest.fn()
const mockListSubmittals = jest.fn()
const mockUpdateSubmittal = jest.fn()
const mockTransitionSubmittal = jest.fn()
const mockGetLifecycleStateId = jest.fn()
const mockAssertAllowedTransition = jest.fn()
const mockInsertAuditLog = jest.fn()

jest.mock('../../src/backend/repositories/submittalsRepository', () => ({
  createSubmittal: (...args: unknown[]) => mockCreateSubmittal(...args),
  getSubmittalById: (...args: unknown[]) => mockGetSubmittalById(...args),
  listSubmittals: (...args: unknown[]) => mockListSubmittals(...args),
  updateSubmittal: (...args: unknown[]) => mockUpdateSubmittal(...args),
  transitionSubmittal: (...args: unknown[]) => mockTransitionSubmittal(...args),
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

const stubSubmittal = {
  submittalId: 1,
  title: 'Test',
  description: null,
  lifecycleStateId: 10,
  lifecycleCode: 'DRAFT',
  projectId: null,
  clientId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 1,
  updatedBy: null,
  accountId: 1,
}

describe('submittalsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetLifecycleStateId.mockResolvedValue(10)
    mockGetSubmittalById.mockResolvedValue(stubSubmittal)
  })

  describe('transitionSubmittal', () => {
    it('calls insertAuditLog with PerformedBy=userId after valid transition', async () => {
      mockAssertAllowedTransition.mockImplementation(() => {})
      mockGetLifecycleStateId.mockResolvedValue(20)
      mockTransitionSubmittal.mockResolvedValue(undefined)
      mockGetSubmittalById.mockResolvedValue({ ...stubSubmittal, lifecycleCode: 'SUBMITTED', lifecycleStateId: 20 })

      await transitionSubmittal(1, 99, 1, 'SUBMITTED', 'optional note')

      expect(mockInsertAuditLog).toHaveBeenCalledTimes(1)
      expect(mockInsertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          Action: 'SUBMITTAL_TRANSITION',
          TableName: 'Submittals',
          RecordID: 1,
          PerformedBy: 99,
        })
      )
    })

    it('throws on invalid transition', async () => {
      mockAssertAllowedTransition.mockImplementation(() => {
        throw new AppError('Transition not allowed: DRAFT -> APPROVED', 400)
      })

      await expect(transitionSubmittal(1, 99, 1, 'APPROVED')).rejects.toThrow(AppError)
      await expect(transitionSubmittal(1, 99, 1, 'APPROVED')).rejects.toThrow('Transition not allowed')

      expect(mockTransitionSubmittal).not.toHaveBeenCalled()
      expect(mockInsertAuditLog).not.toHaveBeenCalled()
    })
  })
})
