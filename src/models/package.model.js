import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const packageSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    packageId: { type: String, required: true, default: uuid, index: true },
    packageCode: { type: String, required: true, trim: true, index: true },
    classNo: { type: Number, required: true },
    subjectId: { type: String, required: true, trim: true, index: true },
    subjectName: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    attachmentUrl: { type: String, required: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

packageSchema.index({ tenantId: 1, packageCode: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

const Package = mongoose.model('package', packageSchema);
export default Package;
