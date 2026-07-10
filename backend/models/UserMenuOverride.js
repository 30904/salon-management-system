import mongoose from "mongoose";

const userMenuOverrideSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    permission_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: true,
    },
    granted: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true }
);

userMenuOverrideSchema.index({ user_id: 1, permission_id: 1 }, { unique: true });
userMenuOverrideSchema.index({ user_id: 1 });
userMenuOverrideSchema.index({ permission_id: 1 });

userMenuOverrideSchema.methods.toSafeObject = function toSafeObject() {
  const permission = this.permission_id;

  return {
    id: this._id,
    user_id: this.user_id,
    permission_id: permission?._id || this.permission_id,
    granted: this.granted,
    permission:
      permission && typeof permission === "object" && permission.module
        ? {
            id: permission._id,
            module: permission.module,
            action: permission.action,
          }
        : null,
    created_at: this.createdAt,
  };
};

const UserMenuOverride = mongoose.model(
  "UserMenuOverride",
  userMenuOverrideSchema
);

export default UserMenuOverride;
