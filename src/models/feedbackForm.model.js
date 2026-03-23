import mongoose from 'mongoose';

const questionSnapshotSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true },
    fieldType: { type: String, enum: ['text', 'radio', 'checkbox'], required: true },
    fieldText: { type: String, required: true, trim: true },
    fieldOptions: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 }
  },
  { _id: false }
);

const feedbackFormSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'feedbacktemplate',
      required: true,
      index: true
    },
    templateTitle: { type: String, trim: true, default: null },
    category: {
      type: String,
      enum: ['STAFF', 'BATCH', 'FACILITY', 'COURSE'],
      index: true
    },
    // staffId: { type: String, default: null, trim: true },
    staffIds: { type: [String], default: [] },
    staffNames: { type: [String], default: [] },
    staffName: { type: String, default: null, trim: true },
    questions: { type: [questionSnapshotSchema], default: [] },
    assignedBatches: { type: [String], default: [] },
    startDate: { type: Number, required: true },
    endDate: { type: Number, required: true },
    totalAssignedStudents: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'CLOSED'],
      default: 'DRAFT',
      index: true
    },
    isdeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, default: null, trim: true },
    updatedBy: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

feedbackFormSchema.index({ tenantId: 1, status: 1, isdeleted: 1 });
feedbackFormSchema.index({ tenantId: 1, assignedBatches: 1, status: 1, isdeleted: 1 });

const FeedbackForm = mongoose.model('feedbackform', feedbackFormSchema);
export default FeedbackForm;
