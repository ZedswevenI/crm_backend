import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
uuid();

/**
 * Program Master + Batch/Version options (from your Excel "CCD")
 *
 * Excel columns mapped:
 * - ClassGroup (Studying in / Going to)
 * - Program
 * - Program Code (ex: "C6053, M6053, U6053")
 * - Version (ex: "Special Sunday")
 * - Class Venue
 * - No of Hrs per Week
 * - Class Timings
 * - Commencement Date (can be date OR text like "Will be confirmed...")
 */

const programOptionSchema = new mongoose.Schema(
  {
    version: { type: String, required: true, trim: true },
    classVenue: { type: String, required: false, trim: true },
    hrsPerWeek: { type: Number, required: false, default: null },
    classTimings: { type: String, required: false, trim: true },
    commencementDate: { type: Date, required: false, default: null },
    commencementNote: { type: String, required: false, trim: true, default: null },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
  },
  { _id: false }
);

const programSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    programId: { type: String, required: true, default: uuid, trim: true },
    academicYear: { type: String, required: true, trim: true },
    studyingClass: { type: String, required: true, trim: true },
    goingToClass: { type: String, required: false, trim: true, default: null },
    programName: { type: String, required: true, trim: true },
    programCodes: { type: [String], required: true, default: [] },
    programType: { type: String, required: false, trim: true, default: null },
    duration: { type: String, required: false, trim: true, default: null },
    target: { type: String, required: false, trim: true, default: null },
    excelId: { type: Number, required: false, default: null },
    options: { type: [programOptionSchema], required: true, default: [] },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isdeleted: { type: Boolean, required: true, default: false }
  },
  {
    timestamps: true
  }
);

programSchema.index({ tenantId: 1, programId: 1, isdeleted: 1 }, { unique: true });
programSchema.index({ tenantId: 1, academicYear: 1, isdeleted: 1, createdAt: -1 });
programSchema.index({ tenantId: 1, studyingClass: 1, academicYear: 1, isdeleted: 1 });
programSchema.index({ tenantId: 1, programName: 1, isdeleted: 1 });
programSchema.index({ tenantId: 1, academicYear: 1, studyingClass: 1, programName: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

// codes unique per tenant+year (active only)
programSchema.index({ tenantId: 1, academicYear: 1, programCodes: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

// ---------------- Normalization + Validation ----------------
programSchema.pre('validate', async function (next) {
  try {
    let raw = this.programCodes;

    if (typeof raw === 'string') {
      raw = raw
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }
    if (!Array.isArray(raw)) raw = [];
    const codes = Array.from(
      new Set(
        raw
          .map((x) =>
            String(x || '')
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      )
    );
    this.programCodes = codes;
    if (!this.programCodes.length) {
      const err = new Error('Program code is required');
      err.statusCode = 400;
      return next(err);
    }
    const versions = (this.options || [])
      .map((o) =>
        String(o?.version || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
    const dup = versions.find((v, i) => versions.indexOf(v) !== i);
    if (dup) {
      const err = new Error(`Duplicate version found: ${dup}`);
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
