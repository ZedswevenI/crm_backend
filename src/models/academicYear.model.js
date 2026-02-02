import mongoose from 'mongoose';

const AcademicYearSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    academicYear: { type: String, required: true, index: true, trim: true },
    startOn: { type: Number, required: true, index: true },
    endOn: { type: Number, required: true, index: true },
    label: { type: String, trim: true, default: null },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: null },
    updatedBy: { type: String, trim: true, default: null }
  },
  { timestamps: true }
);

AcademicYearSchema.index({ tenantId: 1, academicYear: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });
AcademicYearSchema.pre('validate', function (next) {
  try {
    const s = Number(this.startOn);
    const e = Number(this.endOn);
    if (!Number.isFinite(s) || s <= 0) return next(Object.assign(new Error('startOn is required'), { statusCode: 400 }));
    if (!Number.isFinite(e) || e <= 0) return next(Object.assign(new Error('endOn is required'), { statusCode: 400 }));
    if (s >= e) return next(Object.assign(new Error('startOn must be before endOn'), { statusCode: 400 }));
    this.academicYear = String(this.academicYear || '').trim();
    if (!this.academicYear) return next(Object.assign(new Error('academicYear is required'), { statusCode: 400 }));
    next();
  } catch (err) {
    next(err);
  }
});

const AcademicYear = mongoose.model('academicYear', AcademicYearSchema);
export default AcademicYear;
