import mongoose from 'mongoose';

const SectionSchema = new mongoose.Schema(
  {
    sectionId: { type: String, required: true, trim: true },
    sectionCode: { type: String, required: true, trim: true },
    sectionName: { type: String, required: true, trim: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true },
    numberOfQuestions: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, default: 'active', enum: ['active', 'inactive'] }
  },
  { _id: false }
);

const GraceSchema = new mongoose.Schema(
  {
    graceId: { type: String, required: true, trim: true },
    graceType: { type: String, required: true, enum: ['exam', 'question'] },
    questionId: { type: String, default: null, trim: true },
    sectionId: { type: String, default: null, trim: true },
    actionType: { type: String, required: true, enum: ['flat_add', 'remove_negative'] },
    flatMarks: { type: Number, default: 0 },
    appliedAt: { type: Number, default: null },
    appliedBy: { type: String, default: null },
    note: { type: String, default: null },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

const PublishLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, enum: ['publish', 'republish'] },
    publishedAt: { type: Number, required: true },
    publishedBy: { type: String, default: null },
    note: { type: String, default: null }
  },
  { _id: false }
);

const MockExamSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    examId: { type: String, required: true, trim: true },
    examCode: { type: String, required: true, trim: true },
    examName: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    password: { type: String, required: true, trim: true },
    testType: {
      type: String,
      default: 'practice',
      enum: ['practice']
    },
    medium: {
      type: String,
      default: 'en',
      enum: ['en']
    },
    instructionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'examinstruction',
      default: null
    },
    calculatorType: {
      type: String,
      default: 'none',
      enum: ['none', 'normal', 'scientific']
    },
    sections: { type: [SectionSchema], default: [] },
    totalQuestions: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    duration: { type: Number, default: 180 },
    startTime: { type: Number, default: null },
    endTime: { type: Number, default: null },
    autoPublishAt: { type: Number, default: null },
    resultPublishAt: { type: Number, default: null },
    resultPublishedAt: { type: Number, default: null },
    resultPublishedBy: { type: String, default: null },
    status: {
      type: String,
      default: 'draft',
      enum: ['draft', 'published', 'live', 'ended', 'result_published']
    },
    graces: { type: [GraceSchema], default: [] },
    publishLogs: { type: [PublishLogSchema], default: [] },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

MockExamSchema.index({ tenantId: 1, examCode: 1 }, { unique: true, partialFilterExpression: { isdeleted: false }, name: 'uniq_mockexam_code' });
MockExamSchema.index({ tenantId: 1, examId: 1 }, { unique: true, partialFilterExpression: { isdeleted: false }, name: 'uniq_mockexam_id' });
MockExamSchema.index({ tenantId: 1, isdeleted: 1, status: 1, startTime: 1 }, { name: 'mockexam_filter_idx' });
MockExamSchema.index({ tenantId: 1, isdeleted: 1, testType: 1, classNo: 1 }, { name: 'mockexam_type_class_idx' });

MockExamSchema.pre('validate', function (next) {
  try {
    const secs = Array.isArray(this.sections) ? this.sections : [];
    if (secs.length && (!this.totalQuestions || this.totalQuestions === 0)) {
      this.totalQuestions = secs.reduce((s, sec) => s + (Number(sec.numberOfQuestions) || 0), 0);
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

const MockExam = mongoose.model('mockexam', MockExamSchema);
export default MockExam;
