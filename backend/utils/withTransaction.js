import mongoose from "mongoose";
import { AppError } from "./AppError.js";

/**
 * MongoDB Multi-Document Transaction Helper (`withTransaction`)
 *
 * Executes the provided async callback inside an atomic MongoDB transaction using Mongoose ClientSession.
 * Designed specifically for critical multi-document atomic operations in S21 Salon Management System, such as:
 *
 * 1. Billing & Checkout with Package Redemption + Staff Commission:
 *    - Create Invoice document
 *    - Deduct sessions from Package / Subscription document
 *    - Create Staff Commission / Payroll entry document
 *    - Deduct consumed inventory stock items
 *
 * If ANY operation fails within the callback, the entire transaction is automatically rolled back (`abortTransaction`),
 * ensuring no partial writes occur and data remains consistent.
 *
 * @param {Function} callback - Async function receiving the transaction session (`async (session) => { ... }`).
 *                              All mongoose queries inside MUST pass `{ session }` in their options.
 * @param {Object} [options] - Optional transaction options (e.g. readConcern, writeConcern) & helper behavior.
 * @param {boolean} [options.fallbackIfNoReplica=false] - If true and MongoDB is running in standalone mode
 *                                                        (non-replica set), executes callback without transaction session.
 * @returns {Promise<any>} Result returned by the callback function upon successful commit.
 * @throws {Error|AppError} Throws error if transaction fails and aborts.
 */
export async function withTransaction(callback, options = {}) {
  const { fallbackIfNoReplica = false, ...txOptions } = options;

  if (mongoose.connection.readyState !== 1) {
    throw new AppError("Database not connected. Cannot start transaction.", 503);
  }

  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    }, txOptions);
    return result;
  } catch (error) {
    // Check if the error is due to running against a standalone MongoDB instance without replica set support
    const isStandaloneError =
      error?.code === 20 ||
      error?.message?.includes("Transactions are not supported") ||
      error?.message?.includes("replica set");

    if (isStandaloneError && fallbackIfNoReplica) {
      console.warn(
        "[withTransaction] Warning: Standalone MongoDB instance detected. Executing callback without atomic transaction."
      );
      return await callback(null);
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      error?.message || "Transaction aborted due to an internal error.",
      error?.statusCode || 500,
      { originalError: error?.name, stack: error?.stack }
    );
  } finally {
    await session.endSession();
  }
}

/**
 * Helper template / reference documentation for atomic billing + package redemption + staff commission writes.
 *
 * Example usage in a Billing/Invoice service or controller:
 *
 * ```js
 * import { withTransaction } from "../utils/withTransaction.js";
 * import Invoice from "../models/Invoice.js";
 * import PackageRedemption from "../models/PackageRedemption.js";
 * import StaffCommission from "../models/StaffCommission.js";
 *
 * export async function processCheckoutWithPackageAndCommission(checkoutData) {
 *   return await withTransaction(async (session) => {
 *     // 1. Create Invoice inside transaction
 *     const [invoice] = await Invoice.create([checkoutData.invoice], { session });
 *
 *     // 2. Redeem package session atomically
 *     if (checkoutData.packageRedemption) {
 *       const pkg = await PackageRedemption.findOneAndUpdate(
 *         { _id: checkoutData.packageRedemption.packageId, remaining_sessions: { $gt: 0 } },
 *         {
 *           $inc: { remaining_sessions: -1 },
 *           $push: { redemptions: { invoice_id: invoice._id, date: new Date() } }
 *         },
 *         { new: true, session }
 *       );
 *       if (!pkg) {
 *         throw new AppError("Package redemption failed: Insufficient remaining sessions", 400);
 *       }
 *     }
 *
 *     // 3. Create Staff Commission log atomically
 *     if (checkoutData.commission) {
 *       await StaffCommission.create([{ ...checkoutData.commission, invoice_id: invoice._id }], { session });
 *     }
 *
 *     // Transaction automatically commits when callback finishes successfully!
 *     return invoice;
 *   });
 * }
 * ```
 */
export default withTransaction;
