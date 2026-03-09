import mongoose from 'mongoose';

const feedbackEntrySchema = new mongoose.Schema(
  {
    feedbackId: { type: String, required: true },
    staffId: { type: String, default: null },
    staffName: { type: String, default: null },
    remarks: { type: String, default: null, trim: true },
    addedAt: { type: Number, default: null }
  },
  { _id: false }
);

const studentPerformanceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    performanceId: { type: String, required: true, unique: true, trim: true },
    studentId: { type: String, required: true, trim: true },
    admissionNo: { type: String, default: null, trim: true },
    batchId: { type: String, default: null, trim: true },
    academicYear: { type: String, required: true, trim: true },
    programId: { type: String, default: null, trim: true },
    centerId: { type: String, default: null, trim: true },
    assignment: {
      cgpa: { type: Number, default: null },
      attempts: { type: Number, default: null },
      marksSecured: { type: Number, default: null },
      marksTotal: { type: Number, default: null },
      overridden: { type: Boolean, default: false },
      lastSyncedAt: { type: Number, default: null }
    },
    examMarks: {
      mock: { type: mongoose.Schema.Types.Mixed, default: null },
      school: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    staffFeedback: { type: [feedbackEntrySchema], default: [] },
    combinedScore: { type: Number, default: null },
    isdeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: false, default: null, ref: 'user' },
    updatedBy: { type: String, required: false, default: null, ref: 'user' }
  },
  { timestamps: true }
);

studentPerformanceSchema.index({ tenantId: 1, studentId: 1, academicYear: 1 }, { unique: true });
studentPerformanceSchema.index({ tenantId: 1, batchId: 1, academicYear: 1 });
studentPerformanceSchema.index({ tenantId: 1, performanceId: 1 });

export default mongoose.model('StudentPerformance', studentPerformanceSchema);
