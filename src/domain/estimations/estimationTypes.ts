// src/domain/estimation/estimationTypes.ts

// Main record for a project estimation
export interface Estimation {
  EstimationID: number
  ClientID: number
  ClientName?: string
  ProjectID: number
  ProjectName?: string
  Title: string
  Description?: string
  TotalMaterialCost?: number
  TotalLaborCost?: number
  TotalDurationDays?: number
  CurrencyCode?: string
  Status: string
  CreatedByName?: string
  CreatedAt: string
  VerifiedByName?: string
  VerifiedAt?: string
  ApprovedByName?: string
  ApprovedAt?: string
}

// Input payload for creating or updating an estimation
export interface NewEstimationInput {
  Title: string
  Description?: string
  ClientID?: number
  ProjectID?: number
  EstimatedBy?: number
  CreatedBy?: number
}

// Work package under an estimation
export interface EstimationPackage {
  PackageID: number
  EstimationID: number
  PackageName: string
  Description?: string
  Sequence: number
  TotalMaterialCost?: number
  TotalLaborCost?: number
  TotalDurationDays?: number
  CreatedAt?: string
  CreatedBy?: number
  ModifiedAt?: string
  ModifiedBy?: number
  CreatedByName?: string
  ModifiedByName?: string
}

// Input payload for creating or updating a package
export interface NewPackageInput {
  EstimationID: number
  PackageName: string
  Description?: string
  Sequence?: number
  CreatedBy?: number
}

// Estimation item inside a package
export interface EstimationItem {
  EItemID: number
  EstimationID: number
  PackageID?: number
  ItemID: number
  Quantity: number
  Description?: string
  CreatedAt?: string
  CreatedBy?: number
  CreatedByName?: string
  ItemName?: string
  UnitCost?: number
  HasSelectedQuote?: boolean
  UOM?: string
}

// Basic quote view attached to an estimation item
export interface EstimationQuote {
  QuoteID: number
  ItemID: number
  SupplierID: number
  UnitCost: number
  Currency: string
  ExpectedDeliveryDays: number
  Notes?: string
  IsSelected: boolean
  CreatedAt?: string
  CreatedBy?: number
  SupplierName?: string
}

// Input payload for creating or updating an estimation item
export interface NewEstimationItemInput {
  EstimationID: number
  PackageID?: number
  ItemID: number // refers to SheetID
  Quantity: number
  Description?: string
  CreatedBy?: number
}

// Supplier quote with full details for an item
export interface SupplierQuote {
  /** Unique row id for React keys; one per quote row from API */
  QuoteRowID: number
  QuoteID: number
  ItemID: number
  SupplierID: number
  QuotedUnitCost: number
  ExpectedDeliveryDays: number
  CurrencyCode: string
  IsSelected: boolean
  Notes: string
  SupplierQuoteReference: string
  TotalQuotedCost: number
  SupplierCurrency: string
  SupplierDeliveryDays: number
  ItemName: string
  SupplierName: string
  CreatedAt?: string
}

/** Response shape for PUT /api/backend/estimation/quotes/:id (only fields from UPDATE/SELECT) */
export interface SupplierQuoteUpdateResponse {
  QuoteRowID: number
  QuoteID: number
  ItemID: number
  SupplierID: number
  QuotedUnitCost: number
  ExpectedDeliveryDays: number
  CurrencyCode: string
  IsSelected: boolean
  Notes: string
}

// Input payload for creating or updating a supplier quote
export interface NewSupplierQuoteInput {
  ItemID: number
  SupplierID: number
  QuotedUnitCost: number
  ExpectedDeliveryDays?: number
  CurrencyCode?: string
  IsSelected?: boolean
  Notes?: string
  CreatedBy?: number
}

// Mapping of estimation to a specific supplier (optional global suppliers)
export interface EstimationSupplier {
  EstimationSupplierID: number
  EstimationID: number
  SupplierID: number
  SupplierQuoteReference?: string
  TotalQuotedCost?: number
  CurrencyCode?: string
  ExpectedDeliveryDays?: number
  Notes?: string
  CreatedAt?: string
  CreatedBy?: number
  ModifiedAt?: string
  ModifiedBy?: number
}

// Input payload for creating or updating an estimation–supplier mapping
export interface NewEstimationSupplierInput {
  EstimationID: number
  SupplierID: number
  SupplierQuoteReference?: string
  TotalQuotedCost?: number
  CurrencyCode?: string
  ExpectedDeliveryDays?: number
  Notes?: string
  CreatedBy?: number
}

// Supplier master record
export interface Supplier {
  SupplierID: number
  SuppCode?: string
  SuppName: string
  SuppContact?: string
  SuppEmail?: string
  SuppPhone?: string
  SuppAddress?: string
  Notes?: string
}

// Input payload for creating or updating a supplier
export interface NewSupplierInput {
  SuppName: string
  SuppCode?: string
  SuppContact?: string
  SuppEmail?: string
  SuppPhone?: string
  SuppAddress?: string
  Notes?: string
}

// Change log record for estimation-related changes
export interface EstimationChangeLog {
  ChangeLogID: number
  EstimationID: number
  ItemID?: number
  ChangedBy: number
  ChangedAt: string
  FieldChanged: string
  OldValue?: string
  NewValue?: string
}

// Props used by the package form component
export type PackageFormProps = {
  defaultValues?: EstimationPackage
  estimationId: number
  packages: EstimationPackage[]
  mode?: 'create' | 'edit'
  onSuccess: () => void
}

// Values managed by the package form
export interface PackageFormValues {
  PackageName: string
  Description?: string
  Sequence: number
}

// Props used by the item form component
export type ItemFormProps = {
  estimationId: number
  packageId: number
  mode?: 'create' | 'edit'
  defaultValues?: EstimationItem
  onSuccess: () => void
  onCancel: () => void
}

// Props used by the supplier-quote form component
export type SupplierQuoteFormProps = {
  itemId: number
  onSuccess: () => void
}
