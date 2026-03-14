import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const programSchema = new mongoose.Schema(
  {
    tenantId: { type: String, ref: 'tenant', required: true, trim: true, index: true },
    programId: { type: String, required: true, default: uuid, trim: true },
    eligibleToClass: { type: Number, required: true, min: 5, max: 13, index: true },
    startingClass: { type: Number, required: true, min: 5, max: 13, index: true },
    endingClass: { type: Number, required: false, min: 5, max: 13, index: true },
    programName: { type: String, required: true, trim: true },
    programCodes: { type: String, required: true, trim: true },
    target: { type: String, required: false, trim: true, default: null },
    duration: { type: Number, required: true, min: 1, max: 6, default: null },
    version: { type: String, required: true, trim: true },
    programType: { type: String, required: false, trim: true, default: null },
    subjects: { type: [mongoose.Schema.Types.ObjectId], ref: 'subject', required: false, default: [] },
    excelId: { type: Number, required: false, default: null },
    examMappings: {
      type: [
        {
          categoryId: { type: String, required: true, trim: true },
          subCategoryId: { type: String, required: true, trim: true },
          subjectIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'subject', default: [] },
          sortOrder: { type: Number, required: false, default: 0 }
        }
      ],
      required: false,
      default: []
    },
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
    const eligible = Number(this.eligibleToClass);
    const start = Number(this.startingClass);
    const dur = Number(this.duration);
    if (!Number.isFinite(eligible) || eligible < 5 || eligible > 13) {
      const err = new Error('eligibleToClass must be between 5 and 13');
      err.statusCode = 400;
      return next(err);
    }
    if (!Number.isFinite(start) || start < 5 || start > 13) {
      const err = new Error('startingClass must be between 5 and 13');
      err.statusCode = 400;
      return next(err);
    }
    if (!Number.isFinite(dur) || dur < 1 || dur > 6) {
      const err = new Error('duration must be between 1 and 6');
      err.statusCode = 400;
      return next(err);
    }
    const end = start + dur - 1;
    if (end > 13) {
      const err = new Error('Calculated endingClass exceeds max 13');
      err.statusCode = 400;
      return next(err);
    }
    this.endingClass = end;
    const subs = Array.isArray(this.subjects) ? this.subjects : [];
    this.subjects = Array.from(new Set(subs.map((x) => String(x)))).map((x) => new mongoose.Types.ObjectId(x));

    const ex = Array.isArray(this.examMappings) ? this.examMappings : [];
    const map = new Map();
    for (const r of ex) {
      const categoryId = String(r?.categoryId || '').trim();
      const subCategoryId = String(r?.subCategoryId || '').trim();
      if (!categoryId || !subCategoryId) continue;
      const key = `${categoryId}__${subCategoryId}`;
      if (!map.has(key)) {
        map.set(key, {
          categoryId,
          subCategoryId,
          sortOrder: Number.isFinite(Number(r?.sortOrder)) ? Number(r.sortOrder) : 0
        });
      }
    }
    this.examMappings = Array.from(map.values());

    next();
  } catch (err) {
    return next(err);
  }
});

const Program = mongoose.model('program', programSchema);
export default Program;
