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

const UserMenuOverride = mongoose.model("UserMenuOverride", userMenuOverrideSchema);

export default UserMenuOverride;
