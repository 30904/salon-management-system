import mongoose from "mongoose";

export const WHATSAPP_CAMPAIGN_TYPES = ["offer", "sale", "announcement", "custom"];
export const WHATSAPP_AUDIENCE_TYPES = ["all", "selected"];
export const WHATSAPP_CAMPAIGN_STATUSES = [
  "queued",
  "sending",
  "sent",
  "partial",
  "failed",
];
export const WHATSAPP_RECIPIENT_STATUSES = ["queued", "sent", "failed"];

const recipientSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      required: true,
    },
    status: {
      type: String,
      enum: WHATSAPP_RECIPIENT_STATUSES,
      default: "queued",
    },
    meta_message_id: {
      type: String,
      trim: true,
      default: null,
    },
    error: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    sent_at: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const whatsAppCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    campaign_type: {
      type: String,
      enum: WHATSAPP_CAMPAIGN_TYPES,
      default: "offer",
    },
    message_body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    audience: {
      type: String,
      enum: WHATSAPP_AUDIENCE_TYPES,
      default: "all",
    },
    recipient_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    sent_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    failed_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    recipients: {
      type: [recipientSchema],
      default: [],
    },
    status: {
      type: String,
      enum: WHATSAPP_CAMPAIGN_STATUSES,
      default: "queued",
    },
    delivery_mode: {
      type: String,
      enum: ["cloud_api", "queued_stub"],
      default: "cloud_api",
    },
    meta_media_id: {
      type: String,
      trim: true,
      default: null,
    },
    meta_template_name: {
      type: String,
      trim: true,
      default: null,
    },
    template_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppTemplate",
      default: null,
    },
    sent_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true }
);

whatsAppCampaignSchema.index({ createdAt: -1 });
whatsAppCampaignSchema.index({ status: 1, campaign_type: 1 });
whatsAppCampaignSchema.index({ "recipients.status": 1, updatedAt: -1 });

whatsAppCampaignSchema.methods.toSafeObject = function toSafeObject() {
  const queued = (this.recipients || []).filter((r) => r.status === "queued").length;
  const sent = Number(this.sent_count || 0);
  const failed = Number(this.failed_count || 0);

  return {
    id: this._id,
    title: this.title,
    campaign_type: this.campaign_type,
    message_body: this.message_body,
    audience: this.audience,
    recipient_count: this.recipient_count,
    sent_count: sent,
    failed_count: failed,
    queued_count: queued,
    recipients: (this.recipients || []).map((row) => ({
      customer_id: row.customer_id,
      name: row.name,
      phone: row.phone,
      status: row.status,
      meta_message_id: row.meta_message_id || null,
      error: row.error || null,
      sent_at: row.sent_at || null,
    })),
    status: this.status,
    delivery_mode: this.delivery_mode || "cloud_api",
    meta_media_id: this.meta_media_id || null,
    meta_template_name: this.meta_template_name || null,
    template_id: this.template_id,
    sent_by: this.sent_by,
    notes: this.notes,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const WhatsAppCampaign = mongoose.model("WhatsAppCampaign", whatsAppCampaignSchema);

export default WhatsAppCampaign;
