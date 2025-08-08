// src/backend/config/db.ts
import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

// 🔍 Determine trustServerCertificate dynamically
function getTrustServerCertificate(): boolean {
  const env = process.env.HOST_ENVIRONMENT;

  switch (env) {
    case "local":
      return true; // ✅ Allow self-signed certs
    case "render":
    case "vercel":
      return false; // 🔒 Expect proper SSL cert
    default:
      console.warn("⚠️ Unknown HOST_ENVIRONMENT, defaulting to trustServerCertificate: true");
      return true;
  }
}

const dbConfig = {
  user: process.env.DB_USER || "",
  password: process.env.DB_PASSWORD || "",
  server: process.env.DB_SERVER || "",
  database: process.env.DB_DATABASE || "",
  options: {
    encrypt: true,
    enableArithAbort: true,
    trustServerCertificate: getTrustServerCertificate(), // 🔁 Dynamic
  },
};

if (!dbConfig.user || !dbConfig.password || !dbConfig.server || !dbConfig.database) {
  throw new Error("⛔ Missing required database environment variables. Check your .env file.");
}

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    if (process.env.NODE_ENV !== "test") {
      console.log("✅ Connected to SQL Server");
    }
    return pool;
  })
  .catch((err) => {
    console.error("⛔ Database Connection Failed:", err);
    throw err;
  });

export { poolPromise, sql, dbConfig };
