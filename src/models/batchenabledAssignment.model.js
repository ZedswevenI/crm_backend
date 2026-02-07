import mongoose from 'mongoose';

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
    disabledAt: { type: Number, default: null },
    disabledBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

BatchEnabledTestSchema.index({ tenantId: 1, batchId: 1, subjectId: 1, testId: 1 }, { unique: true });

const BatchAssignEnable = mongoose.model('BatchEnabledTest', BatchEnabledTestSchema);

export default BatchAssignEnable;
