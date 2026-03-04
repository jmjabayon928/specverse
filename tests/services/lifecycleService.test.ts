import { assertAllowedTransition } from '../../src/backend/services/lifecycle/lifecycleService'
import { AppError } from '../../src/backend/errors/AppError'

describe('lifecycleService', () => {
  describe('assertAllowedTransition', () => {
    it('allows valid Sheet transition DRAFT -> SUBMITTED', () => {
      expect(() => assertAllowedTransition('Sheet', 'DRAFT', 'SUBMITTED')).not.toThrow()
    })

    it('allows valid Sheet transition VERIFIED -> APPROVED', () => {
      expect(() => assertAllowedTransition('Sheet', 'VERIFIED', 'APPROVED')).not.toThrow()
    })

    it('blocks invalid Sheet transition DRAFT -> APPROVED', () => {
      expect(() => assertAllowedTransition('Sheet', 'DRAFT', 'APPROVED')).toThrow(AppError)
      expect(() => assertAllowedTransition('Sheet', 'DRAFT', 'APPROVED')).toThrow('Transition not allowed')
      const err = (() => {
        try {
          assertAllowedTransition('Sheet', 'DRAFT', 'APPROVED')
        } catch (e) {
          return e as AppError
        }
        return null
      })()
      expect(err?.statusCode).toBe(400)
    })

    it('allows valid Submittal transition SUBMITTED -> IN_REVIEW', () => {
      expect(() => assertAllowedTransition('Submittal', 'SUBMITTED', 'IN_REVIEW')).not.toThrow()
    })

    it('blocks invalid Submittal transition APPROVED -> DRAFT', () => {
      expect(() => assertAllowedTransition('Submittal', 'APPROVED', 'DRAFT')).toThrow(AppError)
      expect(() => assertAllowedTransition('Submittal', 'APPROVED', 'DRAFT')).toThrow('Transition not allowed')
    })

    it('allows valid Deviation transition OPEN -> IN_REVIEW', () => {
      expect(() => assertAllowedTransition('Deviation', 'OPEN', 'IN_REVIEW')).not.toThrow()
    })

    it('blocks invalid Deviation transition VOID -> OPEN', () => {
      expect(() => assertAllowedTransition('Deviation', 'VOID', 'OPEN')).toThrow(AppError)
    })

    it('throws on unknown from state', () => {
      expect(() => assertAllowedTransition('Sheet', 'UNKNOWN_STATE', 'DRAFT')).toThrow(AppError)
      expect(() => assertAllowedTransition('Sheet', 'UNKNOWN_STATE', 'DRAFT')).toThrow('Invalid from state')
    })
  })
})
