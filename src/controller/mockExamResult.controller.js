import mongoose from 'mongoose';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExamQns from '../models/mockExamQns.model.js';
import MockExam from '../models/mockExam.model.js';
import MockExamBatchAssign from '../models/mockExambatchmapping.model.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
};
const pickTid = (req) => safeTrim(req.body?.entiId || req.body?.tenantId);
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const normArr = (v) => (Array.isArray(v) ? v.map((x) => safeTrim(x)).filter(Boolean) : []);
const sameSet = (a, b) => {
  const A = new Set(normArr(a));
  const B = new Set(normArr(b));
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
};

// ─── Evaluation helpers ───────────────────────────────────────────────────────
const buildCorrectAnswer = (q) => {
  const qt = safeTrim(q?.questionType).toLowerCase();
  const opts = Array.isArray(q?.questionOptions) ? q.questionOptions : [];
  if (qt === 'mcq_single' || qt === 'true_false') {
    const one = opts.find((o) => o?.isCorrect === true);
    return safeTrim(one?.key || one?.textHtml || '');
  }
  if (qt === 'mcq_multi')
    return opts
      .filter((o) => o?.isCorrect)
      .map((o) => safeTrim(o?.key || o?.textHtml || ''))
      .filter(Boolean);
  return null;
};

const evalAnswer = (q, answerRaw) => {
  const qt = safeTrim(q?.questionType).toLowerCase();
  const correct = buildCorrectAnswer(q);
  const pos = toNum(q?.positiveMarks);
  const neg = toNum(q?.negativeMarks);

  if (answerRaw === null || answerRaw === undefined) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };

  if (qt === 'mcq_single' || qt === 'true_false') {
    const a = safeTrim(answerRaw);
    if (!a) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
    const ok = a === safeTrim(correct);
    let marks = ok ? pos : neg ? -Math.abs(neg) : 0;
    if (!ok && q?.hasPartialMarking) {
      const opt = (q.questionOptions || []).find((o) => safeTrim(o?.key) === a || safeTrim(o?.textHtml) === a);
      if (opt && toNum(opt.partialMark) > 0) marks = toNum(opt.partialMark);
    }
    return { isCorrect: ok, correctAnswerRaw: correct, marksAwarded: marks };
  }

  if (qt === 'mcq_multi') {
    const a = normArr(answerRaw);
    const ok = sameSet(a, correct);
    if (ok) return { isCorrect: true, correctAnswerRaw: correct, marksAwarded: pos };
    if (q?.hasPartialMarking) {
      const opts = q.questionOptions || [];
      let partial = 0;
      for (const key of a) {
        const opt = opts.find((o) => safeTrim(o?.key) === key || safeTrim(o?.textHtml) === key);
        if (opt?.isCorrect && toNum(opt.partialMark) > 0) partial += toNum(opt.partialMark);
        else if (!opt?.isCorrect) {
          partial = 0;
          break;
        }
      }
      if (partial > 0) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: partial };
    }
    return { isCorrect: false, correctAnswerRaw: correct, marksAwarded: neg ? -Math.abs(neg) : 0 };
  }

  if (qt === 'numeric') {
    const val = Number(String(answerRaw).trim());
    if (!Number.isFinite(val)) return { isCorrect: false, correctAnswerRaw: correct, marksAwarded: neg ? -Math.abs(neg) : 0 };
    const mn = q?.numericMin != null ? toNum(q.numericMin) : null;
    const mx = q?.numericMax != null ? toNum(q.numericMax) : null;
    const ok = mn !== null && mx !== null ? val >= mn && val <= mx : safeTrim(answerRaw) === safeTrim(correct);
    return { isCorrect: ok, correctAnswerRaw: correct, marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0 };
  }

  return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
};

const buildSectionResults = (answers, sections, sectionTimings = {}) => {
  const secMap = new Map((sections || []).map((s) => [safeTrim(s.sectionId), s]));
  const buckets = new Map();
  for (const [sid, sec] of secMap.entries()) {
    buckets.set(sid, { sectionId: sid, subjectId: sec.subjectId || null, totalQuestions: 0, answeredCount: 0, correctCount: 0, wrongCount: 0, skippedCount: 0, totalMarks: 0, obtainedMarks: 0, timeTaken: toNum(sectionTimings[sid]) });
  }
  for (const a of answers) {
    const b = buckets.get(safeTrim(a.sectionId));
    if (!b) continue;
    b.totalQuestions++;
    if (a.isSkipped) b.skippedCount++;
    else b.answeredCount++;
    if (a.isCorrect === true) b.correctCount++;
    if (a.isCorrect === false) b.wrongCount++;
    b.obtainedMarks += toNum(a.marksAwarded);
  }
  return Array.from(buckets.values());
};

