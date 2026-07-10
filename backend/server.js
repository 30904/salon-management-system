import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import connectDB, { getDbStatus } from "./config/db.js";
import "./models/Role.js";
import "./models/User.js";
import apiRoutes from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiRoutes);

app.get("/api/health", (_req, res) => {
  const db = getDbStatus();
  const isHealthy = db.state === "connected";

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: {
      status: isHealthy ? "ok" : "degraded",
      service: "s21-management-system-api",
      database: db,
      timestamp: new Date().toISOString(),
    },
    message: isHealthy ? "API and database are running" : "API is up but database is not connected",
  });
});

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: "Route not found",
  });
});

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[backend] Server running on http://localhost:${PORT}`);
  });
};

startServer();
