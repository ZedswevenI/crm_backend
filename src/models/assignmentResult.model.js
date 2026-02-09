import mongoose from 'mongoose';

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

const AnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true, trim: true },
    answerRaw: { type: mongoose.Schema.Types.Mixed, default: null },
    isCorrect: { type: Boolean, default: null },
    isSkipped: { type: Boolean, default: false },
    positiveMarks: { type: Number, default: 0 },
    negativeMarks: { type: Number, default: 0 },
    marksAwarded: { type: Number, default: 0 },
    correctAnswerRaw: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const AssignmentResultSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    admissionNo: { type: String, required: true, trim: true },
    studentId: { type: String, default: null, trim: true },
    batchId: { type: String, default: null, trim: true },
    classNo: { type: Number, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true },
    topicId: { type: String, required: true, trim: true },
    subTopicId: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, trim: true },
    subCategoryId: { type: String, required: true, trim: true },
    testId: { type: String, required: true, trim: true },
    testNo: { type: String, required: true },
    testCode: { type: String, required: true, trim: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'assignment', default: null },
    numberOfReattempts: { type: Number, default: 0 },
    startedAt: { type: Number, default: null },
    completedAt: { type: Number, default: null },
    totalQuestions: { type: Number, default: 0 },
    answeredCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    obtainedMarks: { type: Number, default: 0 },
    cgpa: { type: Number, default: 0 },
    answers: { type: [AnswerSchema], default: [] },
    status: {
      type: String,
      default: 'completed',
      enum: ['inprogress', 'completed', 'evaluated']
    },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

AssignmentResultSchema.index(
  { tenantId: 1, admissionNo: 1, testId: 1, numberOfReattempts: 1 },
  {
    unique: true,
    partialFilterExpression: { isdeleted: false },
    name: 'uniq_result_student_test_reattempt'
  }
);
AssignmentResultSchema.index({ tenantId: 1, isdeleted: 1, classNo: 1, subjectId: 1, testId: 1, completedAt: -1 }, { name: 'result_filter_idx' });

AssignmentResultSchema.pre('validate', function (next) {
  try {
    const ans = Array.isArray(this.answers) ? this.answers : [];
    const totalQ = safeNum(this.totalQuestions) || ans.length;
    this.totalQuestions = totalQ;
    const answered = ans.filter((a) => a.answerRaw !== null && a.answerRaw !== undefined && a.isSkipped !== true).length;
    const skipped = ans.filter((a) => a.isSkipped === true).length;
    const correct = ans.filter((a) => a.isCorrect === true).length;
    const wrong = ans.filter((a) => a.isCorrect === false).length;
    this.answeredCount = answered;
    this.skippedCount = skipped;
    this.correctCount = correct;
    this.wrongCount = wrong;
    const obtained = ans.reduce((s, a) => s + safeNum(a.marksAwarded), 0);
    this.obtainedMarks = obtained;
    if (!safeNum(this.totalMarks)) {
      const tm = ans.reduce((s, a) => s + safeNum(a.positiveMarks), 0);
      this.totalMarks = tm;
    }
    const tm2 = safeNum(this.totalMarks);
    const normalized = tm2 > 0 ? (obtained / tm2) * 10 : 0;
    this.cgpa = Math.round(normalized * 100) / 100;
    this.numberOfReattempts = Math.max(0, safeNum(this.numberOfReattempts));
    return next();
  } catch (e) {
    return next(e);
  }
});

const AssignmentResult = mongoose.model('assignmentresult', AssignmentResultSchema);
export default AssignmentResult;
