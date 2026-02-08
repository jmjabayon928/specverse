// src/backend/services/assetsService.ts
import { listAssets as repoListAssets } from '../repositories/assetsRepository'
import type { AssetListItem } from '@/domain/schedules/scheduleTypes'
import type { AssetsListFilters } from '../repositories/assetsRepository'

export async function listAssets(
  accountId: number,
  filters: AssetsListFilters
): Promise<AssetListItem[]> {
  return repoListAssets(accountId, filters)
}
