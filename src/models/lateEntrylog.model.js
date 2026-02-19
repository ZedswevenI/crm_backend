import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const lateEntrySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    logId: { type: String, required: true, default: uuid, index: true },
    type: { type: String, enum: ['STAFF', 'STUDENT'], required: true, index: true },
    personId: { type: String, required: true, index: true },
    personName: { type: String, trim: true },
    timetableId: { type: String, required: true, index: true },
    batchCode: { type: String, required: true, index: true },
    date: { type: Number, required: true, index: true },
    periodNo: { type: Number, required: true },
    scheduledStartMin: { type: Number, required: true },
    actualEntryTime: { type: Number, required: true },
    delayMinutes: { type: Number, required: true },
    reason: { type: String, trim: true, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

lateEntrySchema.index({ tenantId: 1, type: 1, personId: 1, date: 1, periodNo: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
const LateEntryLog = mongoose.model('lateentrylog', lateEntrySchema);
export default LateEntryLog;
