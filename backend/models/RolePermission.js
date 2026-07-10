import mongoose from "mongoose";

const rolePermissionSchema = new mongoose.Schema(
  {
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    permission_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: true,
    },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ role_id: 1, permission_id: 1 }, { unique: true });
rolePermissionSchema.index({ role_id: 1 });
rolePermissionSchema.index({ permission_id: 1 });

rolePermissionSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    role_id: this.role_id,
    permission_id: this.permission_id,
    created_at: this.createdAt,
  };
};

const RolePermission = mongoose.model("RolePermission", rolePermissionSchema);

export default RolePermission;
