// src/domain/estimations/estimationExportTypes.ts

import type {
  EstimationItem,
  EstimationQuote,
} from '../estimations/estimationTypes'

export type EstimationExportRow = {
  EstimationID: number
  EstimationTitle: string
  EstimationDescription?: string | null
  Status: string
  ClientName: string
  ProjName: string
  CurrencyCode?: string | null
  TotalCost?: number | null
  CreatedByName?: string | null
  CreatedAt?: string | Date | null
  VerifiedByName?: string | null
  VerifiedAt?: string | number | Date | null
  ApprovedByName?: string | null
  ApprovedAt?: string | number | Date | null
}

export type EstimationPackageExportRow = {
  PackageID: number
  PackageName: string
  PackageDescription?: string | null
  Status: string
  CreatedByName?: string | null
  CreatedAt?: string | Date | null
  EstimationID?: number | null
}

export type FilteredEstimationExportRow = {
  EstimationID: number
  Title: string
  Description?: string | null
  Status: string
  ClientName?: string | null
  ProjectName?: string | null
  CreatedAt?: string | number | Date | null
}

export type ExportDetailRow = [
  string,
  string | number | null,
]

export type ExportDetailRow4 = [
  string,
  string | number | null,
  string,
  string | number | null,
]

export type FilteredEstimationsExportFilter = {
  statuses: string[]
  clients: number[]
  projects: number[]
  search: string
}

export type EstimationSummaryExportContext = {
  estimation: EstimationExportRow
  packages: EstimationPackageExportRow[]
  packageItems: Record<number, EstimationItem[]>
  itemQuotes: Record<number, EstimationQuote[]>
}

export type EstimationItemsExportContext = {
  estimation: EstimationExportRow
  packageData: EstimationPackageExportRow
  items: EstimationItem[]
}

export type EstimationPackagesExportContext = {
  estimation: EstimationExportRow
  packages: EstimationPackageExportRow[]
}

export type EstimationQuotesExportContext = {
  estimation: EstimationExportRow
  packageData: EstimationPackageExportRow
  item: EstimationItem
  quotes: EstimationQuote[]
}
