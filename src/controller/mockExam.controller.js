import mongoose from 'mongoose';
import crypto from 'crypto';
import constants from '../helpers/constants.js';
import MockExam from '../models/mockExam.model.js';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExamQns from '../models/mockExamQns.model.js';
import ExamInstruction from '../models/mockExamInstruction.model.js';

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
const pickUid = (req) => safeTrim(req.body?.userId || req.user?.userId);
const mustObjId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));
const uuid = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const buildSections = (raw = []) =>
  raw.map((s, idx) => {
    if (!mustObjId(s?.subjectId)) throw Object.assign(new Error(`Section ${idx + 1}: invalid subjectId`), { httpStatus: 400 });
    if (!safeTrim(s?.sectionCode)) throw Object.assign(new Error(`Section ${idx + 1}: sectionCode required`), { httpStatus: 400 });
    if (!safeTrim(s?.sectionName)) throw Object.assign(new Error(`Section ${idx + 1}: sectionName required`), { httpStatus: 400 });
    return {
      sectionId: safeTrim(s.sectionId) || uuid(),
      sectionCode: safeTrim(s.sectionCode),
      sectionName: safeTrim(s.sectionName),
      subjectId: new mongoose.Types.ObjectId(String(s.subjectId)),
      numberOfQuestions: toNum(s.numberOfQuestions),
      sortOrder: toNum(s.sortOrder) || idx,
      status: safeTrim(s.status) || 'active'
    };
  });

// ─── Internal: recompute all results and rank ─────────────────────────────────
const _recomputeResults = async (tenantId, examId, exam, userId, action, publishedAt, note) => {
  const results = await MockExamResult.find({ tenantId, examId, isdeleted: false }).lean();
  if (!results.length) return;

  const questions = await MockExamQns.find({ tenantId, examId, isdeleted: false }).lean();
  const qMap = new Map(questions.map((q) => [safeTrim(q.questionId), q]));

  const activeGraces = (exam.graces || []).filter((g) => g.isActive);
  const examGrace = activeGraces.find((g) => g.graceType === 'exam') || null;
  const qGraceMap = new Map(activeGraces.filter((g) => g.graceType === 'question' && g.questionId).map((g) => [safeTrim(g.questionId), g]));

  const scored = results.map((r) => {
    const prev = r.obtainedMarks;
    const prevRank = r.rank;
    const rAnswers = _evalAnswers(r.answers, qMap, qGraceMap);
    let obtained = rAnswers.reduce((s, a) => s + toNum(a.marksAwarded), 0);
    let examGraceMks = 0;
    if (examGrace?.actionType === 'flat_add') {
      examGraceMks = toNum(examGrace.flatMarks);
      obtained += examGraceMks;
    }

    const graceLogs = [];
    if (examGrace?.actionType === 'flat_add') graceLogs.push({ graceId: examGrace.graceId, graceType: 'exam', questionId: null, sectionId: null, actionType: 'flat_add', marksAdded: examGraceMks, appliedAt: examGrace.appliedAt, note: examGrace.note });
    for (const [qid, qg] of qGraceMap.entries()) {
      const ans = rAnswers.find((a) => a.questionId === qid);
      if (ans) graceLogs.push({ graceId: qg.graceId, graceType: 'question', questionId: qid, sectionId: qg.sectionId, actionType: qg.actionType, marksAdded: ans._graceMks || 0, appliedAt: qg.appliedAt, note: qg.note });
    }

    const sectionResults = _buildSectionResults(rAnswers, exam.sections || []);
    return { admissionNo: r.admissionNo, obtained, answers: rAnswers.map(({ _graceMks, ...rest }) => rest), sectionResults, graceLogs, prev, prevRank };
  });

  scored.sort((a, b) => b.obtained - a.obtained);
  const total = scored.length;
  scored.forEach((s, i) => {
    s.rank = i + 1;
    s.percentile = round2(((total - i - 1) / total) * 100);
  });

  const ops = scored.map((s) => ({
    updateOne: {
      filter: { tenantId, examId, admissionNo: s.admissionNo, isdeleted: false },
      update: {
        $set: { obtainedMarks: s.obtained, rank: s.rank, percentile: s.percentile, answers: s.answers, sectionResults: s.sectionResults, graceLogs: s.graceLogs, status: 'result_published', isResultVisible: true, updatedBy: userId || null },
        $push: { publishHistory: { action, publishedAt, publishedBy: userId || null, obtainedMarksBefore: s.prev, obtainedMarksAfter: s.obtained, rankBefore: s.prevRank, rankAfter: s.rank, note } }
      }
    }
  }));
  if (ops.length) await MockExamResult.bulkWrite(ops, { ordered: false });
};

