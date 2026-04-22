import mongoose from 'mongoose';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExamQns from '../models/mockExamQns.model.js';
import MockExam from '../models/mockExam.model.js';
import MockExamBatchAssign from '../models/mockExambatchmapping.model.js';

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

const buildCorrectAnswer = (q) => {
  const qt = safeTrim(q?.questionType).toLowerCase();
  const opts = Array.isArray(q?.questionOptions) ? q.questionOptions : [];
  if (qt === 'mcq_single' || qt === 'true_false') {
    const one = opts.find((o) => o?.isCorrect === true);
    return safeTrim(one?.key || one?.textHtml || '').toUpperCase();
  }
  if (qt === 'mcq_multi')
    return opts
      .filter((o) => o?.isCorrect)
      .map((o) => safeTrim(o?.key || o?.textHtml || '').toUpperCase())
      .filter(Boolean);
  return null;
};

const parseMatrixAnswer = (str) => {
  const map = new Map();
  if (!str) return map;
  const pairs = String(str).split(';');
  for (const pair of pairs) {
    const [key, val] = pair.split(':').map((s) => safeTrim(s));
    if (key && val) map.set(key.toUpperCase(), val.toUpperCase());
  }
  return map;
};

const parseMatrixCorrect = (str) => {
  const map = new Map();
  if (!str) return map;
  const pairs = String(str).split(';');
  for (const pair of pairs) {
    const match = pair.match(/^([^:]+):([^(]+)\(([^)]+)\)$/);
    if (match) {
      const key = safeTrim(match[1]).toUpperCase();
      const value = safeTrim(match[2]).toUpperCase();
      const marks = toNum(match[3]);
      map.set(key, { value, marks });
    } else {
      const [key, val] = pair.split(':').map((s) => safeTrim(s));
      if (key && val) map.set(key.toUpperCase(), { value: val.toUpperCase(), marks: 0 });
    }
  }
  return map;
};

