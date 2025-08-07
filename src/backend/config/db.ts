// src/backend/config/db.ts
import sql from "mssql";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Validate environment variables
const dbConfig = {
  user: process.env.DB_USER || "",
  password: process.env.DB_PASSWORD || "",
  server: process.env.DB_SERVER || "",
  database: process.env.DB_DATABASE || "",
  options: {
    encrypt: true, 
    enableArithAbort: true,
    trustServerCertificate: process.env.NODE_ENV !== "production",
  },
};

// Ensure all required env variables exist
if (!dbConfig.user || !dbConfig.password || !dbConfig.server || !dbConfig.database) {
  throw new Error("⛔ Missing required database environment variables. Check your .env file.");
}

// Create connection pool
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
