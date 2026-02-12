import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const REPORT_ISSUES = ['WRONG_ANSWER', 'WRONG_QUESTION', 'IMAGE_MISSING', 'TYPO', 'OUT_OF_SYLLABUS', 'OTHER'];
const REPORT_STATUS = ['PENDING', 'REVIEWING', 'FIXED', 'REJECTED'];

const reportSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    reportId: { type: String, required: true, default: uuid, index: true },
    studentId: { type: String, required: true, ref: 'studentprofile', index: true },
    studentName: { type: String, required: true, trim: true },
    questionId: { type: String, required: true, ref: 'assignmentqns', index: true },
    assignmentId: { type: String, ref: 'assignment', default: null },
    issueType: { type: String, enum: REPORT_ISSUES, required: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: REPORT_STATUS, default: 'PENDING', index: true },
    adminRemark: { type: String, default: null, trim: true },
    resolvedBy: { type: String, ref: 'user', default: null },
    resolvedAt: { type: Number, default: null },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

reportSchema.index({ tenantId: 1, status: 1, isdeleted: 1 });
reportSchema.index({ tenantId: 1, studentId: 1, isdeleted: 1 });

const QuestionReport = mongoose.model('questionreport', reportSchema);
export default QuestionReport;
