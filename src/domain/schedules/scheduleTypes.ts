// src/domain/schedules/scheduleTypes.ts

export type AssetListItem = {
  assetId: number
  assetTag: string
  assetName: string | null
  location: string | null
  system: string | null
  service: string | null
  criticality: string | null
  disciplineId: number | null
  subtypeId: number | null
  clientId: number | null
  projectId: number | null
}

export type ScheduleHeader = {
  scheduleId: number
  accountId: number
  disciplineId: number | null
  subtypeId: number | null
  name: string
  scope: string | null
  clientId: number | null
  projectId: number | null
  createdAt: Date
  createdBy: number | null
  updatedAt: Date
  updatedBy: number | null
}

export type ScheduleColumnRow = {
  scheduleColumnId: number
  accountId: number
  scheduleId: number
  columnKey: string
  columnLabel: string
  dataType: string
  enumOptionsJson: string | null
  displayOrder: number
  isRequired: boolean
  isEditable: boolean
  createdAt: Date
  createdBy: number | null
}

export type ScheduleEntryRow = {
  scheduleEntryId: number
  accountId: number
  scheduleId: number
  assetId: number
  sheetId: number | null
  rowDataJson: string | null
  createdAt: Date
  createdBy: number | null
}

export type ScheduleEntryValueRow = {
  scheduleEntryValueId: number
  accountId: number
  scheduleEntryId: number
  scheduleColumnId: number
  valueString: string | null
  valueNumber: number | null
  valueBool: boolean | null
  valueDate: Date | null
  valueJson: string | null
  updatedAt: Date
  updatedBy: number | null
}

export type ScheduleDetail = {
  schedule: ScheduleHeader
  columns: ScheduleColumnRow[]
  entries: ScheduleEntryRow[]
  values: ScheduleEntryValueRow[]
}

export type CreateScheduleBody = {
  name: string
  scope?: string | null
  disciplineId: number
  subtypeId: number
  clientId?: number | null
  projectId?: number | null
}

export type PatchScheduleBody = {
  name?: string
  scope?: string | null
}

export type ColumnPayloadItem = {
  scheduleColumnId?: number
  columnKey: string
  columnLabel: string
  dataType: string
  enumOptionsJson?: string | null
  displayOrder: number
  isRequired: boolean
  isEditable: boolean
}

export type EntryValuePayloadItem = {
  columnKey: string
  valueString?: string | null
  valueNumber?: number | null
  valueBool?: boolean | null
  valueDate?: string | null
  valueJson?: string | null
}

export type EntryPayloadItem = {
  scheduleEntryId?: number
  assetId: number
  sheetId?: number | null
  rowDataJson?: string | null
  values: EntryValuePayloadItem[]
}
