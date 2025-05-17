import { poolPromise, sql } from "../config/db";
import { NewSupplierQuoteInput } from "@/types/estimation";

export async function getQuotesByItemId(itemId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("ItemID", sql.Int, itemId)
    .query(`
      SELECT q.*, s.SuppName AS SupplierName
      FROM EstimationItemSupplierQuotes q
      LEFT JOIN Suppliers s ON q.SupplierID = s.SuppID
      WHERE q.ItemID = @ItemID
      ORDER BY q.QuoteID
    `);

  return result.recordset;
}

export async function createSupplierQuote(data: NewSupplierQuoteInput) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("ItemID", sql.Int, data.ItemID)
        .input("SupplierID", sql.Int, data.SupplierID)
        .input("QuotedUnitCost", sql.Decimal(18,2), data.QuotedUnitCost)
        .input("CurrencyCode", sql.NVarChar(10), data.CurrencyCode ?? '')
        .input("ExpectedDeliveryDays", sql.Int, data.ExpectedDeliveryDays ?? null)
        .input("Notes", sql.NVarChar(sql.MAX), data.Notes ?? '')
        .query(`
            INSERT INTO EstimationItemSupplierQuotes (ItemID, SupplierID, QuotedUnitCost, CurrencyCode, ExpectedDeliveryDays)
            VALUES (@ItemID, @SupplierID, @QuotedUnitCost, @CurrencyCode, @ExpectedDeliveryDays);
            SELECT SCOPE_IDENTITY() AS QuoteID;
        `);
    return result.recordset[0].QuoteID;
}

export async function selectSupplierQuote(quoteId: number) {
    const pool = await poolPromise;
    await pool.request()
        .input("QuoteID", sql.Int, quoteId)
        .query(`
            DECLARE @ItemID INT;
            SELECT @ItemID = ItemID FROM SupplierQuotes WHERE QuoteID = @QuoteID;

            UPDATE SupplierQuotes
            SET IsSelected = CASE WHEN QuoteID = @QuoteID THEN 1 ELSE 0 END
            WHERE ItemID = @ItemID;
        `);
}
