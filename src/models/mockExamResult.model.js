import mongoose from 'mongoose';

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

const AnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true, trim: true },
    sectionId: { type: String, required: true, trim: true },
    answerRaw: { type: mongoose.Schema.Types.Mixed, default: null },
    isCorrect: { type: Boolean, default: null },
    isSkipped: { type: Boolean, default: false },
    positiveMarks: { type: Number, default: 0 },
    negativeMarks: { type: Number, default: 0 },
    marksAwarded: { type: Number, default: 0 },
    correctAnswerRaw: { type: mongoose.Schema.Types.Mixed, default: null },
    hasPartialMarking: { type: Boolean, default: false },
    timeTaken: { type: Number, default: 0 }
  },
  { _id: false }
);

const SectionResultSchema = new mongoose.Schema(
  {
    sectionId: { type: String, required: true, trim: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', default: null },
    totalQuestions: { type: Number, default: 0 },
    answeredCount: { type: Number, default: null },
    correctCount: { type: Number, default: null },
    wrongCount: { type: Number, default: null },
    skippedCount: { type: Number, default: null },
    totalMarks: { type: Number, default: 0 },
    obtainedMarks: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 }
  },
  { _id: false }
);

const GraceLogSchema = new mongoose.Schema(
  {
    graceId: { type: String, required: true, trim: true },
    graceType: { type: String, required: true, enum: ['exam', 'question'] },
    questionId: { type: String, default: null },
    sectionId: { type: String, default: null },
    actionType: { type: String, required: true, enum: ['flat_add', 'remove_negative', 'grace', null] },
    marksAdded: { type: Number, default: 0 },
    appliedAt: { type: Number, default: null },
    note: { type: String, default: null }
  },
  { _id: false }
);

const PublishHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, enum: ['publish', 'republish', 'reevaluate'] },
    publishedAt: { type: Number, required: true },
    publishedBy: { type: String, default: null },
    obtainedMarksBefore: { type: Number, default: null },
    obtainedMarksAfter: { type: Number, default: null },
    rankBefore: { type: Number, default: null },
    rankAfter: { type: Number, default: null },
    note: { type: String, default: null }
  },
  { _id: false }
);

const MockExamResultSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, trim: true },
    examId: { type: String, required: true, trim: true },
    admissionNo: { type: String, required: true, trim: true },
    studentId: { type: String, default: null, trim: true },
    batchId: { type: String, default: null, trim: true },
    centerId: { type: String, default: null, trim: true },
    classNo: { type: Number, default: null },
    startedAt: { type: Number, default: null },
    completedAt: { type: Number, default: null },
    timeTaken: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    totalQuestions: { type: Number, default: 0 },
    answeredCount: { type: Number, default: null },
    correctCount: { type: Number, default: null },
    wrongCount: { type: Number, default: null },
    skippedCount: { type: Number, default: null },
    totalMarks: { type: Number, default: 0 },
    obtainedMarks: { type: Number, default: 0 },
    percentile: { type: Number, default: null },
    rank: { type: Number, default: null },
    sectionResults: { type: [SectionResultSchema], default: [] },
    answers: { type: [AnswerSchema], default: [] },
    graceLogs: { type: [GraceLogSchema], default: [] },
    publishHistory: { type: [PublishHistorySchema], default: [] },
    status: {
      type: String,
      default: 'completed',
      enum: ['inprogress', 'completed', 'evaluated', 'result_published']
    },
    isResultVisible: { type: Boolean, default: false },
    isImported: { type: Boolean, default: false },
    submissionMode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isdeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

MockExamResultSchema.index({ tenantId: 1, examId: 1, admissionNo: 1 }, { unique: true, partialFilterExpression: { isdeleted: false }, name: 'uniq_mockresult_student_exam' });
MockExamResultSchema.index({ tenantId: 1, examId: 1, isdeleted: 1, obtainedMarks: -1 }, { name: 'mockresult_leaderboard_idx' });
MockExamResultSchema.index({ tenantId: 1, examId: 1, isdeleted: 1, batchId: 1 }, { name: 'mockresult_batch_idx' });
MockExamResultSchema.index({ tenantId: 1, examId: 1, isdeleted: 1, centerId: 1 }, { name: 'mockresult_center_idx' });
MockExamResultSchema.index({ tenantId: 1, admissionNo: 1, isdeleted: 1 }, { name: 'mockresult_student_idx' });
MockExamResultSchema.pre('validate', function (next) {
  try {
    if (this.isImported === true) return next();
    const ans = Array.isArray(this.answers) ? this.answers : [];
    this.totalQuestions = safeNum(this.totalQuestions) || ans.length;
    this.answeredCount = ans.filter((a) => a.answerRaw !== null && a.answerRaw !== undefined && !a.isSkipped).length;
    this.skippedCount = ans.filter((a) => a.isSkipped === true).length;
    this.correctCount = ans.filter((a) => a.isCorrect === true).length;
    this.wrongCount = ans.filter((a) => a.isCorrect === false).length;
    const obtained = ans.reduce((s, a) => s + safeNum(a.marksAwarded), 0);
    this.obtainedMarks = obtained;
    if (!safeNum(this.totalMarks)) {
      this.totalMarks = ans.reduce((s, a) => s + safeNum(a.positiveMarks), 0);
    }
    const tm = safeNum(this.totalMarks);
    this.cgpa = tm > 0 ? Math.round((obtained / tm) * 10 * 100) / 100 : 0;
    if (this.startedAt && this.completedAt) {
      this.timeTaken = Math.max(0, safeNum(this.completedAt) - safeNum(this.startedAt));
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

const MockExamResult = mongoose.model('mockexamresult', MockExamResultSchema);
export default MockExamResult;
