import mongoose from "mongoose";

export const CUSTOMER_GENDERS = [
  "male",
  "female",
  "other",
  "prefer_not_to_say",
];

export const CUSTOMER_TAG_TYPES = ["manual", "system"];

const customerTagSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    type: {
      type: String,
      enum: CUSTOMER_TAG_TYPES,
      default: "manual",
    },
  },
  { _id: true }
);

const customerSchema = new mongoose.Schema(
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
      maxlength: 20,
    },
    dob: {
      type: Date,
      default: null,
    },
    anniversary_date: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: CUSTOMER_GENDERS,
      default: null,
    },
    tags: {
      type: [customerTagSchema],
      default: [],
    },
    preferred_stylist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 }, { unique: true });
customerSchema.index({ name: 1 });
customerSchema.index({ "tags.label": 1 });

export const CUSTOMER_POPULATE = {
  preferred_stylist: {
    path: "preferred_stylist_id",
    select: "designation is_active user_id",
    populate: { path: "user_id", select: "name phone" },
  },
};

function refToSafeObject(ref) {
  if (!ref) return null;

  if (typeof ref === "object" && ref._id) {
    const user = ref.user_id;
    return {
      id: ref._id,
      designation: ref.designation,
      is_active: ref.is_active,
      user:
        user && typeof user === "object" && user._id
          ? {
              id: user._id,
              name: user.name,
              phone: user.phone,
            }
          : null,
    };
  }

  return ref;
}

customerSchema.statics.populateForList = function populateForList(query) {
  return query.populate(CUSTOMER_POPULATE.preferred_stylist);
};

customerSchema.methods.toSafeObject = function toSafeObject() {
  const stylist =
    this.preferred_stylist_id && typeof this.preferred_stylist_id === "object"
      ? refToSafeObject(this.preferred_stylist_id)
      : null;

  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    dob: this.dob,
    anniversary_date: this.anniversary_date,
    gender: this.gender,
    tags: (this.tags || []).map((tag) => ({
      id: tag._id,
      label: tag.label,
      type: tag.type,
    })),
    preferred_stylist_id: stylist?.id || this.preferred_stylist_id,
    preferred_stylist: stylist,
    notes: this.notes,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
