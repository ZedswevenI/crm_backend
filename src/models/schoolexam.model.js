import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const SubjectMarkSchema = new mongoose.Schema(
  {
    subjectName: { type: String, trim: true, default: null },
    marks: { type: Number, default: null },
    maxMarks: { type: Number, default: null },
    isAbsent: { type: Boolean, default: false }
  },
  { _id: false }
);

const StudentResultSchema = new mongoose.Schema(
  {
    admissionNo: { type: String, trim: true, default: null },
    studentId: { type: String, trim: true, default: null },
    studentName: { type: String, trim: true, default: null },
    classNo: { type: Number, default: null },
    subjects: { type: [SubjectMarkSchema], default: [] },
    totalMarks: { type: Number, default: null },
    isMatched: { type: Boolean, default: false }
  },
  { _id: false }
);

const SchoolExamLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true, index: true },
    examLogId: { type: String, required: true, default: uuid, index: true },
    examName: { type: String, required: true, trim: true },
    examDate: { type: Number, default: null },
    batchCode: { type: String, trim: true, default: null, index: true },
    batchId: { type: String, trim: true, default: null },
    centerId: { type: String, trim: true, default: null, index: true },
    classNo: { type: Number, default: null },
    academicYear: { type: String, trim: true, default: null },
    subjectNames: { type: [String], default: [] },
    results: { type: [StudentResultSchema], default: [] },
    totalStudents: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    unmatchedCount: { type: Number, default: 0 },
    uploadedBy: { type: String, trim: true, default: null },
    uploadedAt: { type: Number, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: null },
    updatedBy: { type: String, trim: true, default: null }
  },
  { timestamps: true }
);

SchoolExamLogSchema.index({ tenantId: 1, examName: 1, examDate: 1, batchCode: 1 }, { name: 'schoolexam_filter_idx' });
SchoolExamLogSchema.index({ tenantId: 1, centerId: 1, isdeleted: 1 }, { name: 'schoolexam_center_idx' });
SchoolExamLogSchema.index({ tenantId: 1, academicYear: 1, isdeleted: 1 }, { name: 'schoolexam_ay_idx' });

const SchoolExamLog = mongoose.model('schoolexamlog', SchoolExamLogSchema);
export default SchoolExamLog;
