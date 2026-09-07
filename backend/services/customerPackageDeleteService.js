import mongoose from "mongoose";
import CustomerPackage from "../models/CustomerPackage.js";
import Invoice from "../models/Invoice.js";
import InvoiceLineItem from "../models/InvoiceLineItem.js";
import CommissionEntry from "../models/CommissionEntry.js";
import { AppError } from "../utils/AppError.js";
import { withTransaction } from "../utils/withTransaction.js";
import { clearDashboardCache } from "../utils/requestCache.js";

function round2(n) {
  return Number(Number(n || 0).toFixed(2));
}

async function resolveSaleInvoice(customerPackage, session) {
  const raw = customerPackage.invoice_id;
  if (!raw) return null;

  const asString = String(raw).trim();
  if (!asString) return null;

  if (mongoose.isValidObjectId(asString)) {
    const byId = await Invoice.findById(asString).session(session);
    if (byId) return byId;
  }

  return Invoice.findOne({ invoice_number: asString }).session(session);
}

function recalculateInvoiceTotals(invoice, keepLines) {
  const subtotal = round2(
    keepLines.reduce(
      (sum, li) => sum + Number(li.unit_price || 0) * Number(li.quantity || 1),
      0
    )
  );
  const discountTotal = round2(
    keepLines.reduce((sum, li) => sum + Number(li.discount_amount || 0), 0)
  );
  const taxTotal = round2(
    keepLines.reduce((sum, li) => sum + Number(li.tax_amount || 0), 0)
  );
  const grandTotal = round2(Math.max(0, subtotal - discountTotal + taxTotal));

  invoice.totals.subtotal = subtotal;
  invoice.totals.discount_total = discountTotal;
  invoice.totals.tax_total = taxTotal;
  invoice.totals.grand_total = grandTotal;
  invoice.totals.amount_paid =
    invoice.payment_status === "paid" ? grandTotal : Number(invoice.totals.amount_paid || 0);
  invoice.totals.amount_due = Math.max(
    0,
    round2(grandTotal - Number(invoice.totals.amount_paid || 0))
  );

  if (Array.isArray(invoice.split_payments) && invoice.split_payments.length === 1) {
    invoice.split_payments[0].amount = grandTotal;
  }
}

/**
 * Delete a mistaken customer package sale and reverse related billing so
 * dashboard invoice-based sales KPIs update.
 */
export async function deleteCustomerPackageSale(customerPackageId, { reason = "" } = {}) {
  if (!mongoose.isValidObjectId(String(customerPackageId))) {
    throw new AppError("Invalid customer package id", 400);
  }

  const result = await withTransaction(async (session) => {
    const customerPackage = await CustomerPackage.findById(customerPackageId)
      .populate("customer_id", "name phone")
      .populate("package_master_id", "name type price wallet_value")
      .session(session);

    if (!customerPackage) {
      throw new AppError("Customer package not found", 404);
    }

    const redemptionLines = await InvoiceLineItem.find({
      package_redemption_id: customerPackage._id,
    })
      .select("_id invoice_id")
      .session(session);

    if (redemptionLines.length > 0) {
      const invoiceIds = [
        ...new Set(
          redemptionLines
            .map((li) => li.invoice_id)
            .filter(Boolean)
            .map((id) => String(id))
        ),
      ];

      const activeRedemptionInvoices = await Invoice.find({
        _id: { $in: invoiceIds },
        payment_status: { $ne: "void" },
      })
        .select("_id invoice_number")
        .session(session);

      if (activeRedemptionInvoices.length > 0) {
        throw new AppError(
          "This package was already used on one or more invoices. Void or reverse those redemptions before deleting the package sale.",
          400
        );
      }
    }

    const invoice = await resolveSaleInvoice(customerPackage, session);
    let billingCleanup = {
      invoice_id: null,
      invoice_number: null,
      removed_line_count: 0,
      invoice_deleted: false,
      invoice_recalculated: false,
      previous_grand_total: null,
      new_grand_total: null,
    };

    if (invoice) {
      if (invoice.payment_status === "void") {
        // Package sale invoice already void — only remove the package record
        billingCleanup.invoice_id = String(invoice._id);
        billingCleanup.invoice_number = invoice.invoice_number;
        billingCleanup.previous_grand_total = Number(invoice.totals?.grand_total || 0);
      } else {
        const allLines = await InvoiceLineItem.find({ invoice_id: invoice._id }).session(
          session
        );

        const packageMasterId = String(
          customerPackage.package_master_id?._id || customerPackage.package_master_id || ""
        );

        const saleLines = allLines.filter((li) => {
          if (li.item_type !== "package") return false;
          if (packageMasterId && li.item_id && String(li.item_id) === packageMasterId) {
            return true;
          }
          // Fallback: single package line on this invoice
          return allLines.filter((x) => x.item_type === "package").length === 1;
        });

        // If we still can't isolate, and invoice is only packages matching name
        const linesToRemove =
          saleLines.length > 0
            ? saleLines
            : allLines.filter((li) => li.item_type === "package");

        const keepLines = allLines.filter(
          (li) => !linesToRemove.some((rm) => String(rm._id) === String(li._id))
        );

        billingCleanup.invoice_id = String(invoice._id);
        billingCleanup.invoice_number = invoice.invoice_number;
        billingCleanup.previous_grand_total = Number(invoice.totals?.grand_total || 0);
        billingCleanup.removed_line_count = linesToRemove.length;

        if (linesToRemove.length > 0) {
          await CommissionEntry.deleteMany({
            invoice_line_item_id: { $in: linesToRemove.map((li) => li._id) },
          }).session(session);
          await InvoiceLineItem.deleteMany({
            _id: { $in: linesToRemove.map((li) => li._id) },
          }).session(session);
        }

        if (keepLines.length === 0) {
          await CommissionEntry.deleteMany({
            $or: [
              { invoice_line_item_id: { $in: allLines.map((li) => li._id) } },
              { invoice_reference: invoice.invoice_number },
            ],
          }).session(session);
          await Invoice.deleteOne({ _id: invoice._id }).session(session);
          billingCleanup.invoice_deleted = true;
          billingCleanup.new_grand_total = 0;
        } else {
          recalculateInvoiceTotals(invoice, keepLines);
          if (reason) {
            invoice.notes = invoice.notes
              ? `${invoice.notes}\n[PACKAGE SALE REMOVED: ${reason}]`
              : `[PACKAGE SALE REMOVED: ${reason}]`;
          }
          await invoice.save({ session });
          billingCleanup.invoice_recalculated = true;
          billingCleanup.new_grand_total = Number(invoice.totals.grand_total || 0);
        }
      }
    }

    const snapshot = {
      id: String(customerPackage._id),
      customer_name: customerPackage.customer_id?.name || null,
      customer_phone: customerPackage.customer_id?.phone || null,
      package_name: customerPackage.package_master_id?.name || null,
      status: customerPackage.status,
      invoice_id: customerPackage.invoice_id,
    };

    await CustomerPackage.deleteOne({ _id: customerPackage._id }).session(session);

    return { package: snapshot, billing: billingCleanup };
  });

  clearDashboardCache();
  return result;
}
