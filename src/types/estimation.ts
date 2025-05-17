// Project Estimation Main Record
export interface Estimation {
    EstimationID: number;
    SheetID: number;
    ClientID?: number;
    ProjectID?: number;
    Title: string;
    Description?: string;
    EstimatedBy?: number;
    EstimationDate: string;
    TotalMaterialCost?: number;
    TotalLaborCost?: number;
    TotalDurationDays?: number;
    CurrencyCode?: string;
    Status: string;
    CreatedAt?: string;
    CreatedBy?: number;
    ModifiedAt?: string;
    ModifiedBy?: number;
}

// Input for Create/Update Estimation
export interface NewEstimationInput {
    SheetID: number;
    Title: string;
    Description?: string;
    ClientID?: number;
    ProjectID?: number;
    EstimatedBy?: number;
    CreatedBy?: number;
}

// Work Package
export interface EstimationPackage {
    PackageID: number;
    EstimationID: number;
    PackageName: string;
    Description?: string;
    Sequence: number;
    TotalMaterialCost?: number;
    TotalLaborCost?: number;
    TotalDurationDays?: number;
    CreatedAt?: string;
    CreatedBy?: number;
    ModifiedAt?: string;
    ModifiedBy?: number;
}

// Input for Create/Update Package
export interface NewPackageInput {
    EstimationID: number;
    PackageName: string;
    Description?: string;
    Sequence?: number;
    CreatedBy?: number;
}

// Estimation Item (per Package)
export interface EstimationItem {
    ItemID: number;
    EstimationID: number;
    PackageID?: number;
    InformationValueID?: number;
    PartName: string;
    Description?: string;
    Quantity: number;
    UnitOfMeasure?: string;
    UnitCost: number;
    SupplierID?: number;
    EstimatedDeliveryDays?: number;
    Notes?: string;
    LineTotal?: number;
    CreatedAt?: string;
    CreatedBy?: number;
    ModifiedAt?: string;
    ModifiedBy?: number;
}

// Input for Create/Update Item
export interface NewEstimationItemInput {
    EstimationID: number;
    PackageID?: number;
    PartName: string;
    Quantity: number;
    UnitCost: number;
    UnitOfMeasure?: string;
    Description?: string;
    SupplierID?: number;
    CreatedBy?: number;
}

// Supplier Quote (multiple quotes per item)
export interface SupplierQuote {
    QuoteID: number;
    ItemID: number;
    SupplierID: number;
    SupplierName: string;
    QuotedUnitCost: number;
    ExpectedDeliveryDays?: number;
    CurrencyCode?: string;
    IsSelected: boolean;
    Notes?: string;
    CreatedAt?: string;
    CreatedBy?: number;
    ModifiedAt?: string;
    ModifiedBy?: number;
}

// Input for Create/Update Supplier Quote
export interface NewSupplierQuoteInput {
    ItemID: number;
    SupplierID: number;
    QuotedUnitCost: number;
    ExpectedDeliveryDays?: number;
    CurrencyCode?: string;
    IsSelected?: boolean;
    Notes?: string;
    CreatedBy?: number;
}

// Estimation → Supplier Mapping (optional global suppliers)
export interface EstimationSupplier {
    EstimationSupplierID: number;
    EstimationID: number;
    SupplierID: number;
    SupplierQuoteReference?: string;
    TotalQuotedCost?: number;
    CurrencyCode?: string;
    ExpectedDeliveryDays?: number;
    Notes?: string;
    CreatedAt?: string;
    CreatedBy?: number;
    ModifiedAt?: string;
    ModifiedBy?: number;
}

// Input for Create/Update EstimationSupplier
export interface NewEstimationSupplierInput {
    EstimationID: number;
    SupplierID: number;
    SupplierQuoteReference?: string;
    TotalQuotedCost?: number;
    CurrencyCode?: string;
    ExpectedDeliveryDays?: number;
    Notes?: string;
    CreatedBy?: number;
}

// Supplier Master Table
export interface Supplier {
    SupplierID: number;
    SuppCode?: string;
    SuppName: string;
    SuppContact?: string;
    SuppEmail?: string;
    SuppPhone?: string;
    SuppAddress?: string;
    Notes?: string;
}

// Input for Create/Update Supplier
export interface NewSupplierInput {
    SuppName: string;
    SuppCode?: string;
    SuppContact?: string;
    SuppEmail?: string;
    SuppPhone?: string;
    SuppAddress?: string;
    Notes?: string;
}

// Change Log Record
export interface EstimationChangeLog {
    ChangeLogID: number;
    EstimationID: number;
    ItemID?: number;
    ChangedBy: number;
    ChangedAt: string;
    FieldChanged: string;
    OldValue?: string;
    NewValue?: string;
}

export type PackageFormProps = {
    estimationId: number;
    onSuccess: () => void;
};

export type ItemFormProps = {
    packageId: number;
    estimationId: number;
    onSuccess: () => void;
};

export type SupplierQuoteFormProps = {
    itemId: number;
    onSuccess: () => void;
};

export interface PackageFormValues {
  PackageName: string;
  Description?: string;
  Sequence: number;
}

export interface ItemFormValues {
  PartName: string;
  Quantity: number;
  UnitCost: number;
}

export interface SupplierQuoteFormValues {
  SupplierID: number;
  QuotedUnitCost: number;
  ExpectedDeliveryDays: number;
  CurrencyCode: string;
  Notes?: string;
}
