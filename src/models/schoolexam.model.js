import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

const schoolExamSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    examId: { type: String, required: true, default: uuid, index: true },
    examName: { type: String, required: true, trim: true }, // e.g., "Midterm", "Quarterly"
    academicYear: { type: String, required: true, trim: true },
    classNo: { type: Number, required: true },
    startDate: { type: Number, default: null },
    endDate: { type: Number, default: null },
    status: { type: String, enum: ['PLANNED', 'COMPLETED', 'CANCELLED'], default: 'PLANNED' },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
);

schoolExamSchema.index({ tenantId: 1, examName: 1, academicYear: 1, classNo: 1, isdeleted: 1 }, { unique: true });
const schoolexam = mongoose.model('schoolexam', schoolExamSchema);
export default schoolexam;
