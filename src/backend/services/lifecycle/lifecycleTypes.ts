export type LifecycleEntityType = 'Sheet' | 'Submittal' | 'Deviation'
export type LifecycleCode = string

/** Explicit allowed transitions: fromCode -> [toCode, ...] */
export const allowedTransitions: Record<LifecycleEntityType, Record<string, ReadonlyArray<string>>> = {
  Sheet: {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['VERIFIED', 'REJECTED'],
    VERIFIED: ['APPROVED', 'REJECTED'],
    APPROVED: ['VOID'],
    REJECTED: ['DRAFT'],
    VOID: [],
  },
  Submittal: {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['IN_REVIEW', 'REJECTED'],
    IN_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['SUPERSEDED'],
    REJECTED: ['DRAFT'],
    SUPERSEDED: [],
  },
  Deviation: {
    OPEN: ['IN_REVIEW', 'CLOSED', 'VOID'],
    IN_REVIEW: ['APPROVED', 'REJECTED', 'CLOSED'],
    APPROVED: ['CLOSED', 'VOID'],
    REJECTED: ['CLOSED', 'VOID'],
    CLOSED: ['VOID'],
    VOID: [],
  },
}
