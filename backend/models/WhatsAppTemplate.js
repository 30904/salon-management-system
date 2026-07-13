import mongoose from "mongoose";

const whatsAppTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    trigger_type: {
      type: String,
      required: true,
      trim: true,
    },
    message_body: {
      type: String,
      required: true,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

whatsAppTemplateSchema.index({ trigger_type: 1 });
whatsAppTemplateSchema.index({ is_active: 1 });

whatsAppTemplateSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    trigger_type: this.trigger_type,
    message_body: this.message_body,
    is_active: this.is_active,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
  };
};

const WhatsAppTemplate = mongoose.model("WhatsAppTemplate", whatsAppTemplateSchema);

export default WhatsAppTemplate;
