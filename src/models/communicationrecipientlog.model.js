import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const communicationRecipientLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    logId: { type: String, required: true, default: uuid, trim: true, index: true },
    campaignId: { type: String, required: true, trim: true, index: true },
    templateId: { type: String, required: true, trim: true, index: true },
    templateName: { type: String, trim: true, default: null },
    channel: { type: String, enum: ['email'], default: 'email', index: true },
    studentId: { type: String, trim: true, default: null, index: true },
    admissionNo: { type: String, trim: true, default: null, index: true },
    studentName: { type: String, trim: true, default: null },
    parentName: { type: String, trim: true, default: null },
    recipientEmail: { type: String, trim: true, lowercase: true, default: null, index: true },
    classNo: { type: Number, default: null },
    batchId: { type: String, trim: true, default: null, index: true },
    batchCode: { type: String, trim: true, default: null },
    centerId: { type: String, trim: true, default: null, index: true },
    centerCode: { type: String, trim: true, default: null },
    programId: { type: String, trim: true, default: null, index: true },
    programName: { type: String, trim: true, default: null },
    subject: { type: String, trim: false, default: null },
    body: { type: String, trim: false, default: null },
    status: { type: String, enum: ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED'], default: 'QUEUED', index: true },
    retries: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    provider: { type: String, default: 'MAILGUN' },
    providerMessageId: { type: String, trim: true, default: null },
    error: { type: String, trim: true, default: null },
    queuedAt: { type: Number, default: () => Date.now() },
    sentAt: { type: Number, default: null },
    deliveredAt: { type: Number, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

communicationRecipientLogSchema.index({ tenantId: 1, campaignId: 1, status: 1, isdeleted: 1 });
communicationRecipientLogSchema.index({ tenantId: 1, admissionNo: 1, isdeleted: 1 });

const CommunicationRecipientLog = mongoose.model('communicationrecipientlog', communicationRecipientLogSchema);
export default CommunicationRecipientLog;
