// src/backend/types/mirror.ts

export type LangTag = 'fr-CA' | 'fr' | 'en' | 'de' | 'ru' | 'zh' | 'ar'

export interface RegionDef {
  name: string
  bbox: [number, number, number, number]
  grid?: {
    rows: number
    cols: number
    cellBBoxes: [number, number, number, number][]
  }
}

export interface FieldDef {
  key: string
  label: string
  bbox: [number, number, number, number]
  type: 'string' | 'number' | 'enum' | 'bool' | 'date'
  options?: string[]
  mapTo: {
    bucket: 'sheet' | 'equipment' | 'subsheet' | 'templateField'
    subsheetName?: string
    infoTemplateId?: number
  }
}

export interface SheetDefinitionJSON {
  id: string
  clientKey: string
  sourceKind: 'xlsx'
  fingerprint: {
    pageSize: {
      w: number
      h: number
    }
    anchors: Array<{
      text: string
      bbox: [number, number, number, number]
    }>
    gridHash: string
    labelSet: string[]
  }
  regions: {
    header: RegionDef
    equipment: RegionDef
    subsheets: RegionDef[]
  }
  fields: FieldDef[]
  renderHints: {
    font: string
    baseLineHeight: number
    tableBorders: Array<{
      path: [number, number][]
      weight: number
    }>
    exactPlacement: boolean
  }
}

export interface ApplyResult {
  ok: true
  fileName: string
  downloadPath: string
}
