import mongoose from "mongoose";

export const BOOKING_STATUSES = [
  "booked",
  "confirmed",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
];

export const BOOKING_SOURCES = ["internal", "online"];

export const BOOKING_POPULATE = {
  customer: { path: "customer_id", select: "name phone" },
  branch: { path: "branch_id", select: "name is_active" },
  stylist: {
    path: "stylist_id",
    select: "user_id designation specialization",
    populate: { path: "user_id", select: "name phone" },
  },
  services: { path: "service_ids", select: "name duration_minutes price is_active" },
  creator: { path: "created_by", select: "name phone" },
};

function refToSafeObject(ref) {
  if (!ref) return null;

  if (typeof ref === "object" && ref._id) {
    return {
      id: ref._id,
      ...(ref.name !== undefined && { name: ref.name }),
      ...(ref.phone !== undefined && { phone: ref.phone }),
      ...(ref.designation !== undefined && { designation: ref.designation }),
      ...(ref.specialization !== undefined && {
        specialization: ref.specialization,
      }),
      ...(ref.duration_minutes !== undefined && {
        duration_minutes: ref.duration_minutes,
      }),
      ...(ref.price !== undefined && { price: ref.price }),
      ...(ref.is_active !== undefined && { is_active: ref.is_active }),
      ...(ref.user_id !== undefined && {
        user: refToSafeObject(ref.user_id),
      }),
    };
  }

  return ref;
}

function startOfBookingDate(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

const bookingSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    branch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    stylist_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffProfile",
      required: true,
    },
    service_ids: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ServiceMaster",
        },
      ],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one service is required",
      },
    },
    booking_date: {
      type: Date,
      required: true,
    },
    start_time: {
      type: Date,
      required: true,
    },
    end_time: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "booked",
    },
    source: {
      type: String,
      enum: BOOKING_SOURCES,
      default: "internal",
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ stylist_id: 1, start_time: 1 });
bookingSchema.index({ branch_id: 1, start_time: 1 });
bookingSchema.index({ booking_date: 1, stylist_id: 1 });
bookingSchema.index({ customer_id: 1, booking_date: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ start_time: 1, status: 1 });

bookingSchema.pre("validate", function syncBookingDate(next) {
  if (this.start_time) {
    this.booking_date = startOfBookingDate(this.start_time);
  }

  if (this.start_time && this.end_time && this.end_time <= this.start_time) {
    this.invalidate("end_time", "end_time must be after start_time");
  }

  next();
});

bookingSchema.statics.populateForList = function populateForList(query) {
  return query.populate([
    BOOKING_POPULATE.customer,
    BOOKING_POPULATE.stylist,
    BOOKING_POPULATE.services,
  ]);
};

bookingSchema.statics.populateForDetail = function populateForDetail(query) {
  return query.populate([
    BOOKING_POPULATE.customer,
    BOOKING_POPULATE.branch,
    BOOKING_POPULATE.stylist,
    BOOKING_POPULATE.services,
    BOOKING_POPULATE.creator,
  ]);
};

bookingSchema.methods.toSafeObject = function toSafeObject() {
  const customer =
    this.customer_id && typeof this.customer_id === "object"
      ? refToSafeObject(this.customer_id)
      : null;
  const branch =
    this.branch_id && typeof this.branch_id === "object"
      ? refToSafeObject(this.branch_id)
      : null;
  const stylist =
    this.stylist_id && typeof this.stylist_id === "object"
      ? refToSafeObject(this.stylist_id)
      : null;
  const services = Array.isArray(this.service_ids)
    ? this.service_ids
        .filter((service) => service && typeof service === "object")
        .map((service) => refToSafeObject(service))
    : [];
  const creator =
    this.created_by && typeof this.created_by === "object"
      ? refToSafeObject(this.created_by)
      : null;

  const serviceLabels = services.map((service) => service.name).filter(Boolean);

  return {
    id: this._id,
    customer_id: customer?.id || this.customer_id,
    customer,
    customer_name: customer?.name || null,
    customer_phone: customer?.phone || null,
    branch_id: branch?.id || this.branch_id,
    branch,
    stylist_id: stylist?.id || this.stylist_id,
    stylist,
    staff_id: stylist?.id || this.stylist_id,
    staff_name: stylist?.user?.name || null,
    service_ids: services.length
      ? services.map((service) => service.id)
      : this.service_ids,
    services,
    service_label: serviceLabels.join(", ") || null,
    booking_date: this.booking_date,
    start_time: this.start_time,
    end_time: this.end_time,
    status: this.status,
    source: this.source,
    created_by: creator?.id || this.created_by,
    creator,
    notes: this.notes,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
