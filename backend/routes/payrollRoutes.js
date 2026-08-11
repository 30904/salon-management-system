import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  finalizePayrollRun,
  getPayrollRunWithEntries,
  getStaffPayslip,
  runPayrollForMonth,
} from "../services/payrollService.js";
import { AppError } from "../utils/AppError.js";
import { sendSuccess } from "../utils/apiResponse.js";

const router = Router();

router.use(authenticate);

/**
 * POST /api/payroll/run
 * Body { month, year } — create/update draft run + entries.
 */
router.post(
  "/run",
  asyncHandler(async (req, res) => {
    const month = Number.parseInt(req.body?.month, 10);
    const year = Number.parseInt(req.body?.year, 10);

    if (!Number.isInteger(month) || !Number.isInteger(year)) {
      throw new AppError("month and year are required", 400);
    }

    const { run, entries } = await runPayrollForMonth({
      month,
      year,
      runBy: req.user._id,
    });

    return sendSuccess(res, {
      status: 201,
      data: {
        run: run.toSafeObject(),
        entries: entries.map((entry) => entry.toSafeObject()),
      },
      message: "Payroll run calculated",
    });
  })
);

/**
 * GET /api/payroll/run/:id
 * Run + entries populated with staff name/designation.
 */
router.get(
  "/run/:id",
  asyncHandler(async (req, res) => {
    const data = await getPayrollRunWithEntries(req.params.id);

    return sendSuccess(res, {
      data,
      message: "Payroll run retrieved",
    });
  })
);

/**
 * POST /api/payroll/run/:id/finalize
 * Locks the run.
 */
router.post(
  "/run/:id/finalize",
  asyncHandler(async (req, res) => {
    const run = await finalizePayrollRun(req.params.id);

    return sendSuccess(res, {
      data: run.toSafeObject(),
      message: "Payroll run finalized",
    });
  })
);

/**
 * GET /api/payroll/staff/:staffId?month=&year=
 * Employee payslip for MyEarnings.
 */
router.get(
  "/staff/:staffId",
  asyncHandler(async (req, res) => {
    const data = await getStaffPayslip({
      staffId: req.params.staffId,
      month: req.query.month,
      year: req.query.year,
    });

    return sendSuccess(res, {
      data,
      message: "Staff payslip retrieved",
    });
  })
);

export default router;
