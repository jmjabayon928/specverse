import { poolPromise } from '@/backend/config/db'
import { type AssetDocumentRow, listAssetDocuments as repoListAssetDocuments, addAssetDocumentLink as repoAddAssetDocumentLink, removeAssetDocumentLink as repoRemoveAssetDocumentLink } from '@/backend/repositories/assetDocumentsRepository'

export { type AssetDocumentRow }

export async function fetchAssetDocuments({
  accountId,
  assetId,
  q,
  take,
  skip,
}: {
  accountId: number
  assetId: number
  q?: string
  take: number
  skip: number
}): Promise<{ items: AssetDocumentRow[]; total: number }> {
  const pool = await poolPromise
  return repoListAssetDocuments({ pool, accountId, assetId, q, take, skip })
}

export async function addAssetDocumentLink({
  accountId,
  assetId,
  attachmentId,
  userId,
}: {
  accountId: number
  assetId: number
  attachmentId: number
  userId: number
}): Promise<void> {
  const pool = await poolPromise
  await repoAddAssetDocumentLink({ pool, accountId, assetId, attachmentId, userId })
}

export async function removeAssetDocumentLink({
  accountId,
  assetId,
  attachmentId,
}: {
  accountId: number
  assetId: number
  attachmentId: number
}): Promise<void> {
  const pool = await poolPromise
  await repoRemoveAssetDocumentLink({ pool, accountId, assetId, attachmentId })
}
