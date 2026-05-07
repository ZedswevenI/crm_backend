import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const communicationTemplateSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    templateId: { type: String, required: true, default: uuid, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: ['GENERAL', 'ADMISSION', 'FEE', 'ATTENDANCE', 'EXAM', 'PTM', 'CIRCULAR', 'ACTIVITY', 'STUDY_MATERIAL', 'PACKAGE', 'FEEDBACK', 'SUPPORT', 'REMARK'],
      default: 'GENERAL',
      index: true
    },
    channel: { type: String, enum: ['email', 'whatsapp', 'sms'], default: 'email', index: true },
    subject: { type: String, trim: true, default: null },
    body: { type: String, required: true, trim: false },
    variables: { type: [String], default: [] },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

communicationTemplateSchema.index({ tenantId: 1, templateId: 1, isdeleted: 1 }, { unique: true });
communicationTemplateSchema.index({ tenantId: 1, name: 1, channel: 1, isdeleted: 1 }, { unique: true });

const CommunicationTemplate = mongoose.model('communicationtemplate', communicationTemplateSchema);
export default CommunicationTemplate;