const _evalAnswers = (answers, qMap, qGraceMap) =>
  (answers || []).map((a) => {
    const q = qMap.get(safeTrim(a.questionId)) || null;
    const grace = qGraceMap.get(safeTrim(a.questionId)) || null;
    let marks = toNum(a.marksAwarded);
    let graceMks = 0;
    if (q) {
      const pos = toNum(q.positiveMarks);
      const neg = toNum(q.negativeMarks);
      if (a.isSkipped) marks = 0;
      else if (a.isCorrect === true) marks = pos;
      else if (a.isCorrect === false) marks = neg ? -Math.abs(neg) : 0;
      if (grace) {
        if (grace.actionType === 'remove_negative' && marks < 0) {
          graceMks = -marks;
          marks = 0;
        } else if (grace.actionType === 'flat_add') {
          graceMks = toNum(grace.flatMarks);
          marks += graceMks;
        }
      }
    }
    return { ...a, positiveMarks: q ? toNum(q.positiveMarks) : a.positiveMarks, negativeMarks: q ? toNum(q.negativeMarks) : a.negativeMarks, marksAwarded: marks, _graceMks: graceMks };
  });

const _buildSectionResults = (answers, sections) => {
  const secMap = new Map((sections || []).map((s) => [safeTrim(s.sectionId), s]));
  const buckets = new Map();
  for (const [sid, sec] of secMap.entries()) {
    buckets.set(sid, { sectionId: sid, subjectId: sec.subjectId || null, totalQuestions: 0, answeredCount: 0, correctCount: 0, wrongCount: 0, skippedCount: 0, totalMarks: 0, obtainedMarks: 0, timeTaken: 0 });
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

// ─── CREATE EXAM ──────────────────────────────────────────────────────────────
export const createExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examCode = safeTrim(req.body?.examCode);
    const examName = safeTrim(req.body?.examName);
    const password = safeTrim(req.body?.password);
    const duration = toNum(req.body?.duration) || 180;
    const startTime = req.body?.startTime ? toNum(req.body.startTime) : null;
    const endTime = req.body?.endTime ? toNum(req.body.endTime) : null;
    const autoPublishAt = req.body?.autoPublishAt ? toNum(req.body.autoPublishAt) : null;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examCode) return res.status(400).json({ status: false, message: 'examCode is required' });
    if (!examName) return res.status(400).json({ status: false, message: 'examName is required' });
    if (!password) return res.status(400).json({ status: false, message: 'password is required' });
    if (startTime && endTime && startTime >= endTime) return res.status(400).json({ status: false, message: 'startTime must be before endTime' });
    if (autoPublishAt && endTime && autoPublishAt < endTime) return res.status(400).json({ status: false, message: 'autoPublishAt should be after endTime' });

    if (req.body?.instructionId && !mustObjId(req.body.instructionId)) return res.status(400).json({ status: false, message: 'Invalid instructionId' });

    let sections = [];
    if (Array.isArray(req.body?.sections)) sections = buildSections(req.body.sections);

    const dup = await MockExam.findOne({ tenantId, examCode, isdeleted: false }, { examId: 1 }).lean();
    if (dup) return res.status(409).json({ status: false, message: 'Exam with this examCode already exists' });

    const totalQ = sections.reduce((s, sec) => s + sec.numberOfQuestions, 0) || toNum(req.body?.totalQuestions);

    const doc = await MockExam.create({
      tenantId,
      examId: uuid(),
      examCode,
      examName,
      description: safeTrim(req.body?.description) || null,
      password,
      testType: safeTrim(req.body?.testType) || 'practice',
      medium: safeTrim(req.body?.medium) || 'en',
      instructionId: req.body?.instructionId ? new mongoose.Types.ObjectId(String(req.body.instructionId)) : null,
      calculatorType: safeTrim(req.body?.calculatorType) || 'none',
      sections,
      totalQuestions: totalQ,
      totalMarks: toNum(req.body?.totalMarks),
      duration,
      startTime,
      endTime,
      autoPublishAt,
      status: 'draft',
      createdBy: userId || null,
      isdeleted: false
    });

    return res.status(201).json({ status: true, message: 'Mock exam created successfully', data: doc });
  } catch (err) {
    if (err.httpStatus) return res.status(err.httpStatus).json({ status: false, message: err.message });
    if (err.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate examCode or examId' });
    return next(err);
  }
};