const parseRange = (str) => {
  if (!str) return null;
  const match = String(str).match(/^(-?[\d.]+)-(-?[\d.]+)$/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
};

const evalAnswer = (q, answerRaw) => {
  const qt = safeTrim(q?.questionType).toLowerCase();
  const correct = buildCorrectAnswer(q);
  const pos = toNum(q?.positiveMarks);
  const neg = toNum(q?.negativeMarks);
  if (answerRaw === null || answerRaw === undefined) {
    return { isCorrect: null, correctAnswerRaw: correct || q?.correctAnswer || null, marksAwarded: 0 };
  }
  if (qt === 'mcq_single' || qt === 'true_false') {
    const a = safeTrim(answerRaw).toUpperCase();
    if (!a) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
    const ok = a === safeTrim(correct).toUpperCase();
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
  if (qt === 'passage_qns') {
    const correctOpts = (q.questionOptions || []).filter((o) => o?.isCorrect === true);
    if (correctOpts.length <= 1) {
      const a = safeTrim(answerRaw);
      if (!a) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
      const ok = a === safeTrim(correct);
      let marks = ok ? pos : neg ? -Math.abs(neg) : 0;
      if (!ok && q?.hasPartialMarking) {
        const opt = (q.questionOptions || []).find((o) => safeTrim(o?.key) === a || safeTrim(o?.textHtml) === a);
        if (opt && toNum(opt.partialMark) > 0) marks = toNum(opt.partialMark);
      }
      return { isCorrect: ok, correctAnswerRaw: correct, marksAwarded: marks };
    } else {
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
  }
  if (qt === 'numeric') {
    const val = Number(String(answerRaw).trim());
    if (!Number.isFinite(val)) {
      return { isCorrect: false, correctAnswerRaw: q?.correctAnswer || null, marksAwarded: neg ? -Math.abs(neg) : 0 };
    }
    const mn = q?.numericMin != null ? toNum(q.numericMin) : null;
    const mx = q?.numericMax != null ? toNum(q.numericMax) : null;
    const ok = mn !== null && mx !== null ? val >= mn && val <= mx : safeTrim(String(answerRaw)) === safeTrim(String(q?.correctAnswer || ''));
    return {
      isCorrect: ok,
      correctAnswerRaw: q?.correctAnswer || null,
      marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0
    };
  }
  if (qt === 'integer') {
    const val = parseInt(String(answerRaw).trim(), 10);
    if (!Number.isFinite(val)) {
      return { isCorrect: false, correctAnswerRaw: q?.correctAnswer || null, marksAwarded: neg ? -Math.abs(neg) : 0 };
    }
    const correctVal = parseInt(String(q?.correctAnswer || '').trim(), 10);
    const ok = Number.isFinite(correctVal) && val === correctVal;
    return {
      isCorrect: ok,
      correctAnswerRaw: q?.correctAnswer || null,
      marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0
    };
  }
  if (qt === 'short_answer' || qt === 'subjective') {
    const studentAns = safeTrim(String(answerRaw)).toLowerCase();
    const correctAns = safeTrim(String(q?.correctAnswer || '')).toLowerCase();
    if (!studentAns) {
      return { isCorrect: null, correctAnswerRaw: q?.correctAnswer || null, marksAwarded: 0 };
    }
    const range = parseRange(correctAns);
    if (range) {
      const val = Number(studentAns);
      if (!Number.isFinite(val)) {
        return {
          isCorrect: false,
          correctAnswerRaw: q?.correctAnswer || null,
          marksAwarded: neg ? -Math.abs(neg) : 0
        };
      }
      const ok = val >= range.min && val <= range.max;
      return {
        isCorrect: ok,
        correctAnswerRaw: q?.correctAnswer || null,
        marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0
      };
    }
    const ok = studentAns === correctAns;
    return {
      isCorrect: ok,
      correctAnswerRaw: q?.correctAnswer || null,
      marksAwarded: ok ? pos : neg ? -Math.abs(neg) : 0
    };
  }
  if (qt === 'matrix') {
    const studentMap = parseMatrixAnswer(String(answerRaw || ''));
    const correctMap = parseMatrixCorrect(String(q?.correctAnswer || ''));
    if (!correctMap.size || !studentMap.size) {
      return {
        isCorrect: false,
        correctAnswerRaw: q?.correctAnswer || null,
        marksAwarded: neg ? -Math.abs(neg) : 0
      };
    }
    let correctPairs = 0;
    let totalPairs = correctMap.size;
    let partialMarks = 0;
    for (const [key, { value, marks }] of correctMap.entries()) {
      const studentVal = studentMap.get(key);
      if (studentVal === value) {
        correctPairs++;
        partialMarks += marks;
      }
    }
    if (correctPairs === totalPairs) {
      return {
        isCorrect: true,
        correctAnswerRaw: q?.correctAnswer || null,
        marksAwarded: pos
      };
    }
    if (correctPairs === 0) {
      return {
        isCorrect: false,
        correctAnswerRaw: q?.correctAnswer || null,
        marksAwarded: neg ? -Math.abs(neg) : 0
      };
    }
    if (q?.hasPartialMarking && partialMarks > 0) {
      return {
        isCorrect: null,
        correctAnswerRaw: q?.correctAnswer || null,
        marksAwarded: partialMarks
      };
    }
    return {
      isCorrect: false,
      correctAnswerRaw: q?.correctAnswer || null,
      marksAwarded: neg ? -Math.abs(neg) : 0
    };
  }
  return {
    isCorrect: null,
    correctAnswerRaw: q?.correctAnswer || null,
    marksAwarded: 0
  };
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

const submitResult = async (req, res, next) => {
  try {
    console.log(req.body);
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
        console.log('ev answer loop for testing ', ev);
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

const getBatchAttendanceReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = safeTrim(req.body?.batchId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const assign = await MockExamBatchAssign.findOne({ tenantId, examId, batchId, isdeleted: false }).lean();
    if (!assign) {
      return res.status(404).json({ status: false, message: 'No assignment found for this exam and batch' });
    }
    const students = Array.isArray(assign.students) ? assign.students : [];
    const results = await MockExamResult.find({ tenantId, examId, batchId, isdeleted: false }, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, percentile: 1, timeTaken: 1, isLate: 1, completedAt: 1, sectionResults: 1 }).lean();
    const resultMap = new Map(results.map((r) => [r.admissionNo, r]));
    const admissionNos = students.map((s) => safeTrim(s.admissionNo)).filter(Boolean);
    const profiles = await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, 'student.name': 1, 'student.phone': 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [safeTrim(p.admissionNo), p]));
    let totalAssigned = 0;
    let completedCount = 0;
    let startedCount = 0;
    let absentCount = 0;
    let notStartedCount = 0;
    const attendedRows = [];
    const notAttendedRows = [];
    for (const s of students) {
      const admNo = safeTrim(s.admissionNo);
      const profile = profileMap.get(admNo) || null;
      const result = resultMap.get(admNo) || null;
      totalAssigned++;
      const row = {
        admissionNo: admNo,
        studentName: profile?.student?.name || null,
        studentPhone: profile?.student?.phone || null,
        assignStatus: s.status,
        assignedAt: s.assignedAt || null,
        startedAt: result?.completedAt ? s.startedAt || null : null,
        completedAt: s.completedAt || null,
        obtainedMarks: result?.obtainedMarks ?? null,
        totalMarks: result?.totalMarks ?? null,
        rank: result?.rank ?? null,
        percentile: result?.percentile ?? null,
        timeTaken: result?.timeTaken ?? null,
        isLate: result?.isLate ?? false
      };
      if (s.status === 'completed') {
        completedCount++;
        attendedRows.push({ ...row, attendanceStatus: 'completed' });
      } else if (s.status === 'started') {
        startedCount++;
        attendedRows.push({ ...row, attendanceStatus: 'started' });
      } else if (s.status === 'absent') {
        absentCount++;
        notAttendedRows.push({ ...row, attendanceStatus: 'absent' });
      } else {
        notStartedCount++;
        notAttendedRows.push({ ...row, attendanceStatus: 'not_started' });
      }
    }
    attendedRows.sort((a, b) => (a.rank ?? 99999) - (b.rank ?? 99999));
    const attendedCount = completedCount + startedCount;
    const notAttendedCount = absentCount + notStartedCount;
    const attendancePct = totalAssigned > 0 ? round2((attendedCount / totalAssigned) * 100) : 0;
    return res.status(200).json({
      status: true,
      message: 'Batch attendance report loaded',
      data: {
        examId,
        batchId,
        summary: {
          totalAssigned,
          attendedCount,
          notAttendedCount,
          completedCount,
          startedCount,
          absentCount,
          notStartedCount,
          attendancePct
        },
        attended: attendedRows,
        notAttended: notAttendedRows
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchPerformanceReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = safeTrim(req.body?.batchId);
    const rangeSize = toNum(req.body?.rangeSize) || 50;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { totalMarks: 1, sections: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const results = await MockExamResult.find({ tenantId, examId, batchId, isdeleted: false, isResultVisible: true }, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, percentile: 1, timeTaken: 1, sectionResults: 1 }).lean();
    if (!results.length) {
      return res.status(200).json({
        status: true,
        message: 'No published results found for this batch',
        data: { examId, batchId, summary: null, scoreDistribution: [], sectionWise: [], topper: null }
      });
    }
    const totalMarks = toNum(exam.totalMarks) || 1;
    const scores = results.map((r) => toNum(r.obtainedMarks));
    const totalStudents = results.length;
    const avgScore = round2(scores.reduce((s, m) => s + m, 0) / totalStudents);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const passCount = scores.filter((s) => s >= totalMarks * 0.35).length;
    const avgPct = round2((avgScore / totalMarks) * 100);
    const buckets = new Map();
    const bucketCount = Math.ceil(totalMarks / rangeSize);
    for (let i = 0; i < bucketCount; i++) {
      const from = i * rangeSize;
      const to = Math.min((i + 1) * rangeSize - 1, totalMarks);
      const label = `${from}-${to}`;
      buckets.set(label, { range: label, from, to, count: 0, pct: 0 });
    }
    for (const score of scores) {
      const bucketIdx = Math.floor(score / rangeSize);
      const from = bucketIdx * rangeSize;
      const to = Math.min((bucketIdx + 1) * rangeSize - 1, totalMarks);
      const label = `${from}-${to}`;
      if (buckets.has(label)) {
        buckets.get(label).count++;
      }
    }
    const scoreDistribution = Array.from(buckets.values()).map((b) => ({
      ...b,
      pct: round2((b.count / totalStudents) * 100)
    }));
    const secBuckets = new Map();
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    for (const r of results) {
      for (const sec of r.sectionResults || []) {
        const sid = safeTrim(sec.sectionId);
        if (!secBuckets.has(sid)) {
          const secMeta = secMap.get(sid) || {};
          secBuckets.set(sid, {
            sectionId: sid,
            sectionName: secMeta.sectionName || sid,
            sectionCode: secMeta.sectionCode || null,
            totalStudents: 0,
            totalObtained: 0,
            maxObtained: 0,
            minObtained: Infinity,
            totalCorrect: 0,
            totalWrong: 0,
            totalSkipped: 0
          });
        }
        const b = secBuckets.get(sid);
        b.totalStudents++;
        b.totalObtained += toNum(sec.obtainedMarks);
        b.maxObtained = Math.max(b.maxObtained, toNum(sec.obtainedMarks));
        b.minObtained = Math.min(b.minObtained, toNum(sec.obtainedMarks));
        b.totalCorrect += toNum(sec.correctCount);
        b.totalWrong += toNum(sec.wrongCount);
        b.totalSkipped += toNum(sec.skippedCount);
      }
    }

    const sectionWise = Array.from(secBuckets.values()).map((b) => ({
      sectionId: b.sectionId,
      sectionName: b.sectionName,
      sectionCode: b.sectionCode,
      avgMarks: round2(b.totalObtained / b.totalStudents),
      maxMarks: round2(b.maxObtained),
      minMarks: b.minObtained === Infinity ? 0 : round2(b.minObtained),
      totalCorrect: b.totalCorrect,
      totalWrong: b.totalWrong,
      totalSkipped: b.totalSkipped,
      accuracy: b.totalCorrect + b.totalWrong > 0 ? round2((b.totalCorrect / (b.totalCorrect + b.totalWrong)) * 100) : 0
    }));
    const topperResult = results.reduce((best, r) => (toNum(r.obtainedMarks) > toNum(best.obtainedMarks) ? r : best), results[0]);
    const topperProfile = await StudentProfile.findOne({ tenantId, admissionNo: topperResult.admissionNo, isdeleted: false }, { admissionNo: 1, 'student.name': 1 }).lean();
    const topper = {
      admissionNo: topperResult.admissionNo,
      studentName: topperProfile?.student?.name || null,
      obtainedMarks: toNum(topperResult.obtainedMarks),
      totalMarks: toNum(topperResult.totalMarks),
      rank: topperResult.rank,
      percentile: topperResult.percentile,
      sectionResults: topperResult.sectionResults || []
    };
    return res.status(200).json({
      status: true,
      message: 'Batch performance report loaded',
      data: {
        examId,
        batchId,
        totalMarks,
        summary: {
          totalStudents,
          avgScore,
          maxScore,
          minScore,
          passCount,
          failCount: totalStudents - passCount,
          passPct: round2((passCount / totalStudents) * 100),
          avgPct
        },
        scoreDistribution,
        sectionWise,
        topper
      }
    });
  } catch (err) {
    return next(err);
  }
};

const compareWithTopper = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const batchId = safeTrim(req.body?.batchId) || null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!admissionNo) return res.status(400).json({ status: false, message: 'admissionNo is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { totalMarks: 1, sections: 1, status: 1, autoPublishAt: 1, resultPublishedAt: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    const manuallyPublished = !!exam.resultPublishedAt;
    const autoPublishPassed = exam.autoPublishAt && now >= exam.autoPublishAt;
    const resultReady = exam.status === 'result_published' && (manuallyPublished || autoPublishPassed);
    if (!resultReady) {
      return res.status(403).json({
        status: false,
        message: 'Result has not been published yet'
      });
    }
    const studentResult = await MockExamResult.findOne(
      { tenantId, examId, admissionNo, isdeleted: false },
      { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, percentile: 1, timeTaken: 1, isLate: 1, sectionResults: 1, correctCount: 1, wrongCount: 1, skippedCount: 1, totalQuestions: 1 }
    ).lean();
    if (!studentResult) {
      return res.status(404).json({ status: false, message: 'Student result not found' });
    }
    const topperQuery = { tenantId, examId, isdeleted: false, isResultVisible: true, rank: 1 };
    if (batchId) topperQuery.batchId = batchId;
    const topperResult = await MockExamResult.findOne(topperQuery, { admissionNo: 1, obtainedMarks: 1, totalMarks: 1, rank: 1, percentile: 1, timeTaken: 1, sectionResults: 1, correctCount: 1, wrongCount: 1, skippedCount: 1, totalQuestions: 1 }).lean();
    if (!topperResult) {
      return res.status(404).json({ status: false, message: 'Topper result not found' });
    }
    const [studentProfile, topperProfile] = await Promise.all([
      StudentProfile.findOne({ tenantId, admissionNo, isdeleted: false }, { admissionNo: 1, 'student.name': 1 }).lean(),
      StudentProfile.findOne({ tenantId, admissionNo: topperResult.admissionNo, isdeleted: false }, { admissionNo: 1, 'student.name': 1 }).lean()
    ]);
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    const topperSecMap = new Map((topperResult.sectionResults || []).map((s) => [safeTrim(s.sectionId), s]));
    const sectionComparison = (studentResult.sectionResults || []).map((sec) => {
      const sid = safeTrim(sec.sectionId);
      const topperSec = topperSecMap.get(sid) || null;
      const secMeta = secMap.get(sid) || {};
      const studentMark = toNum(sec.obtainedMarks);
      const topperMark = toNum(topperSec?.obtainedMarks);
      const gap = round2(topperMark - studentMark);
      return {
        sectionId: sid,
        sectionName: secMeta.sectionName || sid,
        sectionCode: secMeta.sectionCode || null,
        student: {
          obtainedMarks: studentMark,
          totalQuestions: toNum(sec.totalQuestions),
          correct: toNum(sec.correctCount),
          wrong: toNum(sec.wrongCount),
          skipped: toNum(sec.skippedCount),
          accuracy: toNum(sec.correctCount) + toNum(sec.wrongCount) > 0 ? round2((toNum(sec.correctCount) / (toNum(sec.correctCount) + toNum(sec.wrongCount))) * 100) : 0
        },
        topper: topperSec
          ? {
              obtainedMarks: topperMark,
              totalQuestions: toNum(topperSec.totalQuestions),
              correct: toNum(topperSec.correctCount),
              wrong: toNum(topperSec.wrongCount),
              skipped: toNum(topperSec.skippedCount),
              accuracy: toNum(topperSec.correctCount) + toNum(topperSec.wrongCount) > 0 ? round2((toNum(topperSec.correctCount) / (toNum(topperSec.correctCount) + toNum(topperSec.wrongCount))) * 100) : 0
            }
          : null,
        gap,
        isAhead: gap <= 0
      };
    });
    const totalMarks = toNum(exam.totalMarks) || 1;
    const studentScore = toNum(studentResult.obtainedMarks);
    const topperScore = toNum(topperResult.obtainedMarks);
    const overallGap = round2(topperScore - studentScore);
    const studentPct = round2((studentScore / totalMarks) * 100);
    const topperPct = round2((topperScore / totalMarks) * 100);
    return res.status(200).json({
      status: true,
      message: 'Comparison loaded',
      data: {
        examId,
        batchId: batchId || null,
        totalMarks,
        student: {
          admissionNo: admissionNo,
          studentName: studentProfile?.student?.name || null,
          obtainedMarks: studentScore,
          totalMarks,
          scorePct: studentPct,
          rank: studentResult.rank,
          percentile: studentResult.percentile,
          timeTaken: studentResult.timeTaken,
          isLate: studentResult.isLate,
          totalQuestions: studentResult.totalQuestions,
          correct: studentResult.correctCount,
          wrong: studentResult.wrongCount,
          skipped: studentResult.skippedCount
        },
        topper: {
          admissionNo: topperResult.admissionNo,
          studentName: topperProfile?.student?.name || null,
          obtainedMarks: topperScore,
          totalMarks,
          scorePct: topperPct,
          rank: 1,
          percentile: topperResult.percentile,
          timeTaken: topperResult.timeTaken,
          totalQuestions: topperResult.totalQuestions,
          correct: topperResult.correctCount,
          wrong: topperResult.wrongCount,
          skipped: topperResult.skippedCount
        },
        overall: {
          gap: overallGap,
          gapPct: round2(topperPct - studentPct),
          isAhead: overallGap <= 0,
          studentRank: studentResult.rank,
          topperRank: 1
        },
        sectionComparison
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  submitResult,
  getMyResult,
  getLeaderboard,
  listResultsByExam,
  listResultsByBatch,
  listResultsByStudent,
  getSectionAnalytics,
  getMyResultWithAnswers,
  getQuestionTimingAnalytics,
  getQuestionAttemptAnalytics,
  getBatchAttendanceReport,
  getBatchPerformanceReport,
  compareWithTopper
};
