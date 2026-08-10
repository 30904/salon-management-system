/**
 * Leave swap handler — Leave Clash / Swap Guide Stage 5.
 */
import LeaveRequest from "../models/LeaveRequest.js";
import { checkClash, calculateIsPaid, normalize } from "./leaveClashService.js";

/**
 * A is currently off on dateA, B is currently off on dateB.
 * They want to trade: A -> dateB, B -> dateA.
 */
export async function swapLeave({ staffIdA, dateA, staffIdB, dateB, approvedBy }) {
  const normA = normalize(dateA);
  const normB = normalize(dateB);

  // Can A take B's date? (ignore B's own current slot, since B is vacating it)
  const clashForA = await checkClash({
    staffId: staffIdA,
    date: normB,
    excludeStaffId: staffIdB,
  });
  if (!clashForA.allowed) {
    return { success: false, reason: `A cannot take that date: ${clashForA.reason}` };
  }

  // Can B take A's date?
  const clashForB = await checkClash({
    staffId: staffIdB,
    date: normA,
    excludeStaffId: staffIdA,
  });
  if (!clashForB.allowed) {
    return { success: false, reason: `B cannot take that date: ${clashForB.reason}` };
  }

  const isPaidA = await calculateIsPaid({ staffId: staffIdA, date: normB });
  const isPaidB = await calculateIsPaid({ staffId: staffIdB, date: normA });

  // Commit: remove the two old records, create the two swapped ones
  await LeaveRequest.deleteOne({ staff_id: staffIdA, date: normA });
  await LeaveRequest.deleteOne({ staff_id: staffIdB, date: normB });

  await LeaveRequest.create({
    staff_id: staffIdA,
    date: normB,
    leave_type: "swapped_off",
    status: "approved",
    is_paid: isPaidA,
    swap_with_staff_id: staffIdB,
    approved_by: approvedBy,
  });
  await LeaveRequest.create({
    staff_id: staffIdB,
    date: normA,
    leave_type: "swapped_off",
    status: "approved",
    is_paid: isPaidB,
    swap_with_staff_id: staffIdA,
    approved_by: approvedBy,
  });

  return { success: true };
}
