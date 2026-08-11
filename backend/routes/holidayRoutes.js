import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { createHoliday, listHolidaysForMonth } from "../services/holidayService.js";
import { sendSuccess } from "../utils/apiResponse.js";

const router = Router();

router.use(authenticate);

/**
 * GET /api/holidays?month=&year=
 * List holidays for month — feeds summary + settings UI.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const holidays = await listHolidaysForMonth({
      month: req.query.month,
      year: req.query.year,
      branchId: req.query.branch_id || null,
    });

    return sendSuccess(res, {
      data: {
        month: Number.parseInt(req.query.month, 10),
        year: Number.parseInt(req.query.year, 10),
        holidays,
      },
      message: "Holidays retrieved",
    });
  })
);

/**
 * POST /api/holidays
 * Admin adds holiday date.
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const holiday = await createHoliday({
      date: req.body?.date,
      name: req.body?.name,
      branchId: req.body?.branch_id || null,
    });

    return sendSuccess(res, {
      status: 201,
      data: holiday.toSafeObject(),
      message: "Holiday created",
    });
  })
);

export default router;
