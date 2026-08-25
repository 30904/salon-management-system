import mongoose from "mongoose";

export const CUSTOMER_IMPORT_BATCH_STATUSES = [
  "processing",
  "completed",
  "failed",
];

const customerImportBatchSchema = new mongoose.Schema(
  {
    file_name: {
      type: String,
      required: true,
      trim: true,
    },
    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    total_rows: {
      type: Number,
      required: true,
      min: 0,
    },
    created_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    merged_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    skipped_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** [{ row, reason }] */
    error_rows: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    status: {
      type: String,
      enum: CUSTOMER_IMPORT_BATCH_STATUSES,
      default: "processing",
    },
  },
  { timestamps: true }
);

customerImportBatchSchema.index({ status: 1, createdAt: -1 });
customerImportBatchSchema.index({ uploaded_by: 1 });

customerImportBatchSchema.methods.toSafeObject = function toSafeObject() {
  const uploader = this.uploaded_by;

  return {
    id: this._id,
    file_name: this.file_name,
    uploaded_by:
      uploader && typeof uploader === "object" && uploader._id
        ? uploader._id
        : this.uploaded_by,
    total_rows: this.total_rows,
    created_count: this.created_count,
    merged_count: this.merged_count,
    skipped_count: this.skipped_count,
    error_rows: this.error_rows || [],
    status: this.status,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const CustomerImportBatch = mongoose.model(
  "CustomerImportBatch",
  customerImportBatchSchema
);

export default CustomerImportBatch;
