import mongoose from 'mongoose';

const OptionSchema = new mongoose.Schema(
  {
    key: { type: String, default: null },
    textHtml: { type: String, default: '' },
    images: [
      {
        url: { type: String, required: true },
        label: { type: String, default: '' },
        order: { type: Number, default: 0 }
      }
    ],
    isCorrect: { type: Boolean, default: false },
    partialMark: { type: Number, default: 0 }
  },
  { _id: false }
);

const MockExamQnsSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    examId: { type: String, default: null, trim: true },
    sectionId: { type: String, default: null, trim: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true },
    questionId: { type: String, required: true, trim: true },
    questionNo: { type: String, default: null, trim: true },
    topicId: { type: String, default: null, trim: true },
    subTopicId: { type: String, default: null, trim: true },
    questionType: {
      type: String,
      required: true,
      enum: ['mcq_single', 'mcq_multi', 'true_false', 'short_answer', 'integer', 'subjective', 'numeric', 'passage_qns', 'matrix']
    },
    difficulty: {
      type: String,
      default: 'medium',
      enum: ['easy', 'medium', 'hard']
    },
    images: [
      {
        url: { type: String, required: true },
        label: { type: String, default: '' },
        order: { type: Number, default: 0 }
      }
    ],
    positiveMarks: { type: Number, default: 0 },
    negativeMarks: { type: Number, default: 0 },
    hasPartialMarking: { type: Boolean, default: false },
    numericMin: { type: Number, default: null },
    numericMax: { type: Number, default: null },
    questionHtml: { type: String, default: '', trim: false },
    instructionHtml: { type: String, default: '', trim: false },
    solutionHtml: { type: String, default: '', trim: false },
    passageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'exampassage',
      default: null
    },
    passageHtml: { type: String, default: '', trim: false },
    enablePassage: { type: Boolean, default: false },
    enableInstruction: { type: Boolean, default: false },
    enableSolution: { type: Boolean, default: false },
    questionOptions: { type: [OptionSchema], default: [] },
    leftColumn: {
      type: [{ key: { type: String }, text: { type: String, default: '' } }],
      default: []
    },
    rightColumn: {
      type: [{ key: { type: String }, text: { type: String, default: '' } }],
      default: []
    },
    correctAnswer: { type: String, default: '' },
    tags: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

MockExamQnsSchema.index({ tenantId: 1, questionNo: 1 }, { unique: true, sparse: true, partialFilterExpression: { questionNo: { $ne: null } }, name: 'uniq_mockqns_questionno' });
MockExamQnsSchema.index({ tenantId: 1, examId: 1, questionId: 1 }, { unique: true, partialFilterExpression: { isdeleted: false, examId: { $ne: null } }, name: 'uniq_mockqns_per_exam' });
MockExamQnsSchema.index({ tenantId: 1, examId: 1, sectionId: 1, subjectId: 1, isdeleted: 1, sortOrder: 1 }, { name: 'mockqns_section_idx' });
MockExamQnsSchema.index({ tenantId: 1, examId: 1, subjectId: 1, topicId: 1, subTopicId: 1, isdeleted: 1 }, { name: 'mockqns_bank_idx' });
MockExamQnsSchema.index({ tenantId: 1, examId: 1, passageId: 1, isdeleted: 1 }, { name: 'mockqns_passage_idx' });

MockExamQnsSchema.pre('validate', function (next) {
  try {
    const qt = String(this.questionType || '').toLowerCase();
    const opts = Array.isArray(this.questionOptions) ? this.questionOptions : [];

    const needsOptions = ['mcq_single', 'mcq_multi', 'true_false'].includes(qt);
    if (needsOptions && !opts.length) {
      return next(new Error('questionOptions is required for mcq_single / mcq_multi / true_false'));
    }
    if ((qt === 'mcq_single' || qt === 'true_false') && opts.filter((o) => o.isCorrect).length < 1) {
      return next(new Error('At least one correct option is required'));
    }
    if (qt === 'numeric' && this.numericMin !== null && this.numericMax !== null) {
      if (this.numericMin > this.numericMax) {
        return next(new Error('numericMin must be <= numericMax'));
      }
    }
    if (this.passageId) {
      this.passageHtml = '';
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

const MockExamQns = mongoose.model('mockexamqns', MockExamQnsSchema);
export default MockExamQns;
