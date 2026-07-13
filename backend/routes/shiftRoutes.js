import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import ShiftMaster from "../models/ShiftMaster.js";
import StaffProfile from "../models/StaffProfile.js";

const router = Router();

router.use(authenticate);

// GET /api/shifts - List all shifts with optional filtering
router.get("/", async (req, res, next) => {
  try {
    const { is_active, branch_id, search } = req.query;
    const filter = {};

    if (is_active !== undefined) {
      filter.is_active = is_active === "true";
    }
    if (branch_id) {
      filter.branch_id = branch_id;
    }
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const shifts = await ShiftMaster.find(filter).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: shifts.map((s) => s.toSafeObject()),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/shifts/:id - Get a specific shift
router.get("/:id", async (req, res, next) => {
  try {
    const shift = await ShiftMaster.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }
    res.json({
      success: true,
      data: shift.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/shifts - Create a new shift
router.post("/", async (req, res, next) => {
  try {
    const { name, start_time, end_time, branch_id, is_active } = req.body;

    if (!name || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: "Shift name, start_time, and end_time are required.",
      });
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:mm (24-hour format e.g. 09:00, 18:30).",
      });
    }

    const shift = await ShiftMaster.create({
      name,
      start_time,
      end_time,
      branch_id: branch_id || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      success: true,
      data: shift.toSafeObject(),
      message: "Shift created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A shift with this name already exists for the selected branch.",
      });
    }
    next(error);
  }
});

// PUT /api/shifts/:id - Update existing shift
router.put("/:id", async (req, res, next) => {
  try {
    const { name, start_time, end_time, branch_id, is_active } = req.body;

    const shift = await ShiftMaster.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (start_time !== undefined) {
      if (!timeRegex.test(start_time)) {
        return res.status(400).json({ success: false, message: "Invalid start_time format (HH:mm)." });
      }
      shift.start_time = start_time;
    }
    if (end_time !== undefined) {
      if (!timeRegex.test(end_time)) {
        return res.status(400).json({ success: false, message: "Invalid end_time format (HH:mm)." });
      }
      shift.end_time = end_time;
    }
    if (name !== undefined) shift.name = name;
    if (branch_id !== undefined) shift.branch_id = branch_id || null;
    if (is_active !== undefined) shift.is_active = is_active;

    await shift.save();

    res.json({
      success: true,
      data: shift.toSafeObject(),
      message: "Shift updated successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A shift with this name already exists for the selected branch.",
      });
    }
    next(error);
  }
});

// DELETE /api/shifts/:id - Delete or deactivate shift
router.delete("/:id", async (req, res, next) => {
  try {
    const shift = await ShiftMaster.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    // Check if any staff are assigned to this shift
    const assignedStaffCount = await StaffProfile.countDocuments({ shift_id: shift._id, is_active: true });
    if (assignedStaffCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete shift: assigned to ${assignedStaffCount} active staff profile(s). Please reassign them or deactivate the shift instead.`,
      });
    }

    await ShiftMaster.findByIdAndDelete(shift._id);
    res.json({
      success: true,
      message: "Shift deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
