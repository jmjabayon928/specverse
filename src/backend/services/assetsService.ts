// src/backend/services/assetsService.ts
import { listAssets as repoListAssets, getAssetById as repoGetAssetById, getAssetCustomFields as repoGetAssetCustomFields } from '../repositories/assetsRepository'
import type { AssetListItem } from '@/domain/schedules/scheduleTypes'
import type { AssetsListFilters } from '../repositories/assetsRepository'

export type AssetDetail = {
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
  createdAt: Date
  updatedAt: Date
  facilityId: number | null
  facilityName: string | null
  systemId: number | null
  systemName: string | null
}

export type AssetCustomFieldDto = {
  customFieldId: number
  fieldKey: string
  displayLabel: string
  dataType: string
  value: string | number | boolean | Date | null
}

export async function listAssets(
  accountId: number,
  filters: AssetsListFilters
): Promise<AssetListItem[]> {
  return repoListAssets(accountId, filters)
}

export async function getAssetById(
  accountId: number,
  assetId: number
): Promise<AssetDetail | null> {
  return repoGetAssetById(accountId, assetId)
}

export async function getAssetCustomFields(
  accountId: number,
  assetId: number
): Promise<AssetCustomFieldDto[]> {
  const rows = await repoGetAssetCustomFields(accountId, assetId)

  return rows.map(r => {
    let value: string | number | boolean | Date | null = null

    if (r.valueString != null) value = r.valueString
    else if (r.valueNumber != null) value = r.valueNumber
    else if (r.valueBool != null) value = r.valueBool
    else if (r.valueDate != null) value = r.valueDate
    else if (r.valueJson != null) value = r.valueJson

    return {
      customFieldId: r.customFieldId,
      fieldKey: r.fieldKey,
      displayLabel: r.displayLabel,
      dataType: r.dataType,
      value
    }
  })
}