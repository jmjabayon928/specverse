import MelAssetsPageClient from '@/components/assets/MelAssetsPageClient'
import {
  buildAssetsSearchParams,
  parseAssetsSearchParamsFromRecord,
} from '@/utils/buildAssetsSearchParams'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AssetsPage({ searchParams }: Props) {
  const resolved = await searchParams
  const initialParams = parseAssetsSearchParamsFromRecord(resolved)
  const initialQueryString = buildAssetsSearchParams(initialParams)
  return (
    <MelAssetsPageClient
      initialParams={initialParams}
      initialQueryString={initialQueryString}
    />
  )
}
