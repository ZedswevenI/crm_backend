import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true },
    fieldType: { type: String, required: true },
    fieldValue: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const feedbackResponseSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'feedbackform',
      required: true,
      index: true
    },
    batchCode: { type: String, required: true, index: true, trim: true },
    studentId: { type: String, required: true, index: true, trim: true },
    answers: { type: [answerSchema], default: [] },
    submittedAt: { type: Number, default: null },
    isdeleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

feedbackResponseSchema.index({ tenantId: 1, formId: 1, studentId: 1 }, { unique: true, name: 'unique_student_form_response' });

const FeedbackResponse = mongoose.model('feedbackresponse', feedbackResponseSchema);
export default FeedbackResponse;
