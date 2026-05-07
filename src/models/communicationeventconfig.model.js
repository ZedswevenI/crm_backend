import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const communicationEventConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    configId: { type: String, required: true, default: uuid, trim: true, index: true },
    eventCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    eventName: { type: String, required: true, trim: true },
    sourceModule: {
      type: String,
      enum: ['ADMISSION', 'STUDENT', 'BATCH', 'FEE', 'ATTENDANCE', 'EXAM', 'ASSIGNMENT', 'SCHOOL_EXAM', 'PTM', 'CIRCULAR', 'ACTIVITY', 'PACKAGE', 'FEEDBACK', 'SUPPORT', 'REMARK', 'GENERAL'],
      default: 'GENERAL',
      index: true
    },
    templateId: { type: String, required: true, trim: true, index: true },
    channel: { type: String, enum: ['email'], default: 'email' },
    enabled: { type: Boolean, default: true, index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

communicationEventConfigSchema.index({ tenantId: 1, eventCode: 1, channel: 1, isdeleted: 1 }, { unique: true });
const CommunicationEventConfig = mongoose.model('communicationeventconfig', communicationEventConfigSchema);

export default CommunicationEventConfig;
