// src/domain/datasheets/templateTypes.ts

import type { InfoType, UnifiedSubsheet } from './sheetTypes'

export interface TemplateSubsheet {
  id: number
  name: string
}

export interface TemplateField {
  id: number
  label: string
  subId: number | null
}

export interface TemplateStructure {
  subsheets: TemplateSubsheet[]
  fields: TemplateField[]
}

/**
 * Row shape returned by GET /api/backend/templates
 * and consumed by the templates index page.
 */
export type TemplateRow = {
  sheetId: number
  sheetName: string
  sheetDesc?: string
  categoryId: number
  categoryName: string
  preparedById: number
  preparedByName: string
  revisionDate: string
  status: string
}

/**
 * Info field definition used in template builders.
 * (Re-exported here for convenience; underlying type still
 * lives in the datasheets domain.)
 */
export interface TemplateInfoField {
  id?: number              // Filled InfoTemplateID
  originalId?: number      // Template InfoTemplateID
  label: string
  infoType: InfoType
  uom?: string
  sortOrder: number
  required: boolean
  options?: string[]
  value?: string | number | null
}

/**
 * Payload used when creating/updating a template.
 * Mirrors the existing TemplateInput from sheetTypes,
 * but lives in a template-specific domain.
 */
export type TemplateInput = {
  datasheet: {
    sheetName: string
    sheetDesc: string
    sheetDesc2?: string
    clientId: number
    clientDocNum: number
    clientProjectNum: number
    companyDocNum: number
    companyProjectNum: number
    areaId: number
    packageName: string
    revisionNum: number
    revisionDate: string
    equipmentName: string
    equipmentTagNum: string
    serviceName: string
    requiredQty: number
    itemLocation: string
    designPressure: number
    designTemperature: number
    operatingPressure: number
    operatingTemperature: number
    testPressure: number
    corrosionAllowance: number
    insulation: string
    pwhtRequired: boolean
    hydrotestRequired: boolean
    paintSpec: string
    notes?: string
    locationDwg?: string
    pid?: number
    installDwg?: string
    codeStd?: string
    categoryId: number
    projectId: number
  }
  subsheets: UnifiedSubsheet[]
}

/**
 * Used by forms / controller when they need to know
 * explicitly that a sheet is a template.
 */
export type FullTemplateInput = TemplateInput & {
  isTemplate: boolean
}
