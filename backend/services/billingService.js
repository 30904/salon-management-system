import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import CustomerPackage from "../models/CustomerPackage.js";
import StaffProfile from "../models/StaffProfile.js";
import CommissionEntry from "../models/CommissionEntry.js";
import { withTransaction } from "../utils/withTransaction.js";
import { AppError } from "../utils/AppError.js";
import { checkSinglePackageAfterRedeem } from "./packageAlertService.js";
import { deductStock, addStock } from "./stockService.js";

/**
 * Calculate detailed commission breakdown for a line item based on staff's assigned CommissionSlab.
 * Supports manual overrides, percentage, flat, and tiered accruals immediately on invoice save.
 * Threshold type calculation is deferred to payroll run (`deferred_threshold` status).
 */
export function calculateCommissionDetails(item, staff, lineTotal) {
  if (item.commission_amount !== undefined && item.commission_amount !== null) {
    const amt = Number(item.commission_amount) || 0;
    return {
      amount: amt,
      slab_id: staff?.commission_slab_id?._id || staff?.commission_slab_id || null,
      slab_type: "manual_override",
      status: "accrued",
      details: { note: "Manual commission override on line item", override_amount: amt },
    };
  }

  if (!staff || !staff.commission_slab_id) {
    return {
      amount: 0,
      slab_id: null,
      slab_type: "none",
      status: "accrued",
      details: { note: "No commission slab assigned to staff" },
    };
  }

  const slab = staff.commission_slab_id;
  const quantity = Number(item.quantity || 1);
  const lineRevenue = Math.max(
    0,
    Number(item.unit_price || 0) * quantity - Number(item.discount_amount || 0)
  );

  if (slab.type === "percentage") {
    const pct = Number(
      slab.rules_json?.percentage ?? slab.rules_json?.rate ?? 10
    );
    const amt = (lineRevenue * pct) / 100;
    return {
      amount: amt,
      slab_id: slab._id,
      slab_type: "percentage",
      status: "accrued",
      details: { percentage: pct, line_revenue: lineRevenue },
    };
  } else if (slab.type === "flat") {
    const flatAmt = Number(
      slab.rules_json?.flat_amount ?? slab.rules_json?.amount ?? 50
    );
    const amt = flatAmt * quantity;
    return {
      amount: amt,
      slab_id: slab._id,
      slab_type: "flat",
      status: "accrued",
      details: { flat_amount: flatAmt, quantity },
    };
  } else if (slab.type === "tiered") {
    const tiers = Array.isArray(slab.rules_json?.tiers)
      ? slab.rules_json.tiers
      : [];
    for (const tier of tiers) {
      if (
        lineRevenue >= (tier.min || 0) &&
        (!tier.max || lineRevenue <= tier.max)
      ) {
        const rate = Number(tier.rate || 0);
        const amt = tier.is_percentage ? (lineRevenue * rate) / 100 : rate * quantity;
        return {
          amount: amt,
          slab_id: slab._id,
          slab_type: "tiered",
          status: "accrued",
          details: { tier_matched: tier, line_revenue: lineRevenue, rate },
        };
      }
    }
    return {
      amount: 0,
      slab_id: slab._id,
      slab_type: "tiered",
      status: "accrued",
      details: { note: "No tier bracket matched line revenue", line_revenue: lineRevenue },
    };
  } else if (slab.type === "threshold") {
    // Threshold commission accrual is deferred to payroll cycle evaluation
    return {
      amount: 0,
      slab_id: slab._id,
      slab_type: "threshold",
      status: "deferred_threshold",
      details: {
        note: "Threshold commission evaluation deferred to payroll cycle",
        line_revenue: lineRevenue,
        rules_json: slab.rules_json || {},
      },
    };
  }

  return {
    amount: 0,
    slab_id: slab._id || null,
    slab_type: slab.type || "none",
    status: "accrued",
    details: { note: "Unknown slab type" },
  };
}

/**
 * Backward-compatible helper returning raw commission number
 */
function calculateCommissionAmount(item, staff, lineTotal) {
  const result = calculateCommissionDetails(item, staff, lineTotal);
  return result.amount;
}

/**
 * Create Invoice Atomically:
 * 1. Creates Invoice record with totals & split payments
 * 2. Creates InvoiceLineItem records with per-line staff assignment
 * 3. Deducts stock atomically from ProductMaster for product line items
 * 4. Deducts credits atomically from CustomerPackage for package redemptions
 * 5. Calculates & creates CommissionEntry records for assigned staff members
 */
