import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// Staff Attendance & Punch In/Out module
router.use(authenticate);

router.get("/", async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: "Attendance module mounted successfully",
  });
});

router.post("/punch", async (req, res) => {
  res.json({
    success: true,
    data: { userId: req.user?._id, action: req.body?.action || "punch_in", timestamp: new Date() },
    message: "Attendance recorded successfully",
  });
});

export default router;