// ─── SUBMIT RESULT ────────────────────────────────────────────────────────────
const submitResult = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const examId = safeTrim(req.body?.examId);
    const batchId = safeTrim(req.body?.batchId) || null;
    const centerId = safeTrim(req.body?.centerId) || null;
    const classNo = req.body?.classNo ? toNum(req.body.classNo) : null;
    const startedAt = req.body?.startedAt ? toNum(req.body.startedAt) : null;
    const completedAt = req.body?.completedAt ? toNum(req.body.completedAt) : Date.now();
    const sectionTimings = req.body?.sectionTimings || {};
    if (!tenantId || !admissionNo || !examId) return res.status(400).json({ status: false, message: 'tenantId, admissionNo, examId are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    if (exam.startTime && now < exam.startTime) return res.status(403).json({ status: false, message: 'Exam has not started yet' });
    const isLate = !!(exam.endTime && completedAt > exam.endTime);
    const incomingAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!incomingAnswers.length) return res.status(400).json({ status: false, message: 'answers[] is required' });
    const questions = await MockExamQns.find({ tenantId, examId, isdeleted: false }, { _id: 0, questionId: 1, sectionId: 1, questionType: 1, positiveMarks: 1, negativeMarks: 1, questionOptions: 1, hasPartialMarking: 1, numericMin: 1, numericMax: 1, correctAnswer: 1 }).lean();
    const qById = new Map(questions.map((q) => [safeTrim(q.questionId), q]));
    const totalPossible = questions.reduce((s, q) => s + toNum(q.positiveMarks), 0);
    const evaluated = [];
    let obtainedMarks = 0;
    for (const a of incomingAnswers) {
      const qid = safeTrim(a?.questionId);
      const sid = safeTrim(a?.sectionId);
      if (!qid) continue;
      const q = qById.get(qid) || null;
      const isSkipped = a?.isSkipped === true;
      const answerRaw = isSkipped ? null : (a?.answerRaw ?? null);
      const pos = q ? toNum(q.positiveMarks) : toNum(a?.positiveMarks);
      const neg = q ? toNum(q.negativeMarks) : toNum(a?.negativeMarks);
      let isCorrect = null,
        correctAnswerRaw = null,
        marksAwarded = 0;
      if (q && !isSkipped) {
        const ev = evalAnswer(q, answerRaw);
        isCorrect = ev.isCorrect;
        correctAnswerRaw = ev.correctAnswerRaw ?? null;
        marksAwarded = ev.marksAwarded;
      }
      obtainedMarks += toNum(marksAwarded);
      evaluated.push({
        questionId: qid,
        sectionId: sid || (q ? safeTrim(q.sectionId) : ''),
        answerRaw,
        isCorrect,
        isSkipped,
        timeTaken: toNum(a.timeTaken, 0),
        positiveMarks: pos,
        negativeMarks: neg,
        marksAwarded,
        correctAnswerRaw,
        hasPartialMarking: q?.hasPartialMarking || false
      });
    }
    const sectionResults = buildSectionResults(evaluated, exam.sections, sectionTimings);
    const totalMarks = toNum(exam.totalMarks) || totalPossible;
    const doc = await MockExamResult.create({
      tenantId,
      examId,
      admissionNo,
      studentId: safeTrim(req.body?.studentId) || null,
      batchId,
      centerId,
      classNo,
      startedAt,
      completedAt,
      timeTaken: startedAt ? Math.max(0, completedAt - startedAt) : 0,
      isLate,
      totalQuestions: evaluated.length,
      totalMarks,
      obtainedMarks,
      sectionResults,
      answers: evaluated,
      status: 'completed',
      isResultVisible: false,
      createdBy: safeTrim(req.body?.userId) || null,
      updatedBy: safeTrim(req.body?.userId) || null
    });
    if (batchId) {
      await MockExamBatchAssign.updateOne(
        { tenantId, examId, batchId, isdeleted: false },
        {
          $set: {
            'students.$[st].status': 'completed',
            'students.$[st].completedAt': completedAt,
            'students.$[st].startedAt': startedAt,
            'students.$[st].obtainedMarks': obtainedMarks,
            'students.$[st].isLate': isLate
          }
        },
        { arrayFilters: [{ 'st.admissionNo': admissionNo }] }
      );
    }
    return res.status(200).json({
      status: true,
      message: 'Result submitted successfully',
      data: { _id: doc._id, examId, admissionNo, obtainedMarks, totalMarks, isLate, sectionResults }
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Result already submitted for this student and exam' });
    return next(err);
  }
};

// ─── GET MY RESULT ────────────────────────────────────────────────────────────
const getMyResult = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    if (!tenantId || !examId || !admissionNo) return res.status(400).json({ status: false, message: 'tenantId, examId, admissionNo are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { autoPublishAt: 1, resultPublishedAt: 1, status: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    // const autoPublishPassed = !exam.autoPublishAt || now >= exam.autoPublishAt;
    // if (exam.status !== 'result_published' || !autoPublishPassed) {
    //   return res.status(403).json({ status: false, message: 'Result has not been published yet', autoPublishAt: exam.autoPublishAt || null });
    // }
    const manuallyPublished = !!exam.resultPublishedAt;
    const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
    const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
    if (!resultReady) {
      return res.status(403).json({
        status: false,
        message: 'Result has not been published yet',
        autoPublishAt: exam.autoPublishAt || null
      });
    }
    const result = await MockExamResult.findOne({ tenantId, examId, admissionNo, isdeleted: false }).lean();
    if (!result) return res.status(404).json({ status: false, message: 'Result not found' });
    if (!result.isResultVisible) return res.status(403).json({ status: false, message: 'Result not yet visible' });
    return res.status(200).json({ status: true, message: 'Result loaded', data: { ...result, exam } });
  } catch (err) {
    return next(err);
  }
};

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
const getLeaderboard = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { status: 1, autoPublishAt: 1, resultPublishedAt: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    // const autoPublishPassed = !exam.autoPublishAt || now >= exam.autoPublishAt;
    // if (exam.status !== 'result_published' || !autoPublishPassed) {
    //   return res.status(403).json({ status: false, message: 'Leaderboard not yet available', autoPublishAt: exam.autoPublishAt || null });
    // }
    const manuallyPublished = !!exam.resultPublishedAt;
    const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
    const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
    if (!resultReady) {
      return res.status(403).json({
        status: false,
        message: 'Leaderboard not yet available',
        autoPublishAt: exam.autoPublishAt || null
      });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const query = { tenantId, examId, isdeleted: false, isResultVisible: true };
    if (safeTrim(req.body?.batchId)) query.batchId = safeTrim(req.body.batchId);
    if (safeTrim(req.body?.centerId)) query.centerId = safeTrim(req.body.centerId);
    const [rows, count] = await Promise.all([
      MockExamResult.find(query, { admissionNo: 1, studentId: 1, batchId: 1, centerId: 1, obtainedMarks: 1, totalMarks: 1, percentile: 1, rank: 1, timeTaken: 1, isLate: 1, sectionResults: 1, completedAt: 1 }).sort({ rank: 1 }).skip(skip).limit(limit).lean(),
      MockExamResult.countDocuments(query)
    ]);
    return res.status(200).json({ status: true, message: 'Leaderboard loaded', data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

// ─── LIST RESULTS BY EXAM ─────────────────────────────────────────────────────
const listResultsByExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { tenantId, examId, isdeleted: false };
    if (safeTrim(req.body?.batchId)) query.batchId = safeTrim(req.body.batchId);
    if (safeTrim(req.body?.centerId)) query.centerId = safeTrim(req.body.centerId);
    if (safeTrim(req.body?.admissionNo)) query.admissionNo = safeTrim(req.body.admissionNo);
    if (safeTrim(req.body?.status)) query.status = safeTrim(req.body.status);

    const [rows, count] = await Promise.all([MockExamResult.find(query).sort({ rank: 1, completedAt: -1 }).skip(skip).limit(limit).lean(), MockExamResult.countDocuments(query)]);

    return res.status(200).json({ status: true, message: 'Results loaded', data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

// ─── LIST RESULTS BY BATCH ────────────────────────────────────────────────────
const listResultsByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId);
    if (!tenantId || !batchId) return res.status(400).json({ status: false, message: 'tenantId and batchId are required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { tenantId, batchId, isdeleted: false };
    if (safeTrim(req.body?.examId)) query.examId = safeTrim(req.body.examId);
    if (safeTrim(req.body?.admissionNo)) query.admissionNo = safeTrim(req.body.admissionNo);

    const [rows, count] = await Promise.all([MockExamResult.find(query).sort({ completedAt: -1 }).skip(skip).limit(limit).lean(), MockExamResult.countDocuments(query)]);

    return res.status(200).json({ status: true, message: 'Batch results loaded', data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

// ─── LIST RESULTS BY STUDENT ──────────────────────────────────────────────────
const listResultsByStudent = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    if (!tenantId || !admissionNo) return res.status(400).json({ status: false, message: 'tenantId and admissionNo are required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { tenantId, admissionNo, isdeleted: false };
    if (safeTrim(req.body?.examId)) query.examId = safeTrim(req.body.examId);
    if (safeTrim(req.body?.batchId)) query.batchId = safeTrim(req.body.batchId);

    const [rows, count] = await Promise.all([MockExamResult.find(query, { answers: 0 }).sort({ completedAt: -1 }).skip(skip).limit(limit).lean(), MockExamResult.countDocuments(query)]);

    return res.status(200).json({ status: true, message: 'Student results loaded', data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const getSectionAnalytics = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { sections: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const matchQ = { tenantId, examId, isdeleted: false, isResultVisible: true };
    if (safeTrim(req.body?.batchId)) matchQ.batchId = safeTrim(req.body.batchId);
    if (safeTrim(req.body?.centerId)) matchQ.centerId = safeTrim(req.body.centerId);
    const agg = await MockExamResult.aggregate([
      { $match: matchQ },
      { $unwind: '$sectionResults' },
      {
        $group: {
          _id: '$sectionResults.sectionId',
          avgObtained: { $avg: '$sectionResults.obtainedMarks' },
          maxObtained: { $max: '$sectionResults.obtainedMarks' },
          minObtained: { $min: '$sectionResults.obtainedMarks' },
          avgTimeTaken: { $avg: '$sectionResults.timeTaken' },
          totalAttempts: { $sum: 1 },
          totalCorrect: { $sum: '$sectionResults.correctCount' },
          totalWrong: { $sum: '$sectionResults.wrongCount' },
          totalSkipped: { $sum: '$sectionResults.skippedCount' }
        }
      }
    ]);
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    const data = agg.map((r) => {
      const sec = secMap.get(safeTrim(r._id)) || {};
      const attempted = r.totalCorrect + r.totalWrong;
      return {
        sectionId: r._id,
        sectionName: sec.sectionName || r._id,
        sectionCode: sec.sectionCode || null,
        avgObtained: round2(r.avgObtained),
        maxObtained: round2(r.maxObtained),
        minObtained: round2(r.minObtained),
        avgTimeTakenMs: Math.round(r.avgTimeTaken || 0),
        totalAttempts: r.totalAttempts,
        totalCorrect: r.totalCorrect,
        totalWrong: r.totalWrong,
        totalSkipped: r.totalSkipped,
        accuracy: attempted > 0 ? round2((r.totalCorrect / attempted) * 100) : 0
      };
    });
    return res.status(200).json({ status: true, message: 'Section analytics loaded', data });
  } catch (err) {
    return next(err);
  }
};

const getMyResultWithAnswers = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId || !admissionNo || !examId) return res.status(400).json({ status: false, message: 'tenantId, admissionNo, examId are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { status: 1, autoPublishAt: 1, resultPublishedAt: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    const manuallyPublished = !!exam.resultPublishedAt;
    const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
    const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
    if (!resultReady) {
      return res.status(403).json({
        status: false,
        message: 'Result not published yet',
        autoPublishAt: exam.autoPublishAt || null
      });
    }
    const result = await MockExamResult.findOne({ tenantId, examId, admissionNo, isdeleted: false }).populate('sectionResults.subjectId', 'subjectName').lean();
    if (!result) return res.status(404).json({ status: false, message: 'Result not found for this student' });
    if (!result.isResultVisible) return res.status(403).json({ status: false, message: 'Result is not visible yet' });
    const questions = await MockExamQns.find(
      { tenantId, examId, isdeleted: false },
      {
        questionId: 1,
        sectionId: 1,
        questionType: 1,
        difficulty: 1,
        questionHtml: 1,
        questionOptions: 1,
        correctAnswer: 1,
        solutionHtml: 1,
        enableSolution: 1,
        positiveMarks: 1,
        negativeMarks: 1,
        hasPartialMarking: 1,
        numericMin: 1,
        numericMax: 1,
        passageId: 1,
        passageHtml: 1,
        topicId: 1,
        subTopicId: 1,
        tags: 1,
        sortOrder: 1
      }
    )
      .sort({ sectionId: 1, sortOrder: 1 })
      .populate('passageId', 'title passageHtml')
      .lean();
    const qMap = new Map(questions.map((q) => [safeTrim(q.questionId), q]));
    const answers = (result.answers || []).map((a) => {
      const q = qMap.get(safeTrim(a.questionId)) || null;
      return {
        questionId: a.questionId,
        sectionId: a.sectionId,
        answerRaw: a.answerRaw,
        correctAnswer: q?.correctAnswer ?? null,
        isCorrect: a.isCorrect,
        isSkipped: a.isSkipped,
        marksAwarded: a.marksAwarded,
        timeTaken: a.timeTaken || 0,
        positiveMarks: a.positiveMarks,
        negativeMarks: a.negativeMarks,
        hasPartialMarking: a.hasPartialMarking,
        questionType: q?.questionType || null,
        difficulty: q?.difficulty || null,
        questionHtml: q?.questionHtml || null,
        questionOptions: q?.questionOptions || [],
        solutionHtml: q?.enableSolution ? q?.solutionHtml || null : null,
        numericMin: q?.numericMin ?? null,
        numericMax: q?.numericMax ?? null,
        topicId: q?.topicId || null,
        subTopicId: q?.subTopicId || null,
        tags: q?.tags || [],
        sortOrder: q?.sortOrder ?? null,
        passage: q?.passageId ? { title: q.passageId?.title || null, passageHtml: q.passageId?.passageHtml || null } : q?.passageHtml ? { title: null, passageHtml: q.passageHtml } : null
      };
    });
    return res.status(200).json({
      status: true,
      message: 'Result with answers loaded',
      data: {
        examId,
        admissionNo,
        obtainedMarks: result.obtainedMarks,
        totalMarks: result.totalMarks,
        rank: result.rank,
        percentile: result.percentile,
        timeTaken: result.timeTaken,
        isLate: result.isLate,
        sectionResults: result.sectionResults,
        graceLogs: result.graceLogs,
        answers
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getQuestionTimingAnalytics = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = safeTrim(req.body?.batchId) || null;
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const matchStage = { tenantId, examId, isdeleted: false };
    if (batchId) matchStage.batchId = batchId;
    const rows = await MockExamResult.aggregate([
      { $match: matchStage },
      { $unwind: '$answers' },
      {
        $group: {
          _id: '$answers.questionId',
          sectionId: { $first: '$answers.sectionId' },
          avgTimeTaken: { $avg: '$answers.timeTaken' },
          minTimeTaken: { $min: '$answers.timeTaken' },
          maxTimeTaken: { $max: '$answers.timeTaken' },
          totalStudents: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          questionId: '$_id',
          sectionId: 1,
          avgTimeTaken: { $round: ['$avgTimeTaken', 0] },
          minTimeTaken: 1,
          maxTimeTaken: 1,
          totalStudents: 1
        }
      },
      { $sort: { sectionId: 1, questionId: 1 } }
    ]);
    return res.status(200).json({
      status: true,
      message: 'Question timing analytics loaded',
      examId,
      batchId: batchId || null,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const getQuestionAttemptAnalytics = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = safeTrim(req.body?.batchId) || null;
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const matchStage = { tenantId, examId, isdeleted: false };
    if (batchId) matchStage.batchId = batchId;
    const rows = await MockExamResult.aggregate([
      { $match: matchStage },
      { $unwind: '$answers' },
      {
        $group: {
          _id: '$answers.questionId',
          sectionId: { $first: '$answers.sectionId' },
          totalStudents: { $sum: 1 },
          correctCount: {
            $sum: { $cond: [{ $eq: ['$answers.isCorrect', true] }, 1, 0] }
          },
          wrongCount: {
            $sum: { $cond: [{ $eq: ['$answers.isCorrect', false] }, 1, 0] }
          },
          skippedCount: {
            $sum: { $cond: [{ $eq: ['$answers.isSkipped', true] }, 1, 0] }
          },
          avgMarksAwarded: { $avg: '$answers.marksAwarded' }
        }
      },
      {
        $project: {
          _id: 0,
          questionId: '$_id',
          sectionId: 1,
          totalStudents: 1,
          correctCount: 1,
          wrongCount: 1,
          skippedCount: 1,
          avgMarksAwarded: { $round: ['$avgMarksAwarded', 2] },
          accuracyPct: {
            $round: [
              {
                $cond: [{ $gt: ['$totalStudents', 0] }, { $multiply: [{ $divide: ['$correctCount', '$totalStudents'] }, 100] }, 0]
              },
              2
            ]
          }
        }
      },
      { $sort: { sectionId: 1, questionId: 1 } }
    ]);
    return res.status(200).json({
      status: true,
      message: 'Question attempt analytics loaded',
      examId,
      batchId: batchId || null,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

export default { submitResult, getMyResult, getLeaderboard, listResultsByExam, listResultsByBatch, listResultsByStudent, getSectionAnalytics, getMyResultWithAnswers, getQuestionTimingAnalytics, getQuestionAttemptAnalytics };
