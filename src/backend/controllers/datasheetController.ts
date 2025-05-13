// src/backend/controllers/datasheetController.ts
import { Request, Response } from "express";
import { poolPromise } from "../config/db";

export const getParentDatasheets = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT * FROM Sheets WHERE ParentSheetID IS NULL ORDER BY SheetID DESC
    `);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("❌ Failed to fetch parent datasheets:", err);
    res.status(500).json({ error: "Failed to fetch parent datasheets" });
  }
};
