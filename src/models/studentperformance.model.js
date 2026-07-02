import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const sectionResultSchema = new mongoose.Schema(
  {
    sectionId: { type: String, default: null, trim: true },
    subjectId: { type: String, default: null, trim: true },
    subjectName: { type: String, default: null, trim: true },
    totalMarks: { type: Number, default: 0 },
    obtainedMarks: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 }
  },
  { _id: false }
);

const subjectResultSchema = new mongoose.Schema(
  {
    subjectName: { type: String, default: null, trim: true },
    maxMarks: { type: Number, default: 0 },
    obtainedMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: null },
    grade: { type: String, default: null, trim: true }
  },
  { _id: false }
);

const summarySchema = new mongoose.Schema(
  {
    assignmentAvgCgpa: { type: Number, default: null },
    assignmentAvgPct: { type: Number, default: null },
    assignmentSubjectCount: { type: Number, default: 0 },
    mockAvgPct: { type: Number, default: null },
    mockBestPct: { type: Number, default: null },
    mockBestRank: { type: Number, default: null },
    mockExamCount: { type: Number, default: 0 },
    schoolAvgPct: { type: Number, default: null },
    schoolBestPct: { type: Number, default: null },
    schoolExamCount: { type: Number, default: 0 },
    combinedScore: { type: Number, default: null },
    batchRank: { type: Number, default: null },
    lastSyncedAt: { type: Number, default: null }
  },
  { _id: false }
);

const staffFeedbackSchema = new mongoose.Schema(
  {
    feedbackId: { type: String, required: true, default: () => uuid() },
    staffId: { type: String, default: null, trim: true },
    staffName: { type: String, default: null, trim: true },
    remarks: { type: String, default: null, trim: true },
    addedAt: { type: Number, default: null }
  },
  { _id: false }
);

const studentPerformanceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    performanceId: { type: String, required: true, unique: true, default: () => uuid(), trim: true },
    studentId: { type: String, required: true, trim: true, index: true },
    admissionNo: { type: String, default: null, trim: true, index: true },
    batchId: { type: String, default: null, trim: true, index: true },
    batchCode: { type: String, default: null, trim: true },
    academicYear: { type: String, required: true, trim: true, index: true },
    programId: { type: String, default: null, trim: true },
    centerId: { type: String, default: null, trim: true },
    performanceType: {
      type: String,
      required: true,
      enum: ['ASSIGNMENT', 'MOCK_EXAM', 'SCHOOL_EXAM', 'SUMMARY'],
      index: true
    },
    subjectId: { type: String, default: null, trim: true },
    subjectName: { type: String, default: null, trim: true },
    cgpa: { type: Number, default: null },
    attempts: { type: Number, default: null },
    overridden: { type: Boolean, default: false },
    examId: { type: String, default: null, trim: true, index: true },
    examName: { type: String, default: null, trim: true },
    examDate: { type: Number, default: null },
    obtainedMarks: { type: Number, default: null },
    totalMarks: { type: Number, default: null },
    percentage: { type: Number, default: null },
    rank: { type: Number, default: null },
    sectionResults: { type: [sectionResultSchema], default: [] },
    subjects: { type: [subjectResultSchema], default: [] },
    summary: { type: summarySchema, default: null },
    staffFeedback: { type: [staffFeedbackSchema], default: [] },
    syncedAt: { type: Number, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

studentPerformanceSchema.index({ tenantId: 1, studentId: 1, academicYear: 1, performanceType: 1 }, { unique: true, partialFilterExpression: { performanceType: 'SUMMARY', isdeleted: false }, name: 'uniq_perf_summary' });
studentPerformanceSchema.index({ tenantId: 1, studentId: 1, academicYear: 1, subjectId: 1 }, { unique: true, partialFilterExpression: { performanceType: 'ASSIGNMENT', isdeleted: false }, name: 'uniq_perf_assignment' });
studentPerformanceSchema.index({ tenantId: 1, studentId: 1, examId: 1, academicYear: 1 }, { unique: true, partialFilterExpression: { performanceType: 'MOCK_EXAM', isdeleted: false }, name: 'uniq_perf_mock' });
studentPerformanceSchema.index({ tenantId: 1, studentId: 1, examId: 1, academicYear: 1 }, { unique: true, partialFilterExpression: { performanceType: 'SCHOOL_EXAM', isdeleted: false }, name: 'uniq_perf_school' });
studentPerformanceSchema.index({ tenantId: 1, batchId: 1, academicYear: 1, performanceType: 1, isdeleted: 1 });
studentPerformanceSchema.index({ tenantId: 1, batchId: 1, academicYear: 1, 'summary.combinedScore': -1 });

const StudentPerformance = mongoose.models.studentperformance || mongoose.model('studentperformance', studentPerformanceSchema);

export default StudentPerformance;
