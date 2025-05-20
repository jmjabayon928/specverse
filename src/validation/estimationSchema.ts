import { z } from "zod";

// Item form values
export const itemSchema = z.object({
  ItemID: z.number().int().positive("Item ID is required."),
  Description: z.string().min(1, "Description is required."),
  Quantity: z.number().positive("Quantity must be greater than 0."),
});

export type ItemFormValues = z.infer<typeof itemSchema>;

// Supplier Quote form values
export const supplierQuoteSchema = z.object({
  SupplierID: z.number().int().positive("Supplier is required."),
  UnitCost: z.number().nonnegative("Unit cost must be 0 or higher."),
  Currency: z.string().min(1, "Currency is required."),
  ExpectedDeliveryDays: z.number().nonnegative("Must be 0 or higher."),
  Notes: z.string().optional(),
});

export type SupplierQuoteFormValues = z.infer<typeof supplierQuoteSchema>;
