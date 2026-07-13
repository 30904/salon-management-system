import mongoose from "mongoose";

export const CUSTOMER_PACKAGE_STATUSES = ["active", "expired", "exhausted", "cancelled"];

const customerPackageSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    package_master_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PackageMaster",
      required: true,
    },
    purchase_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiry_date: {
      type: Date,
      required: true,
    },
    credits_remaining: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: CUSTOMER_PACKAGE_STATUSES,
      default: "active",
      required: true,
    },
    invoice_id: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for common customer package queries and expiry jobs
customerPackageSchema.index({ customer_id: 1, status: 1 });
customerPackageSchema.index({ package_master_id: 1 });
customerPackageSchema.index({ expiry_date: 1, status: 1 });
customerPackageSchema.index({ invoice_id: 1 });

customerPackageSchema.methods.toSafeObject = function toSafeObject() {
  const customer = this.customer_id;
  const packageMaster = this.package_master_id;

  return {
    id: this._id,
    customer_id: customer?._id || this.customer_id,
    package_master_id: packageMaster?._id || this.package_master_id,
    purchase_date: this.purchase_date,
    expiry_date: this.expiry_date,
    credits_remaining: this.credits_remaining,
    status: this.status,
    invoice_id: this.invoice_id,
    customer:
      customer && typeof customer === "object" && customer._id
        ? {
            id: customer._id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
          }
        : null,
    package_master:
      packageMaster && typeof packageMaster === "object" && packageMaster._id
        ? {
            id: packageMaster._id,
            name: packageMaster.name,
            type: packageMaster.type,
            validity_days: packageMaster.validity_days,
            price: packageMaster.price,
            included_services: packageMaster.included_services,
            credit_count: packageMaster.credit_count,
          }
        : null,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const CustomerPackage = mongoose.model("CustomerPackage", customerPackageSchema);

export default CustomerPackage;
