import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes";
import clientsRoutes from "./routes/clientsRoutes";
import categoriesRoutes from "./routes/categoriesRoutes";
import datasheetsRoutes from "./routes/datasheetsRoutes";
import languageRoutes from "./routes/languageRoutes";
import labelRoutes from "./routes/labelRoutes";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
}));
app.use(express.json()); // ✅ This is enough

// ✅ API Routes
app.use("/api", userRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/datasheets", datasheetsRoutes); // Should include all datasheet routes
app.use("/api/languages", languageRoutes);
app.use("/api", labelRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
