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
    textHtml: { type: String, required: false },
    isCorrect: { type: Boolean, default: false }
  },
  { _id: false }
);

const QuestionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    testId: { type: String, required: true, trim: true },
    questionId: { type: String, required: true, trim: true },
    questionType: {
      type: String,
      required: true,
      enum: ['mcq_single', 'mcq_multi', 'true_false', 'short_answer', 'integer', 'subjective', 'numeric', 'passage_qns']
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
    questionHtml: { type: String, default: '', trim: false },
    passageHtml: { type: String, default: '', trim: false },
    instructionHtml: { type: String, default: '', trim: false },
    questionOptions: { type: [OptionSchema], default: [] },
    solutionHtml: { type: String, default: '', trim: false },
    enablePassage: { type: Boolean, default: false },
    enableInstruction: { type: Boolean, default: false },
    enableSolution: { type: Boolean, default: false },
    correctAnswer: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
    status: { type: String, default: 'active' },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

QuestionSchema.index(
  { tenantId: 1, testId: 1, questionId: 1 },
  {
    unique: true,
    partialFilterExpression: { isdeleted: false },
    name: 'uniq_question_per_test'
  }
);
QuestionSchema.index({ tenantId: 1, testId: 1, isdeleted: 1, createdAt: -1 }, { name: 'q_list_by_test' });

QuestionSchema.pre('validate', function (next) {
  try {
    const qt = String(this.questionType || '').toLowerCase();
    const opts = Array.isArray(this.questionOptions) ? this.questionOptions : [];
    const needsOptions = ['mcq', 'msq', 'truefalse'].includes(qt);
    if (needsOptions && !opts.length) {
      return next(new Error('questionOptions is required for mcq/msq/truefalse'));
    }
    if (qt === 'mcq' || qt === 'truefalse') {
      const correctCount = opts.filter((o) => o.isCorrect === true).length;
      if (correctCount < 1) {
        return next(new Error('At least one correct option is required'));
      }
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

const AssignmentQns = mongoose.model('assignmentqns', QuestionSchema);
export default AssignmentQns;
