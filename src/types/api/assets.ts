// src/types/api/assets.ts

/**
 * Asset custom field DTO returned by GET /api/backend/assets/:id/custom-fields
 */
export type AssetCustomFieldDto = {
  customFieldId: number
  fieldKey: string
  displayLabel: string
  dataType: string
  value: string | number | boolean | Date | null
}
