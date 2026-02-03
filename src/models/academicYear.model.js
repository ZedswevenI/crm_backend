import mongoose from 'mongoose';

const AcademicYearConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    programId: { type: String, required: true, index: true, trim: true },
    cohortAy: { type: String, required: true, index: true, trim: true },
    duration: { type: Number, required: true },
    years: [
      {
        academicYear: { type: String, required: true, trim: true },
        startOn: { type: Number, required: false, default: null },
        endOn: { type: Number, required: false, default: null }
      }
    ],
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: null },
    updatedBy: { type: String, trim: true, default: null }
  },
  { timestamps: true }
);

AcademicYearConfigSchema.index({ tenantId: 1, programId: 1, cohortAy: 1 }, { unique: true, partialFilterExpression: { isdeleted: false } });

const AcademicYearConfig = mongoose.model('academicYearconfig', AcademicYearConfigSchema);
export default AcademicYearConfig;
