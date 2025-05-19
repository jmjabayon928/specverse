// Project Estimation Main Record
export interface Estimation {
    EstimationID: number;
    ClientID: number;
    ClientName?: string;
    ProjectID: number;
    ProjectName?: string;
    Title: string;
    Description?: string;
    TotalMaterialCost?: number;
    TotalLaborCost?: number;
    TotalDurationDays?: number;
    CurrencyCode?: string;
    Status: string;
    CreatedByName?: string;
    CreatedAt: string;
    VerifiedByName?: string;
    VerifiedAt?: string;
    ApprovedByName?: string;
    ApprovedAt?: string;
}

// Input for Create/Update Estimation
export interface NewEstimationInput {
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
    CreatedByName?: string;
    ModifiedByName?: string;
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
  EItemID: number;
  EstimationID: number;
  PackageID?: number;
  ItemID: number;
  Quantity: number;
  Description?: string;
  CreatedAt?: string;
  CreatedBy?: number;
  CreatedByName?: string; 
  ItemName?: string; 
}

// Input for Create/Update Item
export interface NewEstimationItemInput {
    EstimationID: number;
    PackageID?: number;
    ItemID: number; // refers to SheetID
    Quantity: number;
    Description?: string;
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
  defaultValues?: EstimationPackage;
  estimationId: number;
  mode?: 'create' | 'edit';
  onSuccess: () => void;
};

export interface PackageFormValues {
  PackageName: string;
  Description?: string;
  Sequence: number;
}

export type ItemFormProps = {
  estimationId: number;
  packageId: number;
  mode?: 'create' | 'edit';
  defaultValues?: EstimationItem;
  onSuccess: () => void;
  onCancel: () => void;
};

export type SupplierQuoteFormProps = {
    itemId: number;
    onSuccess: () => void;
};

