import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true },
    fieldType: { type: String, enum: ['text', 'radio', 'checkbox', 'score'], required: true },
    fieldText: { type: String, required: true, trim: true },
    fieldOptions: { type: [{ label: String, score: Number }], default: [] },
    part: { type: String, trim: true, default: 'A' },
    weightage: { type: Number, default: 1 },
    maxScore: { type: Number, default: 10 },
    sortOrder: { type: Number, default: 0 },
    isSubjectBased: { type: Boolean, default: false }
  },
  { _id: false }
);

const feedbackTemplateSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    category: {
      type: String,
      enum: ['STAFF', 'BATCH', 'FACILITY', 'COURSE'],
      required: true,
      index: true
    },
    questions: { type: [questionSchema], default: [] },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

feedbackTemplateSchema.index({ tenantId: 1, status: 1, isdeleted: 1 });

const FeedbackTemplate = mongoose.model('feedbacktemplate', feedbackTemplateSchema);
export default FeedbackTemplate;
