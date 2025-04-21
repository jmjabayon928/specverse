import sql from "mssql";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Validate environment variables
const dbConfig = {
  user: process.env.DB_USER || "", // Default to empty string if undefined
  password: process.env.DB_PASSWORD || "",
  server: process.env.DB_SERVER || "",
  database: process.env.DB_DATABASE || "",
  options: {
    encrypt: false, // Change to `true` if using Azure SQL
    enableArithAbort: true,
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
    console.log("✅ Connected to SQL Server");
    return pool;
  })
  .catch((err) => {
    console.error("⛔ Database Connection Failed:", err);
    throw err;
  });

export { poolPromise, sql, dbConfig };
