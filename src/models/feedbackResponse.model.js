import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true },
    fieldType: { type: String, required: true },
    part: { type: String, default: 'A' },
    score: { type: Number, default: null },
    fieldValue: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const feedbackResponseSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    formId: { type: mongoose.Schema.Types.ObjectId, ref: 'feedbackform', required: true, index: true },
    batchCode: { type: String, required: true, index: true, trim: true },
    studentId: { type: String, required: true, index: true, trim: true },
    admissionNo: { type: String, trim: true, default: null },
    staffId: { type: String, default: null, index: true, trim: true },
    staffCode: { type: String, default: null, trim: true },
    staffName: { type: String, default: null, trim: true },
    answers: { type: [answerSchema], default: [] },
    submittedAt: { type: Number, default: null },
    remarks: { type: String, default: null, trim: true },
    isdeleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

feedbackResponseSchema.index({ tenantId: 1, formId: 1, studentId: 1, staffId: 1 }, { unique: true, name: 'unique_student_form_staff_response' });
feedbackResponseSchema.index({ tenantId: 1, formId: 1, staffId: 1, isdeleted: 1 });
feedbackResponseSchema.index({ tenantId: 1, formId: 1, batchCode: 1, isdeleted: 1 });

const FeedbackResponse = mongoose.model('feedbackresponse', feedbackResponseSchema);
export default FeedbackResponse;
