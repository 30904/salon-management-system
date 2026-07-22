import mongoose from "mongoose";

export const WHATSAPP_CAMPAIGN_TYPES = ["offer", "sale", "announcement", "custom"];
export const WHATSAPP_AUDIENCE_TYPES = ["all", "selected"];
export const WHATSAPP_CAMPAIGN_STATUSES = ["queued", "sent", "failed"];

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
      enum: WHATSAPP_CAMPAIGN_STATUSES,
      default: "queued",
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
    recipients: {
      type: [recipientSchema],
      default: [],
    },
    status: {
      type: String,
      enum: WHATSAPP_CAMPAIGN_STATUSES,
      default: "queued",
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

whatsAppCampaignSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    title: this.title,
    campaign_type: this.campaign_type,
    message_body: this.message_body,
    audience: this.audience,
    recipient_count: this.recipient_count,
    recipients: (this.recipients || []).map((row) => ({
      customer_id: row.customer_id,
      name: row.name,
      phone: row.phone,
      status: row.status,
    })),
    status: this.status,
    template_id: this.template_id,
    sent_by: this.sent_by,
    notes: this.notes,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const WhatsAppCampaign = mongoose.model("WhatsAppCampaign", whatsAppCampaignSchema);

export default WhatsAppCampaign;
