import { poolPromise } from "@/backend/config/db";

(async () => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 1 OrderIndex FROM InformationTemplates
    `);
    console.log("✅ Column exists. Sample value:", result.recordset);
  } catch (err) {
    console.error("⛔ Column check failed:", err);
  } finally {
    process.exit();
  }
})();