// ─── UPDATE EXAM ──────────────────────────────────────────────────────────────
export const updateExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });

    const doc = await MockExam.findOne({ tenantId, examId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Exam not found' });

    const set = {};
    const str = (k) => {
      if (req.body?.[k] !== undefined) {
        const v = safeTrim(req.body[k]);
        if (v) set[k] = v;
      }
    };
    const num = (k) => {
      if (req.body?.[k] !== undefined) set[k] = toNum(req.body[k]);
    };
    const nul = (k) => {
      if (req.body?.[k] !== undefined) set[k] = req.body[k] ? toNum(req.body[k]) : null;
    };

    str('examName');
    str('examCode');
    str('description');
    str('password');
    str('testType');
    str('medium');
    str('calculatorType');
    str('status');
    num('totalMarks');
    num('totalQuestions');
    num('duration');
    nul('startTime');
    nul('endTime');
    nul('autoPublishAt');

    if (set.examCode) {
      const dup = await MockExam.findOne({ tenantId, examCode: set.examCode, isdeleted: false, examId: { $ne: examId } }, { examId: 1 }).lean();
      if (dup) return res.status(409).json({ status: false, message: 'examCode already in use' });
    }
    if (req.body?.instructionId !== undefined) {
      if (req.body.instructionId && !mustObjId(req.body.instructionId)) return res.status(400).json({ status: false, message: 'Invalid instructionId' });
      set.instructionId = req.body.instructionId ? new mongoose.Types.ObjectId(String(req.body.instructionId)) : null;
    }
    if (Array.isArray(req.body?.sections)) {
      set.sections = buildSections(req.body.sections);
      if (!set.totalQuestions) set.totalQuestions = set.sections.reduce((s, sec) => s + sec.numberOfQuestions, 0);
    }

    const st = set.startTime !== undefined ? set.startTime : doc.startTime;
    const et = set.endTime !== undefined ? set.endTime : doc.endTime;
    const ap = set.autoPublishAt !== undefined ? set.autoPublishAt : doc.autoPublishAt;
    if (st && et && st >= et) return res.status(400).json({ status: false, message: 'startTime must be before endTime' });
    if (ap && et && ap < et) return res.status(400).json({ status: false, message: 'autoPublishAt should be after endTime' });

    if (!Object.keys(set).length) return res.status(400).json({ status: false, message: 'No fields to update' });
    set.updatedBy = userId || null;

    const updated = await MockExam.findOneAndUpdate({ tenantId, examId, isdeleted: false }, { $set: set }, { new: true, runValidators: true }).lean();
    return res.status(200).json({ status: true, message: 'Exam updated successfully', data: { ...updated, password: undefined } });
  } catch (err) {
    if (err.httpStatus) return res.status(err.httpStatus).json({ status: false, message: err.message });
    if (err.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate examCode' });
    return next(err);
  }
};

// ─── LIST EXAMS ───────────────────────────────────────────────────────────────
export const listExams = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const listAll = String(req.query.list || '').toLowerCase() === 'full';

    const query = { tenantId, isdeleted: false };
    if (req.query.testType) query.testType = safeTrim(req.query.testType);
    if (req.query.status) query.status = safeTrim(req.query.status);
    if (req.query.medium) query.medium = safeTrim(req.query.medium);
    if (req.query.search) {
      const rx = { $regex: safeTrim(req.query.search), $options: 'i' };
      query.$or = [{ examCode: rx }, { examName: rx }, { examId: rx }];
    }

    let rows, count;
    const proj = { password: 0 };
    if (listAll) {
      rows = await MockExam.find(query, proj).sort(sort).lean();
      count = rows.length;
    } else {
      [rows, count] = await Promise.all([MockExam.find(query, proj).sort(sort).skip(skip).limit(limit).lean(), MockExam.countDocuments(query)]);
    }

    const now = Date.now();
    rows = rows.map((r) => ({ ...r, isLive: !!(r.startTime && r.endTime && now >= r.startTime && now <= r.endTime) }));

    return res.status(200).json({ status: true, message: 'Exams retrieved successfully', data: rows, count, ...(listAll ? {} : { page, limit }) });
  } catch (err) {
    return next(err);
  }
};

