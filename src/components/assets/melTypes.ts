// Shared types for MEL assets list page.
// MelAssetListItem is the backend list item shape; alias to domain type to prevent DTO drift.
import type { AssetListItem } from '@/domain/schedules/scheduleTypes'

export type MelAssetListItem = AssetListItem

export type MelAssetsSearchParams = {
  q?: string
  criticality?: string
  location?: string
  system?: string
  service?: string
  clientId?: number
  projectId?: number
  disciplineId?: number
  subtypeId?: number
  take: number
  skip: number
}
