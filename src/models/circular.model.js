import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const fileSchema = new mongoose.Schema(
  {
    url: { type: String, required: false, trim: true }
  },
  { _id: false }
);

const circularSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    circularId: { type: String, required: true, default: uuid, index: true },
    category: { type: String, required: true, trim: true, index: true },
    scope: {
      type: String,
      enum: ['INSTITUTE', 'CENTER', 'BATCH'],
      required: true,
      default: 'INSTITUTE',
      index: true
    },
    centerCode: { type: String, trim: true, default: null, index: true },
    batchCode: { type: String, trim: true, default: null, index: true },
    subject: { type: String, required: true, trim: true },
    details: { type: String, required: true, trim: true },
    files: { type: [fileSchema], default: [] },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'PUBLISHED',
      index: true
    },
    publishedAt: { type: Number, default: () => Date.now() },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: null },
    updatedBy: { type: String, trim: true, default: null }
  },
  { timestamps: true }
);

circularSchema.index({ tenantId: 1, circularId: 1, isdeleted: 1 }, { unique: true });
circularSchema.index({ tenantId: 1, scope: 1, isdeleted: 1 });
circularSchema.index({ tenantId: 1, centerCode: 1, isdeleted: 1 });
circularSchema.index({ tenantId: 1, batchCode: 1, isdeleted: 1 });
circularSchema.index({ tenantId: 1, category: 1, status: 1, isdeleted: 1 });

const Circular = mongoose.model('circular', circularSchema);
export default Circular;
