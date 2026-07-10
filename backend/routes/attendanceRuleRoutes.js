import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import AttendanceRule from "../models/AttendanceRule.js";
import ShiftMaster from "../models/ShiftMaster.js";
import StaffProfile from "../models/StaffProfile.js";

const router = Router();

router.use(authenticate);

// GET /api/attendance-rules - List attendance rules
router.get("/", async (req, res, next) => {
  try {
    const { is_active, branch_id } = req.query;
    const filter = {};

    if (is_active !== undefined) {
      filter.is_active = is_active === "true";
    }
    if (branch_id) {
      filter.branch_id = branch_id;
    }

    const rules = await AttendanceRule.find(filter).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: rules.map((r) => r.toSafeObject()),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance-rules/active - Helper for attendance/payroll engines to get active rule
router.get("/active", async (req, res, next) => {
  try {
    const { branch_id } = req.query;
    let rule = null;
    if (branch_id) {
      rule = await AttendanceRule.findOne({ branch_id, is_active: true });
    }
    if (!rule) {
      rule = await AttendanceRule.findOne({ branch_id: null, is_active: true });
    }
    if (!rule) {
      return res.status(404).json({ success: false, message: "No active attendance rules found" });
    }
    res.json({
      success: true,
      data: rule.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance-rules/evaluate-deduction - Feeds attendance + payroll deduction logic
// Calculates exact minutes late, late marks triggered, and suggested salary deduction
router.post("/evaluate-deduction", async (req, res, next) => {
  try {
    const { staff_id, punch_time, shift_id } = req.body;

    if (!punch_time) {
      return res.status(400).json({ success: false, message: "punch_time is required" });
    }

    // 1. Resolve Staff & Shift
    let shift = null;
    if (shift_id) {
      shift = await ShiftMaster.findById(shift_id);
    } else if (staff_id) {
      const staff = await StaffProfile.findById(staff_id).populate("shift_id");
      if (staff && staff.shift_id) {
        shift = staff.shift_id;
      }
    }

    if (!shift) {
      return res.status(400).json({
        success: false,
        message: "No shift schedule found to evaluate against punch time.",
      });
    }

    // 2. Resolve Attendance Rule
    let rule = await AttendanceRule.findOne({ branch_id: shift.branch_id, is_active: true });
    if (!rule) {
      rule = await AttendanceRule.findOne({ branch_id: null, is_active: true });
    }
    const lateThreshold = rule ? rule.late_mark_minutes : 15; // default 15 mins

    // 3. Compare punch_time (e.g. "2026-07-10T09:25:00Z" or "09:25") vs shift.start_time ("09:00")
    let punchHours, punchMinutes;
    if (typeof punch_time === "string" && punch_time.includes("T")) {
      const dt = new Date(punch_time);
      punchHours = dt.getHours();
      punchMinutes = dt.getMinutes();
    } else if (typeof punch_time === "string" && punch_time.includes(":")) {
      const parts = punch_time.split(":");
      punchHours = parseInt(parts[0], 10);
      punchMinutes = parseInt(parts[1], 10);
    } else {
      const dt = new Date(punch_time);
      punchHours = dt.getHours();
      punchMinutes = dt.getMinutes();
    }

    const [shiftHours, shiftMins] = shift.start_time.split(":").map((Number));
    const shiftTotalMinutes = shiftHours * 60 + shiftMins;
    const punchTotalMinutes = punchHours * 60 + punchMinutes;

    const minutesLate = Math.max(0, punchTotalMinutes - shiftTotalMinutes);
    const isLateMark = minutesLate > lateThreshold;

    // Payroll deduction logic rule of thumb: e.g. late mark > threshold => 0.5 day deduction, or 3 late marks = 1 day LOP
    let deductionType = "NONE";
    let deductionUnits = 0; // in days
    if (isLateMark) {
      deductionType = "LATE_MARK_PENALTY";
      deductionUnits = 0.5; // half day deduction or flagged for cumulative payroll LOP calculation
    }

    res.json({
      success: true,
      data: {
        shift_name: shift.name,
        shift_start_time: shift.start_time,
        punch_time_evaluated: `${String(punchHours).padStart(2, "0")}:${String(punchMinutes).padStart(2, "0")}`,
        late_threshold_minutes: lateThreshold,
        minutes_late: minutesLate,
        is_late_mark: isLateMark,
        payroll_deduction: {
          type: deductionType,
          deduction_days: deductionUnits,
          note: isLateMark
            ? `Late by ${minutesLate} mins (Grace limit: ${lateThreshold} mins). Triggered late mark deduction.`
            : `On time / within grace period (${minutesLate} mins late). No deduction.`,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance-rules/:id - Get specific rule
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

// POST /api/attendance-rules - Create new attendance rule
router.post("/", async (req, res, next) => {
  try {
    const { name, branch_id, late_mark_minutes, leave_types, is_active } = req.body;

    if (!name || late_mark_minutes === undefined) {
      return res.status(400).json({
        success: false,
        message: "name and late_mark_minutes are required",
      });
    }

    if (typeof late_mark_minutes !== "number" || late_mark_minutes < 0) {
      return res.status(400).json({
        success: false,
        message: "late_mark_minutes must be a non-negative number",
      });
    }

    const rule = await AttendanceRule.create({
      name,
      branch_id: branch_id || null,
      late_mark_minutes,
      leave_types: leave_types || [
        { code: "CL", name: "Casual Leave", annual_quota: 12, paid: true },
        { code: "SL", name: "Sick Leave", annual_quota: 6, paid: true },
        { code: "EL", name: "Earned Leave", annual_quota: 15, paid: true },
        { code: "LOP", name: "Loss of Pay", annual_quota: null, paid: false },
      ],
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      success: true,
      data: rule.toSafeObject(),
      message: "Attendance rule created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An attendance rule with this name already exists for the selected branch.",
      });
    }
    next(error);
  }
});

// PUT /api/attendance-rules/:id - Update attendance rule
router.put("/:id", async (req, res, next) => {
  try {
    const { name, branch_id, late_mark_minutes, leave_types, is_active } = req.body;

    const rule = await AttendanceRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Attendance rule not found" });
    }

    if (name !== undefined) rule.name = name;
    if (branch_id !== undefined) rule.branch_id = branch_id || null;
    if (late_mark_minutes !== undefined) {
      if (typeof late_mark_minutes !== "number" || late_mark_minutes < 0) {
        return res.status(400).json({ success: false, message: "late_mark_minutes must be a non-negative number" });
      }
      rule.late_mark_minutes = late_mark_minutes;
    }
    if (leave_types !== undefined) rule.leave_types = leave_types;
    if (is_active !== undefined) rule.is_active = is_active;

    await rule.save();

    res.json({
      success: true,
      data: rule.toSafeObject(),
      message: "Attendance rule updated successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An attendance rule with this name already exists for the selected branch.",
      });
    }
    next(error);
  }
});

// DELETE /api/attendance-rules/:id - Delete rule
router.delete("/:id", async (req, res, next) => {
  try {
    const rule = await AttendanceRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Attendance rule not found" });
    }
    res.json({
      success: true,
      message: "Attendance rule deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
