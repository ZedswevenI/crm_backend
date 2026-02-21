import mongoose from 'mongoose';

const AssignmentSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    classNo: { type: Number, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true },
    topicId: { type: String, required: true, trim: true },
    subTopicId: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, trim: true },
    subCategoryId: { type: String, required: true, trim: true },
    testId: { type: String, required: true, trim: true },
    testNo: { type: String, required: true },
    testCode: { type: String, required: true, trim: true },
    numberOfQuestions: { type: Number, required: true, default: 0 },
    duration: { type: Number, required: true, default: 60 },
    computeFor: { type: Number, required: true, default: 10 },
    status: { type: String, default: 'active' },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

AssignmentSchema.index(
  {
    tenantId: 1,
    classNo: 1,
    subjectId: 1,
    topicId: 1,
    subTopicId: 1,
    categoryId: 1,
    subCategoryId: 1,
    testNo: 1
  },
  {
    unique: true,
    partialFilterExpression: { isdeleted: false },
    name: 'uniq_assignment_by_syllabus_exam'
  }
);
AssignmentSchema.index(
  {
    tenantId: 1,
    isdeleted: 1,
    classNo: 1,
    subjectId: 1,
    topicId: 1,
    subTopicId: 1,
    categoryId: 1,
    subCategoryId: 1
  },
  { name: 'assignment_filter_idx' }
);

const Assignment = mongoose.model('assignment', AssignmentSchema);
export default Assignment;
