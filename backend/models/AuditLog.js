import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
    },
    entity_id: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    details_json: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entity_id: 1, createdAt: -1 });
auditLogSchema.index({ user_id: 1, createdAt: -1 });

auditLogSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    user_id: this.user_id,
    action: this.action,
    entity: this.entity,
    entity_id: this.entity_id,
    details_json: this.details_json,
    timestamp: this.createdAt,
  };
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
