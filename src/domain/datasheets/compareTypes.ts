// src/domain/datasheets/compareTypes.ts
// Types for GET /api/backend/sheets/:sheetId/compare response (Phase 2 Slice #4).

export type VarianceStatus = 'DeviatesAccepted' | 'DeviatesRejected'

export interface CompareFieldValue {
  infoTemplateId: number
  label: string
  requirement: { value: string; uom: string | null }
  offered: Array<{
    partyId: number | null
    valueSetId: number
    value: string
    uom: string | null
    varianceStatus?: VarianceStatus
  }>
  asBuilt: {
    value: string
    uom: string | null
    varianceStatus?: VarianceStatus
  } | null
}

export interface CompareSubsheet {
  id: number
  name: string
  fields: CompareFieldValue[]
}

export interface CompareResponse {
  subsheets: CompareSubsheet[]
}

export interface ValueSetListItem {
  ValueSetID: number
  SheetID: number
  ContextID: number
  Code: string
  PartyID: number | null
  Status: string
}