// ─── GET EXAM ─────────────────────────────────────────────────────────────────
export const getExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId || req.query?.examId);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const doc = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { password: 0 }).populate({ path: 'instructionId', model: 'examinstruction', select: 'title contentHtml language' }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Exam not found' });

    return res.status(200).json({ status: true, message: 'Exam retrieved successfully', data: doc });
  } catch (err) {
    return next(err);
  }
};

// ─── DELETE EXAM ──────────────────────────────────────────────────────────────
export const deleteExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });

    const doc = await MockExam.findOneAndUpdate({ tenantId, examId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Exam not found or already deleted' });

    return res.status(200).json({ status: true, message: 'Exam deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

// ─── PUBLISH RESULT ───────────────────────────────────────────────────────────
export const publishResult = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    const publishedAt = toNum(req.body?.publishedAt) || Date.now();
    const note = safeTrim(req.body?.note) || null;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });

    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false });
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });

    const action = exam.resultPublishedAt ? 'republish' : 'publish';
    await _recomputeResults(tenantId, examId, exam, userId, action, publishedAt, note);

    const updated = await MockExam.findOneAndUpdate(
      { tenantId, examId, isdeleted: false },
      {
        $set: { resultPublishedAt: publishedAt, resultPublishedBy: userId || null, status: 'result_published', updatedBy: userId || null },
        $push: { publishLogs: { action, publishedAt, publishedBy: userId || null, note } }
      },
      { new: true, projection: { password: 0 } }
    ).lean();

    return res.status(200).json({ status: true, message: `Result ${action}ed successfully`, data: updated });
  } catch (err) {
    return next(err);
  }
};

// ─── APPLY GRACE ──────────────────────────────────────────────────────────────
export const applyGrace = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    const graceType = safeTrim(req.body?.graceType);
    const actionType = safeTrim(req.body?.actionType);
    const questionId = safeTrim(req.body?.questionId) || null;
    const sectionId = safeTrim(req.body?.sectionId) || null;
    const flatMarks = toNum(req.body?.flatMarks);
    const note = safeTrim(req.body?.note) || null;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!['exam', 'question'].includes(graceType)) return res.status(400).json({ status: false, message: 'graceType must be exam or question' });
    if (!['flat_add', 'remove_negative'].includes(actionType)) return res.status(400).json({ status: false, message: 'actionType must be flat_add or remove_negative' });
    if (graceType === 'question' && !questionId) return res.status(400).json({ status: false, message: 'questionId is required for question grace' });
    if (actionType === 'flat_add' && flatMarks <= 0) return res.status(400).json({ status: false, message: 'flatMarks must be > 0 for flat_add' });

    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false });
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });

    const graceId = graceType === 'question' ? `grace_q_${questionId}` : `grace_exam_${Date.now()}`;
    const newGrace = { graceId, graceType, questionId, sectionId, actionType, flatMarks, appliedAt: Date.now(), appliedBy: userId || null, note, isActive: true };
    const idx = exam.graces.findIndex((g) => g.graceId === graceId);
    if (idx >= 0) exam.graces[idx] = newGrace;
    else exam.graces.push(newGrace);
    exam.updatedBy = userId || null;
    await exam.save();

    return res.status(200).json({ status: true, message: 'Grace applied successfully', data: { graceId, graceType, actionType, flatMarks } });
  } catch (err) {
    return next(err);
  }
};

