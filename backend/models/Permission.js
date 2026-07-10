import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: ["view", "create", "edit", "delete", "approve"],
    },
  },
  { timestamps: true }
);

permissionSchema.index({ module: 1, action: 1 }, { unique: true });

const Permission = mongoose.model("Permission", permissionSchema);

export default Permission;
