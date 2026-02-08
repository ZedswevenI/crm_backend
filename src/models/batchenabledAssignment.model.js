import mongoose from 'mongoose';

const StudentTestLogSchema = new mongoose.Schema(
  {
    admissionNo: { type: String, required: true, trim: true },
    studentId: { type: String, default: null },
    status: {
      type: String,
      default: 'ASSIGNED',
      enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']
    },
    assignedAt: { type: Number, default: () => Date.now() },
    startedAt: { type: Number, default: null },
    completedAt: { type: Number, default: null },
    numberOfAttempts: { type: Number, default: 0 },
    cgpa: { type: Number, default: null }
  },
  { _id: false }
);

const BatchEnabledTestSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    batchId: { type: String, required: true, index: true },
    classNo: { type: Number, default: 0 },
    subjectId: { type: String, required: true, index: true },
    testId: { type: String, required: true, index: true },
    testNo: { type: String, default: null },
    status: { type: String, default: 'enabled', enum: ['enabled', 'disabled'] },
    enabledAt: { type: Number, default: () => Date.now() },
    enabledBy: { type: String, default: null },
    students: { type: [StudentTestLogSchema], default: [] },
    disabledAt: { type: Number, default: null },
    disabledBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

BatchEnabledTestSchema.index({ tenantId: 1, batchId: 1, subjectId: 1, testId: 1 }, { unique: true });

const BatchAssignEnable = mongoose.model('BatchEnabledTest', BatchEnabledTestSchema);

export default BatchAssignEnable;
