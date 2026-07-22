import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import connectDB, { getDbStatus } from "./config/db.js";
import "./models/Role.js";
import "./models/Permission.js";
import "./models/RolePermission.js";
import "./models/UserMenuOverride.js";
import "./models/Branch.js";
import "./models/User.js";
import "./models/AuditLog.js";
import "./models/ServiceCategory.js";
import "./models/ServiceMaster.js";
import "./models/ProductMaster.js";

import "./models/TaxMaster.js";
import "./models/Customer.js";
import "./models/Booking.js";
import "./models/CommissionEntry.js";

import "./models/CommissionSlab.js";
import "./models/StaffProfile.js";
import "./models/ShiftMaster.js";
import "./models/Attendance.js";
import "./models/PackageMaster.js";
import "./models/CustomerPackage.js";
import "./models/WhatsAppTemplate.js";
import "./models/WhatsAppCampaign.js";
import "./models/Invoice.js";
import "./models/InvoiceLineItem.js";

import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { sendSuccess, sendError } from "./utils/apiResponse.js";
import apiRoutes from "./routes/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 5000;

const clientOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());
// Mobile PWA dev server (frontend-mobile) runs on 5175, or the next free port
// (5176, 5177, ...) when 5175 is already taken by another running instance.
for (const port of [5175, 5176, 5177, 5178]) {
  const origin = `http://localhost:${port}`;
  if (!clientOrigins.includes(origin)) {
    clientOrigins.push(origin);
  }
}

app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  const db = getDbStatus();
  const isHealthy = db.state === "connected";

  const payload = {
    status: isHealthy ? "ok" : "degraded",
    service: "s21-management-system-api",
    database: db,
    timestamp: new Date().toISOString(),
  };

  if (isHealthy) {
    return sendSuccess(res, {
      data: payload,
      message: "API and database are running",
    });
  }

  return sendError(res, {
    status: 503,
    data: payload,
    message: "API is up but database is not connected",
  });
});

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[backend] Server running on http://localhost:${PORT}`);
  });
};

startServer();
