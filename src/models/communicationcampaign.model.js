import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const communicationCampaignSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    campaignId: { type: String, required: true, default: uuid, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    templateId: { type: String, required: true, trim: true, index: true },
    templateName: { type: String, trim: true, default: null },
    category: { type: String, trim: true, default: 'GENERAL', index: true },
    channel: { type: String, enum: ['email'], default: 'email', index: true },
    subject: { type: String, trim: false, default: null },
    body: { type: String, trim: false, default: null },
    recipientFilters: { type: Object, default: {} },
    sendType: { type: String, enum: ['NOW', 'SCHEDULED'], default: 'NOW', index: true },
    scheduledAt: { type: Number, default: null, index: true },
    startedAt: { type: Number, default: null },
    completedAt: { type: Number, default: null },
    totalRecipients: { type: Number, default: 0 },
    validEmailCount: { type: Number, default: 0 },
    missingEmailCount: { type: Number, default: 0 },
    queuedCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
      index: true
    },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

communicationCampaignSchema.index({ tenantId: 1, campaignId: 1, isdeleted: 1 }, { unique: true });
communicationCampaignSchema.index({ tenantId: 1, status: 1, scheduledAt: 1, isdeleted: 1 });

const CommunicationCampaign = mongoose.model('communicationcampaign', communicationCampaignSchema);
export default CommunicationCampaign;
