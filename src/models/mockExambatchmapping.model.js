import mongoose from 'mongoose';

const StudentAssignSchema = new mongoose.Schema(
  {
    admissionNo: { type: String, required: true, trim: true },
    studentId: { type: String, default: null, trim: true },
    status: {
      type: String,
      default: 'assigned',
      enum: ['assigned', 'started', 'completed', 'absent']
    },
    assignedAt: { type: Number, default: null },
    startedAt: { type: Number, default: null },
    completedAt: { type: Number, default: null },
    obtainedMarks: { type: Number, default: null },
    rank: { type: Number, default: null },
    percentile: { type: Number, default: null },
    isLate: { type: Boolean, default: false }
  },
  { _id: false }
);

const MockExamBatchAssignSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    examId: { type: String, required: true, trim: true },
    batchId: { type: String, required: true, trim: true },
    classNo: { type: Number, default: null },
    centerId: { type: String, default: null, trim: true },
    status: {
      type: String,
      default: 'enabled',
      enum: ['enabled', 'disabled']
    },
    enabledAt: { type: Number, default: null },
    enabledBy: { type: String, default: null },
    disabledAt: { type: Number, default: null },
    disabledBy: { type: String, default: null },
    students: { type: [StudentAssignSchema], default: [] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

MockExamBatchAssignSchema.index({ tenantId: 1, examId: 1, batchId: 1 }, { unique: true, partialFilterExpression: { isdeleted: false }, name: 'uniq_mockexam_batch_assign' });
MockExamBatchAssignSchema.index({ tenantId: 1, batchId: 1, isdeleted: 1, status: 1 }, { name: 'mockexam_batch_filter_idx' });
MockExamBatchAssignSchema.index({ tenantId: 1, examId: 1, isdeleted: 1, status: 1 }, { name: 'mockexam_assign_by_exam_idx' });
MockExamBatchAssignSchema.index({ tenantId: 1, centerId: 1, isdeleted: 1 }, { name: 'mockexam_assign_center_idx' });

const MockExamBatchAssign = mongoose.model('mockexambatchassign', MockExamBatchAssignSchema);
export default MockExamBatchAssign;
