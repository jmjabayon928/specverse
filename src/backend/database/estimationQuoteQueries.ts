import { poolPromise, sql } from '../config/db';

export async function getQuotesByItemId(itemId: number) {
  const pool = await poolPromise;

  const result = await pool.request()
    .input("ItemID", sql.Int, itemId)
    .query(`
      SELECT 
        q.QuoteID,
        q.ItemID,
        q.SupplierID,
        s.SuppName AS SupplierName,
        q.QuotedUnitCost,
        q.ExpectedDeliveryDays,
        q.CurrencyCode,
        q.IsSelected,
        q.Notes,
        q.CreatedAt,
        q.CreatedBy,
        q.ModifiedAt,
        q.ModifiedBy
      FROM EstimationItemSupplierQuotes q
      LEFT JOIN Suppliers s ON q.SupplierID = s.SuppID
      WHERE q.ItemID = @ItemID
    `);

  return result.recordset;
}

export async function createSupplierQuote(data: {
  ItemID: number;
  SupplierID: number;
  QuotedUnitCost: number;
  ExpectedDeliveryDays?: number;
  CurrencyCode?: string;
  Notes?: string;
  IsSelected?: boolean;
  CreatedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('ItemID', sql.Int, data.ItemID)
    .input('SupplierID', sql.Int, data.SupplierID)
    .input('QuotedUnitCost', sql.Decimal(18, 2), data.QuotedUnitCost)
    .input('ExpectedDeliveryDays', sql.Int, data.ExpectedDeliveryDays ?? null)
    .input('CurrencyCode', sql.NVarChar(10), data.CurrencyCode ?? null)
    .input('Notes', sql.NVarChar(sql.MAX), data.Notes ?? null)
    .input('IsSelected', sql.Bit, data.IsSelected ?? false)
    .input('CreatedBy', sql.Int, data.CreatedBy ?? null)
    .query(`
      INSERT INTO EstimationItemSupplierQuotes (
        ItemID, SupplierID, QuotedUnitCost, ExpectedDeliveryDays,
        CurrencyCode, IsSelected, Notes, CreatedAt, CreatedBy
      )
      OUTPUT INSERTED.QuoteID
      VALUES (
        @ItemID, @SupplierID, @QuotedUnitCost, @ExpectedDeliveryDays,
        @CurrencyCode, @IsSelected, @Notes, GETDATE(), @CreatedBy
      )
    `);
  return result.recordset[0].QuoteID;
}

export async function selectSupplierQuote(quoteId: number) {
  const pool = await poolPromise;

  // Step 1: Get ItemID of selected quote
  const result = await pool.request()
    .input('QuoteID', sql.Int, quoteId)
    .query(`SELECT ItemID FROM EstimationItemSupplierQuotes WHERE QuoteID = @QuoteID`);
  const itemId = result.recordset[0]?.ItemID;

  if (!itemId) throw new Error("Quote not found");

  // Step 2: Mark all quotes as not selected, then mark this one as selected
  await pool.request()
    .input('ItemID', sql.Int, itemId)
    .query(`UPDATE EstimationItemSupplierQuotes SET IsSelected = 0 WHERE ItemID = @ItemID`);

  await pool.request()
    .input('QuoteID', sql.Int, quoteId)
    .query(`UPDATE EstimationItemSupplierQuotes SET IsSelected = 1 WHERE QuoteID = @QuoteID`);
}
