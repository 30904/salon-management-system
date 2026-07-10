import mongoose from "mongoose";

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
];

export const PERMISSION_MODULES = [
  "dashboard",
  "bookings",
  "billing",
  "crm",
  "inventory",
  "attendance",
  "payroll",
  "employees",
  "reports",
  "settings",
  "users",
  "audit_logs",
];

const permissionSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: PERMISSION_MODULES,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: PERMISSION_ACTIONS,
    },
  },
  { timestamps: true }
);

permissionSchema.index({ module: 1, action: 1 }, { unique: true });

permissionSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    module: this.module,
    action: this.action,
    created_at: this.createdAt,
  };
};

permissionSchema.statics.permissionKey = function permissionKey(module, action) {
  return `${module}:${action}`;
};

const Permission = mongoose.model("Permission", permissionSchema);

export default Permission;
