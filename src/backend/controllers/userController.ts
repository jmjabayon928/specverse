import { Request, Response } from "express";
import { sql, poolPromise } from "../config/db";

export const getUsers = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("USE DataSheets; SELECT * FROM dbo.Users");

    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error });
  }
};
