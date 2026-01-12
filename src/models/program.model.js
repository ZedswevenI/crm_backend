import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const programSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    programId: { type: String, required: true, default: uuid, trim: true },
    eligibleToClass: { type: String, required: true, trim: true },
    programName: { type: String, required: true, trim: true },
    programCodes: { type: String, required: true, trim: true },
    target: { type: String, required: false, trim: true, default: null },
    duration: { type: String, required: false, trim: true, default: null },
    version: { type: String, required: true, trim: true },
    programType: { type: String, required: false, trim: true, default: null },
    excelId: { type: Number, required: false, default: null },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

programSchema.index({ tenantId: 1, programId: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
programSchema.index({ tenantId: 1, isdeleted: 1, createdAt: -1 });
programSchema.index({ tenantId: 1, eligibleToClass: 1, isdeleted: 1 });
programSchema.index({ tenantId: 1, programName: 1, isdeleted: 1 });
programSchema.index({ tenantId: 1, target: 1, isdeleted: 1 });
programSchema.index({ tenantId: 1, status: 1, isdeleted: 1 });
programSchema.index({ tenantId: 1, eligibleToClass: 1, programName: 1, version: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

programSchema.pre('validate', function (next) {
  try {
    const rawStr = String(this.programCodes || '').trim();
    const parts = rawStr
      .split(',')
      .map((x) =>
        String(x || '')
          .trim()
          .toUpperCase()
      )
      .filter(Boolean);
    const uniqueParts = Array.from(new Set(parts));
    if (!uniqueParts.length) {
      const err = new Error('Program code is required');
      err.statusCode = 400;
      return next(err);
    }
    this.programCodes = uniqueParts.join(', ');
    this.version = String(this.version || '').trim();
    if (!this.version) {
      const err = new Error('Version is required');
      err.statusCode = 400;
      return next(err);
    }
    next();
  } catch (err) {
    return next(err);
  }
});

const Program = mongoose.model('program', programSchema);
export default Program;
