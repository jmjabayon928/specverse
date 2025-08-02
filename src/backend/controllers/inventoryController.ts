import { RequestHandler } from "express";
import { poolPromise } from "../config/db";

export const getAllInventoryItemsHandler: RequestHandler = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        InventoryItemID AS ItemID,
        ItemName,
        UOM,
        UnitCost
      FROM InventoryItems
      ORDER BY ItemName
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching inventory items:", err);
    res.status(500).json({ message: "Failed to fetch inventory items" });
  }
};