export async function createInvoice(data, { userId = null } = {}) {
  const lineItemsData = Array.isArray(data.line_items) ? data.line_items : [];
  if (lineItemsData.length === 0) {
    throw new AppError("Invoice must contain at least one line item", 400);
  }

  const invoiceNumber =
    data.invoice_number ||
    `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

  // Calculate or normalize totals
  const subtotal = lineItemsData.reduce(
    (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 1),
    0
  );
  const discountTotal = lineItemsData.reduce(
    (sum, item) => sum + Number(item.discount_amount || 0),
    0
  );
  const taxTotal = lineItemsData.reduce(
    (sum, item) => sum + Number(item.tax_amount || 0),
    0
  );
  const grandTotal =
    data.totals?.grand_total !== undefined
      ? Number(data.totals.grand_total)
      : Math.max(0, subtotal - discountTotal + taxTotal);
  const amountPaid =
    data.totals?.amount_paid !== undefined
      ? Number(data.totals.amount_paid)
      : data.payment_status === "paid"
      ? grandTotal
      : 0;
  const amountDue =
    data.totals?.amount_due !== undefined
      ? Number(data.totals.amount_due)
      : Math.max(0, grandTotal - amountPaid);

  const redeemedPackages = [];

  const { invoice, createdLineItems, createdCommissions } = await withTransaction(
    async (session) => {
      // 1. Create Invoice document
      const [newInvoice] = await Invoice.create(
        [
          {
            invoice_number: invoiceNumber,
            customer_id: data.customer_id || null,
            customer_name: data.customer_name || "Walk-in Customer",
            customer_phone: data.customer_phone || null,
            branch_id: data.branch_id || null,
            billing_date: data.billing_date ? new Date(data.billing_date) : new Date(),
            totals: {
              subtotal,
              discount_total: discountTotal,
              tax_total: taxTotal,
              grand_total: grandTotal,
              amount_paid: amountPaid,
              amount_due: amountDue,
            },
            payment_mode: data.payment_mode || "cash",
            payment_status: data.payment_status || "paid",
            split_payments: Array.isArray(data.split_payments)
              ? data.split_payments
              : [],
            created_by: userId || data.created_by || null,
            notes: data.notes || null,
          },
        ],
        { session }
      );

      const items = [];
      const commissions = [];

      // 2. Process each line item atomically inside transaction
      for (const item of lineItemsData) {
        if (!item.staff_id) {
          throw new AppError(
            `Line item '${item.item_name || "Unknown"}' is missing required staff_id`,
            400
          );
        }

        const staff = await StaffProfile.findById(item.staff_id)
          .populate("commission_slab_id")
          .populate("user_id", "name phone email")
          .session(session);

        if (!staff) {
          throw new AppError(
            `Assigned staff member (ID: ${item.staff_id}) not found`,
            400
          );
        }

        const quantity = Number(item.quantity || 1);
        const itemTotal =
          item.total_amount !== undefined && item.total_amount !== null
            ? Number(item.total_amount)
            : Math.max(
                0,
                Number(item.unit_price || 0) * quantity -
                  Number(item.discount_amount || 0) +
                  Number(item.tax_amount || 0)
              );

        // 3. Stock Deduct for Product items — routed through stockService so every POS sale
        //    also writes an AuditLog entry (action: "stock_deduct", reason: "sale").
        if (item.item_type === "product" && item.item_id) {
          await deductStock(
            item.item_id,
            quantity,
            "sale",
            {
              override: false,           // billing controller pre-checks stock; this should never fail
              permissions: [],           // no override needed — pre-flight already blocked low stock
              userId: data.created_by || null,
              notes: `POS sale — Invoice ${invoiceNumber}, item: ${item.item_name || item.item_id}`,
              session,
            }
          );
        }

        // 4. Package Redemption linking & credit deduction
        if (item.package_redemption_id) {
          const customerPkg = await CustomerPackage.findOneAndUpdate(
            {
              _id: item.package_redemption_id,
              status: "active",
              credits_remaining: { $gte: quantity },
            },
            {
              $inc: { credits_remaining: -quantity },
            },
            { new: true, session }
          );

          if (!customerPkg) {
            throw new AppError(
              `Package redemption failed for '${item.item_name}'. Customer package not found, inactive, or has fewer than ${quantity} remaining credits.`,
              400
            );
          }

          if (customerPkg.credits_remaining === 0) {
            customerPkg.status = "exhausted";
            await customerPkg.save({ session });
          }

          redeemedPackages.push(customerPkg);
        }

        // Create InvoiceLineItem
        const [lineItemDoc] = await InvoiceLineItem.create(
          [
            {
              invoice_id: newInvoice._id,
              item_type: item.item_type || "service",
              item_id: item.item_id || null,
              item_name: item.item_name || "Service Item",
              quantity,
              unit_price: Number(item.unit_price || 0),
              discount_amount: Number(item.discount_amount || 0),
              tax_amount: Number(item.tax_amount || 0),
              tax_rate: Number(item.tax_rate || 0),
              total_amount: itemTotal,
              staff_id: staff._id,
              package_redemption_id: item.package_redemption_id || null,
              notes: item.notes || null,
            },
          ],
          { session }
        );

        items.push(lineItemDoc);

        // 5. Calculate and create CommissionEntry for staff
        const commDetails = calculateCommissionDetails(item, staff, itemTotal);
        if (
          commDetails.amount > 0 ||
          commDetails.status === "deferred_threshold" ||
          data.create_zero_commission_entries
        ) {
          const [commissionEntryDoc] = await CommissionEntry.create(
            [
              {
                staff_id: staff._id,
                invoice_line_item_id: lineItemDoc._id,
                commission_slab_id: commDetails.slab_id,
                slab_type: commDetails.slab_type,
                commission_amount: Number((commDetails.amount || 0).toFixed(2)),
                status: commDetails.status,
                calculated_at: newInvoice.billing_date,
                payroll_run_id: null,
                service_label: lineItemDoc.item_name,
                invoice_reference: newInvoice.invoice_number,
                line_amount: itemTotal,
                calculation_details_json: commDetails.details,
              },
            ],
            { session }
          );
          commissions.push(commissionEntryDoc);
        }
      }

      return {
        invoice: newInvoice,
        createdLineItems: items,
        createdCommissions: commissions,
      };
    }
  );

  // Trigger low-credit alerts asynchronously if any packages were redeemed
  for (const pkg of redeemedPackages) {
    try {
      await checkSinglePackageAfterRedeem(pkg);
    } catch (err) {
      console.error("[billingService] Error emitting package alert after redeem:", err.message);
    }
  }

  // Return fully structured safe object
  return invoice.toSafeObject(createdLineItems);
}

/**
 * Get single invoice with populated customer, branch, creator, and line items
 */
export async function getInvoiceById(id) {
  const invoice = await Invoice.findById(id)
    .populate("customer_id", "name phone email")
    .populate("branch_id", "name code")
    .populate("created_by", "name email");

  if (!invoice) {
    throw new AppError("Invoice not found", 404);
  }

  const lineItems = await InvoiceLineItem.find({ invoice_id: invoice._id })
    .populate({ path: "staff_id", populate: { path: "user_id", select: "name phone email" } })
    .populate("package_redemption_id");

  return invoice.toSafeObject(lineItems);
}

/**
 * List invoices with filtering & pagination
 */
export async function getInvoices(filters = {}, pagination = {}) {
  const query = {};

  if (filters.customer_id) query.customer_id = filters.customer_id;
  if (filters.branch_id) query.branch_id = filters.branch_id;
  if (filters.payment_status) query.payment_status = filters.payment_status;
  if (filters.payment_mode) query.payment_mode = filters.payment_mode;

  if (filters.startDate || filters.endDate) {
    query.billing_date = {};
    if (filters.startDate) query.billing_date.$gte = new Date(filters.startDate);
    if (filters.endDate) query.billing_date.$lte = new Date(filters.endDate);
  }

  if (filters.search) {
    query.$or = [
      { invoice_number: { $regex: filters.search, $options: "i" } },
      { customer_name: { $regex: filters.search, $options: "i" } },
      { customer_phone: { $regex: filters.search, $options: "i" } },
    ];
  }

  const page = Math.max(1, Number(pagination.page || 1));
  const limit = Math.min(100, Math.max(1, Number(pagination.limit || 20)));
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    Invoice.find(query)
      .sort({ billing_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customer_id", "name phone")
      .populate("branch_id", "name code"),
    Invoice.countDocuments(query),
  ]);

  return {
    invoices: docs.map((doc) => doc.toSafeObject()),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Atomically Void / Cancel an invoice:
 * - Restores product stock
 * - Restores package credits & resets exhausted status to active
 * - Deletes associated commission entries
 * - Sets invoice status to void
 */
export async function voidInvoice(id, { reason = "", userId = null } = {}) {
  return await withTransaction(async (session) => {
    const invoice = await Invoice.findById(id).session(session);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    if (invoice.payment_status === "void") {
      throw new AppError("Invoice is already voided", 400);
    }

    const lineItems = await InvoiceLineItem.find({ invoice_id: invoice._id }).session(
      session
    );

    for (const item of lineItems) {
      // 1. Restore Product Stock — routed through stockService so void also writes AuditLog
      if (item.item_type === "product" && item.item_id) {
        await addStock(
          item.item_id,
          item.quantity,
          "audit_correction",
          {
            userId,
            notes: `Invoice void — Invoice ${invoice.invoice_number}, item: ${item.item_name}`,
            session,
          }
        );
      }

      // 2. Restore Package Credits
      if (item.package_redemption_id) {
        const pkg = await CustomerPackage.findById(item.package_redemption_id).session(
          session
        );
        if (pkg) {
          pkg.credits_remaining += item.quantity;
          if (pkg.status === "exhausted" && pkg.credits_remaining > 0) {
            pkg.status = "active";
          }
          await pkg.save({ session });
        }
      }
    }

    // 3. Delete Commission Entries created by this invoice
    await CommissionEntry.deleteMany({
      invoice_line_item_id: { $in: lineItems.map((l) => l._id) },
    }).session(session);

    // 4. Update invoice status
    invoice.payment_status = "void";
    if (reason) {
      invoice.notes = invoice.notes
        ? `${invoice.notes}\n[VOIDED: ${reason}]`
        : `[VOIDED: ${reason}]`;
    }
    await invoice.save({ session });

    return invoice.toSafeObject(lineItems);
  });
}
