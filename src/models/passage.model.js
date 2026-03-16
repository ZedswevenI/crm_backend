import mongoose from 'mongoose';

const ExamPassageSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    passageId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    passageHtml: { type: String, default: '', trim: false },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'ta', 'hi']
    },
    tags: { type: [String], default: [] },
    status: { type: String, default: 'active', enum: ['active', 'inactive'] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

ExamPassageSchema.index({ tenantId: 1, passageId: 1 }, { unique: true, partialFilterExpression: { isdeleted: false }, name: 'uniq_passage_per_tenant' });
ExamPassageSchema.index({ tenantId: 1, isdeleted: 1, status: 1 }, { name: 'passage_filter_idx' });
ExamPassageSchema.index({ tenantId: 1, isdeleted: 1, tags: 1 }, { name: 'passage_tags_idx' });

const ExamPassage = mongoose.model('exampassage', ExamPassageSchema);
export default ExamPassage;
