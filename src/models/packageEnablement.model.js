import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const packageEnablementSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    enablementId: { type: String, required: true, default: uuid, index: true },
    packageId: { type: String, required: true, ref: 'package', index: true },
    scope: {
      type: String,
      enum: ['PROGRAM', 'BATCH', 'STUDENT'],
      required: true
    },
    targetIds: { type: [String], required: true, index: true },
    enableDate: { type: Number, required: true, index: true },
    disableDate: { type: Number, required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE' },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

packageEnablementSchema.index({ tenantId: 1, enableDate: 1, disableDate: 1, isdeleted: 1 });

const PackageEnablement = mongoose.model('packageEnablement', packageEnablementSchema);
export default PackageEnablement;
