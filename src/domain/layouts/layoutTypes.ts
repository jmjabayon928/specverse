// src/domain/layout/layoutTypes.ts

// ===== Layout authoring types =====
export type PaperSize = 'A4' | 'Letter'
export type Orientation = 'portrait' | 'landscape'
export type BlockType =
  | 'Subsheet'
  | 'Field'
  | 'Table'
  | 'Text'
  | 'Image'
  | 'QRCode'
  | 'Signature'
  | 'Spacer'
  | 'TwoColumn'
  | 'ThreeColumn'

export interface GridRect {
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutMeta {
  layoutId: number
  templateId: number | null
  clientId: number | null
  paperSize: PaperSize
  orientation: Orientation
  gridCols: number
  gridGapMm: number
  marginsMm: {
    top: number
    right: number
    bottom: number
    left: number
  }
  theme?: Record<string, unknown> | null
  lockedHeader?: Record<string, unknown> | null
  lockedFooter?: Record<string, unknown> | null
  version: number
  isDefault: boolean
}

export interface LayoutRegion extends GridRect {
  regionId: number
  layoutId: number
  kind: 'locked' | 'dynamic'
  name: string
  style?: Record<string, unknown> | null
  orderIndex: number
}

export interface LayoutBlock extends GridRect {
  blockId: number
  regionId: number
  blockType: BlockType
  sourceRef?:
    | {
        SubID?: number
        InfoTemplateID?: number
        columns?: Array<{
          label?: string
          infoTemplateID?: number
          expr?: string
        }>
        url?: string
        imageKind?: 'CompanyLogo' | 'ClientLogo'
      }
    | null
  props?:
    | {
        labelPos?: 'left' | 'top' | 'hidden'
        showUnit?: 'auto' | 'override' | 'hidden'
        unitOverride?: string
        precision?: number
        hideIfEmpty?: boolean
        textAlign?: 'left' | 'center' | 'right'
      }
    | null
  orderIndex: number
}

export interface LayoutBundle {
  meta: LayoutMeta
  regions: LayoutRegion[]
  blocks: LayoutBlock[]
}

// ===== Render contracts (server-composed preview/output) =====
export type UomSystem = 'SI' | 'USC'
export type LangCode = 'en'

export interface RenderField {
  infoTemplateId: number
  label: string
  value: string
  rawValue: string | null
  uom?: string
  groupKey?: string
  cellIndex?: number
  cellCaption?: string
  columnNumber?: 1 | 2
}

export interface RenderBlock {
  blockId?: number
  title?: string
  fields?: RenderField[]
  subsheetId?: number
  children?: RenderBlock[]
}

export interface RenderHeaderVM {
  equipmentTag?: string | null
  equipmentName?: string | null
  project?: string | null
  fields: RenderField[]
}

export interface RenderPayload {
  layoutId: number
  sheetId: number
  uom: UomSystem
  lang: LangCode
  header: RenderHeaderVM
  body: RenderBlock[]
}
