// src/backend/server.ts
import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";

// Import routes
import userRoutes from "./routes/userRoutes";
import clientsRoutes from "./routes/clientsRoutes";
import categoriesRoutes from "./routes/categoriesRoutes";
import datasheetsRoutes from "./routes/datasheetsRoutes";
import languageRoutes from "./routes/languageRoutes";
import labelRoutes from "./routes/labelRoutes";

// Initialize environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ✅ Security, performance, and middleware
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json());

// ✅ Mount API routes
app.use("/api/users", userRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/backend/datasheets", datasheetsRoutes);   // ✅ KEY FIX
app.use("/api/languages", languageRoutes);
app.use("/api", labelRoutes);   // you can later rename to /api/labels if you prefer

// ✅ Health check route
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "Backend server is running" });
});

// ✅ 404 fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
});
