import mongoose from "mongoose";

export const USER_POPULATE = {
  role: { path: "role_id", select: "name description" },
  branch: { path: "branch_id", select: "code name address phone is_active" },
  creator: { path: "created_by", select: "name phone" },
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    password_hash: {
      type: String,
      required: true,
      select: false,
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// Multi-branch ready: phone unique per branch.
userSchema.index({ branch_id: 1, phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ role_id: 1, is_active: 1 });
userSchema.index({ is_active: 1 });

function refToSafeObject(ref) {
  if (!ref) return null;
  if (typeof ref === "object" && ref._id) {
    return {
      id: ref._id,
      ...(ref.name !== undefined && { name: ref.name }),
      ...(ref.description !== undefined && { description: ref.description }),
      ...(ref.code !== undefined && { code: ref.code }),
      ...(ref.phone !== undefined && { phone: ref.phone }),
      ...(ref.address !== undefined && { address: ref.address }),
      ...(ref.is_active !== undefined && { is_active: ref.is_active }),
    };
  }
  return ref;
}

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    email: this.email,
    role_id: this.role_id?._id || this.role_id,
    branch_id: this.branch_id?._id || this.branch_id,
    is_active: this.is_active,
    created_by: this.created_by?._id || this.created_by,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
    role: refToSafeObject(this.role_id),
    branch: refToSafeObject(this.branch_id),
    creator: refToSafeObject(this.created_by),
  };
};

userSchema.statics.populateForAuth = function populateForAuth(query) {
  return query
    .populate(USER_POPULATE.role.path, USER_POPULATE.role.select)
    .populate(USER_POPULATE.branch.path, USER_POPULATE.branch.select);
};

userSchema.statics.populateForList = function populateForList(query) {
  return query
    .populate(USER_POPULATE.role.path, USER_POPULATE.role.select)
    .populate(USER_POPULATE.branch.path, USER_POPULATE.branch.select)
    .populate(USER_POPULATE.creator.path, USER_POPULATE.creator.select);
};

userSchema.statics.findByLogin = function findByLogin({ phone, email }) {
  if (phone) {
    return this.findOne({ phone: phone.trim() });
  }

  if (email) {
    return this.findOne({ email: email.trim().toLowerCase() });
  }

  return null;
};

const User = mongoose.model("User", userSchema);

export default User;
