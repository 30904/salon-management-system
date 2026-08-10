import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// All leave endpoints require authentication
router.use(authenticate);

/**
 * Leave Clash / Swap Guide Stage 7 — leave route module.
 *
 * Planned endpoints (implemented in subsequent tracker rows):
 *   POST /request        — employee apply for leave
 *   POST /:id/approve    — manager approve + sync attendance
 *   POST /:id/reject     — manager reject
 *   POST /swap           — swap two staff off days
 *   GET  /               — list leave by staff_id / month
 */

export default router;
