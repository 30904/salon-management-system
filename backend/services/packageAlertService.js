import { EventEmitter } from "events";
import CustomerPackage from "../models/CustomerPackage.js";
import WhatsAppTemplate from "../models/WhatsAppTemplate.js";

class PackageAlertEmitter extends EventEmitter {}
export const packageAlertEmitter = new PackageAlertEmitter();

// Memory queue / history buffer of emitted alerts for the WhatsApp scheduler
const alertHistoryQueue = [];

/**
 * Built-in listener for WhatsApp Scheduler
 * Listens to emitted package alert events, matches against WhatsAppTemplate if available, and queues message.
 */
packageAlertEmitter.on("package.expiring_soon", async (payload) => {
  await queueWhatsAppAlert(payload, "package_expiring_soon");
});

packageAlertEmitter.on("package.low_credits", async (payload) => {
  await queueWhatsAppAlert(payload, "package_low_credits");
});

async function queueWhatsAppAlert(payload, triggerType) {
  try {
    let messageText = "";
    const template = await WhatsAppTemplate.findOne({ trigger_type: triggerType, is_active: true });
    if (template) {
      messageText = template.message_body
        .replace(/\{\{customer_name\}\}/g, payload.customer?.name || "Customer")
        .replace(/\{\{package_name\}\}/g, payload.package_name || "Package")
        .replace(/\{\{credits_remaining\}\}/g, payload.credits_remaining ?? "")
        .replace(/\{\{days_remaining\}\}/g, payload.days_remaining ?? "")
        .replace(/\{\{expiry_date\}\}/g, payload.expiry_date ? new Date(payload.expiry_date).toLocaleDateString() : "");
    } else if (triggerType === "package_expiring_soon") {
      messageText = `Hi ${payload.customer?.name || "Customer"}, your package "${payload.package_name}" is expiring in ${payload.days_remaining} days on ${new Date(payload.expiry_date).toLocaleDateString()}. Please renew soon!`;
    } else if (triggerType === "package_low_credits") {
      messageText = `Hi ${payload.customer?.name || "Customer"}, your package "${payload.package_name}" has only ${payload.credits_remaining} credit(s) remaining. Top up to enjoy uninterrupted services!`;
    }

    const alertRecord = {
      event: payload.event,
      trigger_type: triggerType,
      customer_id: payload.customer?._id || payload.customer,
      customer_name: payload.customer?.name || "Unknown",
      customer_phone: payload.customer?.phone || null,
      customer_package_id: payload.customerPackageId,
      package_name: payload.package_name,
      credits_remaining: payload.credits_remaining,
      days_remaining: payload.days_remaining,
      message_text: messageText,
      status: "queued_for_whatsapp_scheduler",
      emitted_at: new Date(),
    };

    alertHistoryQueue.unshift(alertRecord);
    if (alertHistoryQueue.length > 500) alertHistoryQueue.pop();
  } catch (err) {
    console.error("[PackageAlertService] Error queuing WhatsApp alert:", err.message);
  }
}

export function getAlertHistory() {
  return alertHistoryQueue;
}

export function clearAlertHistory() {
  alertHistoryQueue.length = 0;
}

/**
 * Scan all active customer packages and emit events when credits low or expiry within N days.
 * @param {Object} options
 * @param {number} options.expiryDaysThreshold - default 7 days
 * @param {number} options.lowCreditThreshold - default 2 credits
 */
export async function checkAndEmitPackageAlerts({ expiryDaysThreshold = 7, lowCreditThreshold = 2 } = {}) {
  const now = new Date();
  const activePackages = await CustomerPackage.find({ status: "active" })
    .populate("customer_id", "name phone email")
    .populate("package_master_id", "name type validity_days price credit_count");

  const expiringSoonAlerts = [];
  const lowCreditAlerts = [];

  for (const doc of activePackages) {
    if (doc.expiry_date < now) {
      doc.status = "expired";
      await doc.save();
      continue;
    }
    if (doc.credits_remaining <= 0) {
      doc.status = "exhausted";
      await doc.save();
      continue;
    }

    const daysUntilExpiry = Math.ceil((doc.expiry_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const customer = doc.customer_id;
    const packageName = doc.package_master_id?.name || "Package";

    // 1. Expiry within N days check
    if (daysUntilExpiry <= expiryDaysThreshold && daysUntilExpiry > 0) {
      const payload = {
        event: "package.expiring_soon",
        trigger_type: "package_expiring_soon",
        customerPackageId: doc._id,
        customer,
        package_name: packageName,
        expiry_date: doc.expiry_date,
        days_remaining: daysUntilExpiry,
        credits_remaining: doc.credits_remaining,
        timestamp: new Date(),
      };
      packageAlertEmitter.emit("package.expiring_soon", payload);
      packageAlertEmitter.emit("package_expiring_soon", payload);
      expiringSoonAlerts.push(payload);
    }

    // 2. Low credits check
    if (doc.credits_remaining <= lowCreditThreshold && doc.credits_remaining > 0) {
      const payload = {
        event: "package.low_credits",
        trigger_type: "package_low_credits",
        customerPackageId: doc._id,
        customer,
        package_name: packageName,
        expiry_date: doc.expiry_date,
        credits_remaining: doc.credits_remaining,
        low_credit_threshold: lowCreditThreshold,
        timestamp: new Date(),
      };
      packageAlertEmitter.emit("package.low_credits", payload);
      packageAlertEmitter.emit("package_low_credits", payload);
      lowCreditAlerts.push(payload);
    }
  }

  return {
    expiringSoonAlerts,
    lowCreditAlerts,
    totalEmitted: expiringSoonAlerts.length + lowCreditAlerts.length,
  };
}

/**
 * Check and emit alerts for a single package (e.g. immediately after a redemption)
 */
export async function checkSinglePackageAfterRedeem(doc, { lowCreditThreshold = 2 } = {}) {
  if (!doc || doc.status !== "active" || doc.credits_remaining <= 0) return null;

  await doc.populate("customer_id", "name phone email");
  await doc.populate("package_master_id", "name type validity_days price credit_count");

  const customer = doc.customer_id;
  const packageName = doc.package_master_id?.name || "Package";

  if (doc.credits_remaining <= lowCreditThreshold) {
    const payload = {
      event: "package.low_credits",
      trigger_type: "package_low_credits",
      customerPackageId: doc._id,
      customer,
      package_name: packageName,
      expiry_date: doc.expiry_date,
      credits_remaining: doc.credits_remaining,
      low_credit_threshold: lowCreditThreshold,
      timestamp: new Date(),
    };
    packageAlertEmitter.emit("package.low_credits", payload);
    packageAlertEmitter.emit("package_low_credits", payload);
    return payload;
  }
  return null;
}
