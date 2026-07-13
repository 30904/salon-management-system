import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import AttendanceRule from "../models/AttendanceRule.js";

const router = Router();

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.is_active !== undefined) {
      filter.is_active = req.query.is_active === "true";
    }

    if (req.query.branch_id) {
      filter.branch_id = req.query.branch_id;
    }

    const rules = await AttendanceRule.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: rules.map((rule) => rule.toSafeObject()),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const rule = await AttendanceRule.findById(req.params.id);

    if (!rule) {
      return res.status(404).json({ success: false, message: "Attendance rule not found" });
    }

    res.json({
      success: true,
      data: rule.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, late_mark_minutes, leave_types, branch_id, is_active } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rule name is required",
      });
    }

    const rule = await AttendanceRule.create({
      name: name.trim(),
      late_mark_minutes,
      leave_types: leave_types ?? [],
      branch_id: branch_id || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      success: true,
      data: rule.toSafeObject(),
      message: "Attendance rule created successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { name, late_mark_minutes, leave_types, branch_id, is_active } = req.body;
    const updatePayload = {};

    if (name !== undefined) updatePayload.name = name.trim();
    if (late_mark_minutes !== undefined) updatePayload.late_mark_minutes = late_mark_minutes;
    if (leave_types !== undefined) updatePayload.leave_types = leave_types;
    if (branch_id !== undefined) updatePayload.branch_id = branch_id || null;
    if (is_active !== undefined) updatePayload.is_active = is_active;

    const rule = await AttendanceRule.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: "Attendance rule not found" });
    }

    res.json({
      success: true,
      data: rule.toSafeObject(),
      message: "Attendance rule updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const rule = await AttendanceRule.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, message: "Attendance rule not found" });
    }

    res.json({
      success: true,
      data: rule.toSafeObject(),
      message: "Attendance rule deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
