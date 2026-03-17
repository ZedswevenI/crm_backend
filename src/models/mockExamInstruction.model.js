import mongoose from 'mongoose';

const ExamInstructionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    instructionId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    contentHtml: { type: String, default: '', trim: false },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'ta', 'hi']
    },
    status: { type: String, default: 'active', enum: ['active', 'inactive'] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);
ExamInstructionSchema.index({ tenantId: 1, instructionId: 1 }, { unique: true, partialFilterExpression: { isdeleted: false }, name: 'uniq_instruction_per_tenant' });
ExamInstructionSchema.index({ tenantId: 1, isdeleted: 1, status: 1 }, { name: 'instruction_filter_idx' });

const ExamInstruction = mongoose.model('examinstruction', ExamInstructionSchema);
export default ExamInstruction;
