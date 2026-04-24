// import mongoose from 'mongoose';

// const questionSnapshotSchema = new mongoose.Schema(
//   {
//     fieldId: { type: String, required: true },
//     fieldType: { type: String, enum: ['text', 'radio', 'checkbox'], required: true },
//     fieldText: { type: String, required: true, trim: true },
//     fieldOptions: { type: [String], default: [] },
//     sortOrder: { type: Number, default: 0 },
//     isSubjectBased: { type: Boolean, default: false },
//     subjectCode: { type: String, default: null, trim: true },
//     subjectName: { type: String, default: null, trim: true },
//     subjectId: { type: String, default: null, trim: true },
//     staffId: { type: String, default: null, trim: true },
//     staffName: { type: String, default: null, trim: true }
//   },
//   { _id: false }
// );

// const batchQuestionSnapshotSchema = new mongoose.Schema(
//   {
//     batchCode: { type: String, required: true, trim: true },
//     batchName: { type: String, default: null, trim: true },
//     questions: { type: [questionSnapshotSchema], default: [] }
//   },
//   { _id: false }
// );

// const feedbackFormSchema = new mongoose.Schema(
//   {
//     tenantId: { type: String, required: true, index: true, trim: true },
//     title: { type: String, required: true, trim: true },
//     description: { type: String, trim: true, default: null },
//     templateId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'feedbacktemplate',
//       required: true,
//       index: true
//     },
//     templateTitle: { type: String, trim: true, default: null },
//     category: {
//       type: String,
//       enum: ['STAFF', 'BATCH', 'FACILITY', 'COURSE'],
//       index: true
//     },
//     staffIds: { type: [String], default: [] },
//     staffNames: { type: [String], default: [] },
//     questions: { type: [questionSnapshotSchema], default: [] },
//     assignedBatches: { type: [String], default: [] },
//     batchQuestions: { type: [batchQuestionSnapshotSchema], default: [] },
//     startDate: { type: Number, required: true },
//     endDate: { type: Number, required: true },
//     totalAssignedStudents: { type: Number, default: 0 },
//     status: {
//       type: String,
//       enum: ['DRAFT', 'ACTIVE', 'CLOSED'],
//       default: 'DRAFT',
//       index: true
//     },
//     isdeleted: { type: Boolean, default: false, index: true },
//     createdBy: { type: String, default: null, trim: true },
//     updatedBy: { type: String, default: null, trim: true }
//   },
//   { timestamps: true }
// );

// feedbackFormSchema.index({ tenantId: 1, status: 1, isdeleted: 1 });
// feedbackFormSchema.index({ tenantId: 1, assignedBatches: 1, status: 1, isdeleted: 1 });

// const FeedbackForm = mongoose.model('feedbackform', feedbackFormSchema);
// export default FeedbackForm;

import mongoose from 'mongoose';

const questionSnapshotSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true },
    fieldType: { type: String, enum: ['text', 'radio', 'checkbox', 'score'], required: true },
    fieldText: { type: String, required: true, trim: true },
    fieldOptions: { type: [{ label: String, score: Number }], default: [] },
    part: { type: String, trim: true, default: 'A' },
    weightage: { type: Number, default: 1 },
    maxScore: { type: Number, default: 10 },
    sortOrder: { type: Number, default: 0 },
    isSubjectBased: { type: Boolean, default: false },
    subjectCode: { type: String, default: null, trim: true },
    subjectName: { type: String, default: null, trim: true },
    subjectId: { type: String, default: null, trim: true },
    staffId: { type: String, default: null, trim: true },
    staffName: { type: String, default: null, trim: true }
  },
  { _id: false }
);

const staffAssignmentSchema = new mongoose.Schema(
  {
    staffId: { type: String, required: true, trim: true },
    staffCode: { type: String, trim: true, default: null },
    staffName: { type: String, trim: true, default: null },
    subjectId: { type: String, trim: true, default: null },
    subjectName: { type: String, trim: true, default: null },
    subjectCode: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const batchQuestionSnapshotSchema = new mongoose.Schema(
  {
    batchCode: { type: String, required: true, trim: true },
    batchName: { type: String, default: null, trim: true },
    questions: { type: [questionSnapshotSchema], default: [] }
  },
  { _id: false }
);

const feedbackFormSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'feedbacktemplate', required: true, index: true },
    templateTitle: { type: String, trim: true, default: null },
    category: { type: String, enum: ['STAFF', 'BATCH', 'FACILITY', 'COURSE'], index: true },
    staffAssignments: { type: [staffAssignmentSchema], default: [] },
    staffIds: { type: [String], default: [] },
    staffNames: { type: [String], default: [] },
    questions: { type: [questionSnapshotSchema], default: [] },
    assignedBatches: { type: [String], default: [] },
    batchQuestions: { type: [batchQuestionSnapshotSchema], default: [] },
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
