import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const subjectMarkSchema = new mongoose.Schema(
  {
    subjectName: { type: String, required: true, trim: true },
    maxMarks: { type: Number, required: true },
    obtainedMarks: { type: Number, required: true },
    grade: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const schoolExamResultSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    resultId: { type: String, required: true, default: uuid, index: true },
    examId: { type: String, required: true, ref: 'schoolexam', index: true },
    studentId: { type: String, required: true, index: true },
    admissionNo: { type: String, required: true, index: true },
    subjects: { type: [subjectMarkSchema], default: [] },
    totalMaxMarks: { type: Number, default: 0 },
    totalObtainedMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    remarks: { type: String, trim: true, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

schoolExamResultSchema.index({ tenantId: 1, examId: 1, studentId: 1, isdeleted: 1 }, { unique: true });
const schoolexamresult = mongoose.model('schoolexamresult', schoolExamResultSchema);
export default schoolexamresult;