// ─── REMOVE GRACE ─────────────────────────────────────────────────────────────
export const removeGrace = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const graceId = safeTrim(req.body?.graceId);
    const userId = pickUid(req);

    if (!tenantId || !examId || !graceId) return res.status(400).json({ status: false, message: 'tenantId, examId, graceId are required' });

    const updated = await MockExam.findOneAndUpdate({ tenantId, examId, isdeleted: false }, { $set: { 'graces.$[g].isActive': false, updatedBy: userId || null } }, { arrayFilters: [{ 'g.graceId': graceId }], new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Exam or grace not found' });

    return res.status(200).json({ status: true, message: 'Grace removed successfully' });
  } catch (err) {
    return next(err);
  }
};

// ─── AUTO PUBLISH CHECK (cron) ────────────────────────────────────────────────
export const checkAndAutoPublish = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const now = Date.now();
    const exams = await MockExam.find({
      tenantId,
      isdeleted: false,
      status: { $nin: ['result_published'] },
      autoPublishAt: { $ne: null, $lte: now }
    }).lean();

    if (!exams.length) return res.status(200).json({ status: true, message: 'No exams pending auto-publish', count: 0 });

    const examIds = exams.map((e) => e.examId);
    await MockExam.updateMany({ tenantId, examId: { $in: examIds }, isdeleted: false }, { $set: { status: 'result_published', resultPublishedAt: now } });
    await MockExamResult.updateMany({ tenantId, examId: { $in: examIds }, isdeleted: false }, { $set: { status: 'result_published', isResultVisible: true } });

    return res.status(200).json({ status: true, message: 'Auto-published results', count: examIds.length, examIds });
  } catch (err) {
    return next(err);
  }
};

// ─── LIST EXAMS FOR STUDENT ───────────────────────────────────────────────────
export const listExamsForStudent = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId);
    const admissionNo = safeTrim(req.body?.admissionNo);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });

    // import here to avoid circular — or move to top if not circular
    const MockExamBatchAssign = (await import('../models/mockExamBatchAssign.model.js')).default;
    const assigns = await MockExamBatchAssign.find({ tenantId, batchId, isdeleted: false, status: 'enabled' }, { examId: 1, students: 1 }).lean();
    if (!assigns.length) return res.status(200).json({ status: true, message: 'No exams assigned', data: [], count: 0 });

    const examIds = assigns.map((a) => a.examId);
    const exams = await MockExam.find({ tenantId, examId: { $in: examIds }, isdeleted: false, status: { $ne: 'draft' } }, { password: 0 })
      .sort({ startTime: 1 })
      .lean();

    let attemptedIds = new Set();
    if (admissionNo) {
      const attempted = await MockExamResult.find({ tenantId, admissionNo, examId: { $in: examIds }, isdeleted: false }, { examId: 1 }).lean();
      attemptedIds = new Set(attempted.map((r) => r.examId));
    }

    const now = Date.now();
    const data = exams.map((e) => {
      const isLive = !!(e.startTime && e.endTime && now >= e.startTime && now <= e.endTime);
      const isAttempted = attemptedIds.has(e.examId);
      const resultReady = e.status === 'result_published' && e.autoPublishAt && now >= e.autoPublishAt;
      return { ...e, isLive, isAttempted, canAttempt: isLive && !isAttempted, isResultVisible: resultReady };
    });

    return res.status(200).json({ status: true, message: 'Exams loaded', data, count: data.length });
  } catch (err) {
    return next(err);
  }
};

export default { createExam, updateExam, listExams, getExam, deleteExam, publishResult, applyGrace, removeGrace, checkAndAutoPublish, listExamsForStudent };
