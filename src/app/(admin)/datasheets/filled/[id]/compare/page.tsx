// src/app/(admin)/datasheets/filled/[id]/compare/page.tsx
import { notFound } from 'next/navigation'
import SecurePage from '@/components/security/SecurePage'
import { requireAuth } from '@/utils/sessionUtils.server'
import { getCompareData, listValueSets } from '@/backend/services/valueSetService'
import ComparePageClient from './ComparePageClient'
import type { ValueSetListItem } from '@/domain/datasheets/compareTypes'

type Params = Readonly<{ id: string }>
type SearchParams = Readonly<Record<string, string | string[] | undefined>>

export default async function FilledComparePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}>) {
  await requireAuth()
  const { id } = await params
  const sp = await searchParams
  if (!id) notFound()

  const sheetId = Number.parseInt(id, 10)
  if (!Number.isFinite(sheetId)) notFound()

  const offeredPartyIdParam = Array.isArray(sp.offeredPartyId) ? sp.offeredPartyId[0] : sp.offeredPartyId
  const offeredPartyId =
    offeredPartyIdParam != null && offeredPartyIdParam !== ''
      ? Number.parseInt(String(offeredPartyIdParam), 10)
      : undefined
  const offeredPartyIdFinal = Number.isFinite(offeredPartyId) ? offeredPartyId : undefined

  const [compareData, valueSets] = await Promise.all([
    getCompareData(sheetId, offeredPartyIdFinal ?? undefined),
    listValueSets(sheetId),
  ])

  const valueSetsList: ValueSetListItem[] = valueSets.map((vs) => ({
    ValueSetID: vs.ValueSetID,
    SheetID: vs.SheetID,
    ContextID: vs.ContextID,
    Code: vs.Code,
    PartyID: vs.PartyID,
    Status: vs.Status,
  }))

  return (
    <SecurePage requiredPermission="DATASHEET_VIEW">
      <ComparePageClient
        sheetId={sheetId}
        compareData={compareData}
        valueSets={valueSetsList}
        offeredPartyId={offeredPartyIdFinal}
      />
    </SecurePage>
  )
}
