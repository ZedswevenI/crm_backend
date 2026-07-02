import mongoose from 'mongoose';
import crypto from 'crypto';
import constants from '../helpers/constants.js';
import MockExam from '../models/mockExam.model.js';
import MockExamResult from '../models/mockExamResult.model.js';
import MockExamQns from '../models/mockExamQns.model.js';
import ExamInstruction from '../models/mockExamInstruction.model.js';
import MockExamBatchAssign from '../models/mockExambatchmapping.model.js';
import { syncOnMockPublish } from '../helpers/performanceSync.helper.js';
import StudentProfile from '../models/studentProfile.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';
import { evalAnswer } from './mockExamResult.controller.js';
import Counter from '../models/counter.model.js';

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

const isValidClassNo = (n) => {
  const v = toNum(n);
  return Number.isFinite(v) && v >= 6 && v <= 13;
};

const generateExamCode = async (tenantId) => {
  const counter = await Counter.findOneAndUpdate({ tenantId, key: 'examCode' }, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  const seq = counter.seq;
  return String(100000 + seq);
};

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

const _recomputeResults = async (tenantId, examId, exam, userId, action, doneAt, note, makeVisible = false) => {
  const results = await MockExamResult.find({ tenantId, examId, isdeleted: false }).lean();
  if (!results.length) return 0;
  const questions = await MockExamQns.find({ tenantId, examId, isdeleted: false }).lean();
  const qMap = new Map(questions.map((q) => [safeTrim(q.questionId), q]));
  const qGraceMap = new Map((exam.graces || []).filter((g) => g.isActive).map((g) => [safeTrim(g.questionId), g]));
  const scored = results.map((r) => {
    const prev = r.obtainedMarks;
    const prevRank = r.rank;
    const rAnswers = _evalAnswers(r.answers, qMap, qGraceMap);
    const obtained = rAnswers.reduce((s, a) => s + toNum(a.marksAwarded), 0);
    const graceLogs = [];
    for (const [qid, qg] of qGraceMap.entries()) {
      const ans = rAnswers.find((a) => safeTrim(a.questionId) === qid);
      if (ans) {
        graceLogs.push({
          graceId: qg.graceId,
          graceType: 'question',
          questionId: qid,
          sectionId: qg.sectionId || null,
          actionType: 'grace',
          marksAdded: ans._graceMks || 0,
          appliedAt: qg.appliedAt || null,
          note: qg.note || null
        });
      }
    }
    const sectionResults = _buildSectionResults(rAnswers, exam.sections || []);
    return {
      admissionNo: r.admissionNo,
      obtained,
      answers: rAnswers.map(({ _graceMks, ...rest }) => rest),
      sectionResults,
      graceLogs,
      prev,
      prevRank
    };
  });
  scored.sort((a, b) => b.obtained - a.obtained);
  const total = scored.length;
  let currentRank = 1;
  for (let i = 0; i < scored.length; i++) {
    if (i > 0 && scored[i].obtained < scored[i - 1].obtained) {
      currentRank = i + 1;
    }
    scored[i].rank = currentRank;
    const scoredBelow = scored.filter((s) => s.obtained < scored[i].obtained).length;
    scored[i].percentile = round2((scoredBelow / total) * 100);
  }
  const ops = scored.map((s) => {
    const correctCount = s.answers.filter((a) => a.isCorrect === true).length;
    const wrongCount = s.answers.filter((a) => a.isCorrect === false).length;
    const skippedCount = s.answers.filter((a) => a.isSkipped === true).length;
    const partialCount = s.answers.filter((a) => a.isCorrect === null && !a.isSkipped && a.answerRaw !== null).length;
    const answeredCount = s.answers.filter((a) => !a.isSkipped).length;
    return {
      updateOne: {
        filter: {
          tenantId,
          examId,
          admissionNo: s.admissionNo,
          isdeleted: false
        },
        update: {
          $set: {
            obtainedMarks: s.obtained,
            rank: s.rank,
            percentile: s.percentile,
            answers: s.answers,
            sectionResults: s.sectionResults,
            graceLogs: s.graceLogs,
            correctCount,
            wrongCount,
            skippedCount,
            partialCount,
            answeredCount,
            updatedBy: userId || null,
            ...(makeVisible ? { status: 'result_published', isResultVisible: true } : {})
          },
          $push: {
            publishHistory: {
              action,
              publishedAt: doneAt,
              publishedBy: userId || null,
              obtainedMarksBefore: s.prev ?? null,
              obtainedMarksAfter: s.obtained,
              rankBefore: s.prevRank ?? null,
              rankAfter: s.rank,
              note: note || null
            }
          }
        }
      }
    };
  });
  if (ops.length) await MockExamResult.bulkWrite(ops, { ordered: false });
  return total;
};

const _evalAnswers = (answers, qMap, qGraceMap) =>
  (answers || []).map((a) => {
    const q = qMap.get(safeTrim(a.questionId)) || null;
    const grace = qGraceMap.get(safeTrim(a.questionId)) || null;
    let marks = 0;
    let graceMks = 0;
    let isCorrect = a.isCorrect;
    if (q) {
      if (a.isSkipped) {
        marks = 0;
        isCorrect = null;
      } else {
        const ev = evalAnswer(q, a.answerRaw);
        marks = ev.marksAwarded;
        isCorrect = ev.isCorrect;
      }
      if (grace) {
        const gm = toNum(grace.graceMarks);
        if (marks < 0) {
          graceMks = -marks + gm;
          marks = gm;
        } else {
          graceMks = gm;
          marks += gm;
        }
      }
    }
    return {
      ...a,
      isCorrect,
      positiveMarks: q ? toNum(q.positiveMarks) : a.positiveMarks,
      negativeMarks: q ? toNum(q.negativeMarks) : a.negativeMarks,
      marksAwarded: marks,
      _graceMks: graceMks
    };
  });

const _buildSectionResults = (answers, sections) => {
  const secMap = new Map((sections || []).map((s) => [safeTrim(s.sectionId), s]));
  const sectionTotalMarksMap = new Map();
  for (const a of answers) {
    const sid = safeTrim(a.sectionId);
    sectionTotalMarksMap.set(sid, (sectionTotalMarksMap.get(sid) || 0) + toNum(a.positiveMarks));
  }
  const buckets = new Map();
  for (const [sid, sec] of secMap.entries()) {
    buckets.set(sid, {
      sectionId: sid,
      subjectId: sec.subjectId || null,
      totalQuestions: 0,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      partialCount: 0,
      skippedCount: 0,
      totalMarks: toNum(sec.totalMarks) || sectionTotalMarksMap.get(sid) || 0,
      obtainedMarks: 0,
      timeTaken: 0
    });
  }
  for (const a of answers) {
    const b = buckets.get(safeTrim(a.sectionId));
    if (!b) continue;
    b.totalQuestions++;
    if (a.isSkipped) {
      b.skippedCount++;
    } else {
      b.answeredCount++;
      if (a.isCorrect === true) b.correctCount++;
      else if (a.isCorrect === false) b.wrongCount++;
      else if (a.answerRaw !== null) b.partialCount++;
    }
    b.obtainedMarks += toNum(a.marksAwarded);
  }
  return Array.from(buckets.values());
};

const createExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examName = safeTrim(req.body?.examName);
    const password = safeTrim(req.body?.password);
    const duration = toNum(req.body?.duration) || 180;
    const startTime = req.body?.startTime ? toNum(req.body.startTime) : null;
    const endTime = req.body?.endTime ? toNum(req.body.endTime) : null;
    const classNo = req.body?.classNo ? toNum(req.body.classNo) : null;
    if (classNo !== null && !isValidClassNo(classNo)) {
      return res.status(400).json({ status: false, message: 'classNo must be between 6 and 13' });
    }
    const autoPublishAt = req.body?.autoPublishAt ? toNum(req.body.autoPublishAt) : null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examName) return res.status(400).json({ status: false, message: 'examName is required' });
    if (!password) return res.status(400).json({ status: false, message: 'password is required' });
    let examCode = safeTrim(req.body?.examCode);
    if (!examCode) {
      examCode = await generateExamCode(tenantId);
    } else {
      const dup = await MockExam.findOne({ tenantId, examCode, isdeleted: false }, { examId: 1 }).lean();
      if (dup) return res.status(409).json({ status: false, message: 'Exam with this examCode already exists' });
    }
    if (startTime && endTime && startTime >= endTime) return res.status(400).json({ status: false, message: 'startTime must be before endTime' });
    if (autoPublishAt && endTime && autoPublishAt < endTime) return res.status(400).json({ status: false, message: 'autoPublishAt should be after endTime' });
    if (req.body?.instructionId && !mustObjId(req.body.instructionId)) return res.status(400).json({ status: false, message: 'Invalid instructionId' });
    let sections = [];
    if (Array.isArray(req.body?.sections)) sections = buildSections(req.body.sections);
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
      classNo,
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

const updateExam = async (req, res, next) => {
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
    if (req.body?.classNo !== undefined) {
      const cn = req.body.classNo ? toNum(req.body.classNo) : null;
      if (cn !== null && !isValidClassNo(cn)) {
        return res.status(400).json({ status: false, message: 'classNo must be between 6 and 13' });
      }
      set.classNo = cn;
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

const listExams = async (req, res, next) => {
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
    if (req.query.classNo) query.classNo = toNum(req.query.classNo);
    if (req.query.isImported !== undefined) {
      query.isImported = req.query.isImported === 'true';
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
    const examIds = rows.map((r) => r.examId);
    const actualCounts = await MockExamQns.aggregate([{ $match: { tenantId, examId: { $in: examIds }, isdeleted: false } }, { $group: { _id: '$examId', actualCount: { $sum: 1 } } }]);
    const actualCountMap = new Map(actualCounts.map((a) => [a._id, a.actualCount]));
    rows = rows.map((r) => ({
      ...r,
      isLive: !!(r.startTime && r.endTime && now >= r.startTime && now <= r.endTime),
      actualQuestionCount: actualCountMap.get(r.examId) || 0
    }));
    return res.status(200).json({ status: true, message: 'Exams retrieved successfully', data: rows, count, ...(listAll ? {} : { page, limit }) });
  } catch (err) {
    return next(err);
  }
};

const getExam = async (req, res, next) => {
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

const deleteExam = async (req, res, next) => {
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

const publishResult = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    const publishedAt = toNum(req.body?.publishedAt) || Date.now();
    const note = safeTrim(req.body?.note) || null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false });
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const action = exam.resultPublishedAt ? 'republish' : 'publish';
    const resultCount = await _recomputeResults(tenantId, examId, exam, userId, action, publishedAt, note, true);
    const updated = await MockExam.findOneAndUpdate(
      { tenantId, examId, isdeleted: false },
      {
        $set: {
          resultPublishedAt: publishedAt,
          resultPublishedBy: userId || null,
          status: 'result_published',
          updatedBy: userId || null
        },
        $push: {
          publishLogs: {
            action,
            publishedAt,
            publishedBy: userId || null,
            note
          }
        }
      },
      { new: true, projection: { password: 0 } }
    ).lean();
    syncOnMockPublish({ tenantId, examId }).catch(() => {});
    return res.status(200).json({
      status: true,
      message: `Result ${action}ed — ${resultCount} student result(s) visible`,
      data: {
        examId,
        status: updated.status,
        resultPublishedAt: updated.resultPublishedAt,
        resultCount
      }
    });
  } catch (err) {
    return next(err);
  }
};

const checkAndAutoPublish = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const now = Date.now();
    const exams = await MockExam.find({
      tenantId,
      isdeleted: false,
      status: { $nin: ['result_published'] },
      autoPublishAt: { $ne: null, $lte: now }
    });
    if (!exams.length) return res.status(200).json({ status: true, message: 'No exams pending auto-publish', count: 0 });
    for (const exam of exams) {
      try {
        await _recomputeResults(tenantId, exam.examId, exam, null, 'auto_publish', now, 'Auto published', true);
        await MockExam.findOneAndUpdate({ tenantId, examId: exam.examId, isdeleted: false }, { $set: { status: 'result_published', resultPublishedAt: now } });
      } catch (e) {
        console.error(`Auto-publish failed for examId ${exam.examId}:`, e.message);
      }
    }
    const examIds = exams.map((e) => e.examId);
    return res.status(200).json({ status: true, message: 'Auto-published results', count: examIds.length, examIds });
  } catch (err) {
    return next(err);
  }
};

const listExamsForStudent = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId);
    const admissionNo = safeTrim(req.body?.admissionNo);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const assigns = await MockExamBatchAssign.find({ tenantId, batchId, isdeleted: false, status: 'enabled' }, { examId: 1, students: 1 }).lean();
    if (!assigns.length) return res.status(200).json({ status: true, message: 'No exams assigned', data: [], count: 0 });
    const examIds = assigns.map((a) => a.examId);
    console.log({ tenantId, examId: { $in: examIds }, isdeleted: false, status: { $ne: ['draft', 'disabled'] } });
    const exams = await MockExam.find({ tenantId, examId: { $in: examIds }, isdeleted: false, status: { $nin: ['draft', 'disabled'] } }, { password: 0 })
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
      const manuallyPublished = !!e.resultPublishedAt;
      const autoPublishPassed = e.autoPublishAt && now >= e.autoPublishAt;
      const resultReady = e.status === 'result_published' && (manuallyPublished || autoPublishPassed);
      return { ...e, isLive, isAttempted, canAttempt: isLive && !isAttempted, isResultVisible: resultReady };
    });
    return res.status(200).json({ status: true, message: 'Exams loaded', data, count: data.length });
  } catch (err) {
    return next(err);
  }
};

const publishExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false });
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    if (exam.status !== 'draft') return res.status(400).json({ status: false, message: `Exam is already ${exam.status}` });
    if (!exam.sections?.length) return res.status(400).json({ status: false, message: 'Cannot publish exam with no sections' });
    if (!exam.startTime || !exam.endTime) return res.status(400).json({ status: false, message: 'startTime and endTime are required before publishing' });
    exam.status = 'published';
    exam.updatedBy = userId || null;
    await exam.save();
    return res.status(200).json({ status: true, message: 'Exam published successfully', data: { examId, status: exam.status } });
  } catch (err) {
    return next(err);
  }
};

const duplicateExam = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const refExamId = safeTrim(req.body?.refExamId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!refExamId) return res.status(400).json({ status: false, message: 'refExamId is required' });
    const examName = safeTrim(req.body?.examName);
    const password = safeTrim(req.body?.password);
    if (!examName) return res.status(400).json({ status: false, message: 'examName is required' });
    if (!password) return res.status(400).json({ status: false, message: 'password is required' });
    let examCode = safeTrim(req.body?.examCode);
    if (!examCode) {
      examCode = await generateExamCode(tenantId);
    }
    const duration = toNum(req.body?.duration) || 180;
    const startTime = req.body?.startTime ? toNum(req.body.startTime) : null;
    const endTime = req.body?.endTime ? toNum(req.body.endTime) : null;
    const autoPublishAt = req.body?.autoPublishAt ? toNum(req.body.autoPublishAt) : null;
    if (startTime && endTime && startTime >= endTime) {
      return res.status(400).json({ status: false, message: 'startTime must be before endTime' });
    }
    if (autoPublishAt && endTime && autoPublishAt < endTime) {
      return res.status(400).json({ status: false, message: 'autoPublishAt should be after endTime' });
    }
    if (req.body?.instructionId && !mustObjId(req.body.instructionId)) {
      return res.status(400).json({ status: false, message: 'Invalid instructionId' });
    }
    const sourceExam = await MockExam.findOne({ tenantId, examId: refExamId, isdeleted: false }).session(session).lean();
    if (!sourceExam) {
      await session.abortTransaction();
      return res.status(404).json({ status: false, message: `Source exam not found: ${refExamId}` });
    }
    if (req.body?.examCode) {
      const dupCheck = await MockExam.findOne({ tenantId, examCode, isdeleted: false }, { examId: 1 }).session(session).lean();
      if (dupCheck) {
        await session.abortTransaction();
        return res.status(409).json({ status: false, message: 'Exam with this examCode already exists' });
      }
    }
    const sourceSections = sourceExam.sections || [];
    const sections = sourceSections.map((s, idx) => ({
      sectionId: uuid(),
      sectionCode: safeTrim(s.sectionCode),
      sectionName: safeTrim(s.sectionName),
      subjectId: s.subjectId,
      numberOfQuestions: s.numberOfQuestions || 0,
      totalMarks: toNum(s.totalMarks) || 0,
      sortOrder: s.sortOrder ?? idx,
      status: s.status || 'active'
    }));
    const sectionIdMap = new Map();
    sourceSections.forEach((s, idx) => {
      if (sections[idx]) {
        sectionIdMap.set(safeTrim(s.sectionId), safeTrim(sections[idx].sectionId));
      }
    });
    const newExamId = uuid();
    const totalQ = sections.reduce((s, sec) => s + (sec.numberOfQuestions || 0), 0) || toNum(req.body?.totalQuestions) || sourceExam.totalQuestions || 0;
    const [newExam] = await MockExam.create(
      [
        {
          tenantId,
          examId: newExamId,
          examCode,
          examName,
          description: safeTrim(req.body?.description) || sourceExam.description || null,
          password,
          testType: safeTrim(req.body?.testType) || sourceExam.testType || 'practice',
          medium: safeTrim(req.body?.medium) || sourceExam.medium || 'en',
          instructionId: req.body?.instructionId ? new mongoose.Types.ObjectId(String(req.body.instructionId)) : sourceExam.instructionId || null,
          calculatorType: safeTrim(req.body?.calculatorType) || sourceExam.calculatorType || 'none',
          sections,
          totalQuestions: totalQ,
          totalMarks: toNum(req.body?.totalMarks) || sourceExam.totalMarks || 0,
          duration,
          classNo: toNum(req.body?.classNo) || sourceExam.classNo || null,
          startTime,
          endTime,
          autoPublishAt,
          status: 'draft',
          graces: [],
          publishLogs: [],
          createdBy: userId || null,
          updatedBy: userId || null,
          isdeleted: false
        }
      ],
      { session }
    );
    const sourceQuestions = await MockExamQns.find({ tenantId, examId: refExamId, isdeleted: false }, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 }).lean();
    let copiedCount = 0;
    if (sourceQuestions.length) {
      const newQuestions = sourceQuestions.map((q) => {
        const oldSectionId = safeTrim(q.sectionId || '');
        const newSectionId = sectionIdMap.get(oldSectionId) || oldSectionId;
        return {
          ...q,
          examId: newExamId,
          sectionId: newSectionId,
          questionId: uuid(),
          questionNo: null,
          status: 'active',
          createdBy: userId || null,
          updatedBy: userId || null,
          isdeleted: false
        };
      });

      const inserted = await MockExamQns.insertMany(newQuestions, { session, ordered: false });
      copiedCount = inserted.length;
    }
    await session.commitTransaction();
    return res.status(201).json({
      status: true,
      message: `Exam duplicated successfully — ${copiedCount} question(s) copied`,
      data: {
        examId: newExamId,
        examCode: newExam.examCode,
        examName: newExam.examName,
        description: newExam.description || null,
        password: newExam.password,
        testType: newExam.testType,
        medium: newExam.medium,
        calculatorType: newExam.calculatorType,
        instructionId: newExam.instructionId || null,
        sections: newExam.sections,
        totalQuestions: newExam.totalQuestions,
        totalMarks: newExam.totalMarks,
        duration: newExam.duration,
        startTime: newExam.startTime || null,
        endTime: newExam.endTime || null,
        autoPublishAt: newExam.autoPublishAt || null,
        status: newExam.status,
        createdBy: newExam.createdBy || null,
        copiedFrom: refExamId,
        copiedCount,
        sectionMapping: Object.fromEntries(sectionIdMap)
      }
    });
  } catch (err) {
    await session.abortTransaction();
    if (err.httpStatus) {
      return res.status(err.httpStatus).json({ status: false, message: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ status: false, message: 'Duplicate examCode or examId' });
    }
    return next(err);
  } finally {
    session.endSession();
  }
};

const addGrace = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);
    const questionId = safeTrim(req.body?.questionId);
    const sectionId = safeTrim(req.body?.sectionId) || null;
    const graceMarks = toNum(req.body?.graceMarks);
    const note = safeTrim(req.body?.note) || null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!questionId) return res.status(400).json({ status: false, message: 'questionId is required' });
    if (graceMarks <= 0) {
      return res.status(400).json({ status: false, message: 'graceMarks must be > 0' });
    }
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false });
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const question = await MockExamQns.findOne({ tenantId, examId, questionId, isdeleted: false }, { questionId: 1, sectionId: 1, positiveMarks: 1, negativeMarks: 1 }).lean();
    if (!question) {
      return res.status(404).json({ status: false, message: 'Question not found in this exam' });
    }
    const graceId = `grace_q_${questionId}`;
    const newGrace = {
      graceId,
      questionId,
      sectionId: sectionId || safeTrim(question.sectionId) || null,
      graceMarks,
      appliedAt: Date.now(),
      appliedBy: userId || null,
      note,
      isActive: true
    };
    const idx = exam.graces.findIndex((g) => g.graceId === graceId);
    if (idx >= 0) exam.graces[idx] = newGrace;
    else exam.graces.push(newGrace);
    exam.updatedBy = userId || null;
    await exam.save();
    return res.status(200).json({
      status: true,
      message: 'Grace added successfully. Run reevaluate to apply to scores.',
      data: {
        graceId,
        questionId,
        sectionId: newGrace.sectionId,
        graceMarks,
        note,
        appliedAt: newGrace.appliedAt
      }
    });
  } catch (err) {
    return next(err);
  }
};

const removeGrace = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const graceId = safeTrim(req.body?.graceId);
    const userId = pickUid(req);
    if (!tenantId || !examId || !graceId) {
      return res.status(400).json({ status: false, message: 'tenantId, examId, graceId are required' });
    }
    const updated = await MockExam.findOneAndUpdate(
      { tenantId, examId, isdeleted: false },
      {
        $set: {
          'graces.$[g].isActive': false,
          updatedBy: userId || null
        }
      },
      { arrayFilters: [{ 'g.graceId': graceId }], new: true }
    ).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Exam or grace not found' });
    return res.status(200).json({
      status: true,
      message: 'Grace removed. Run reevaluate to reflect changes in scores.'
    });
  } catch (err) {
    return next(err);
  }
};

const reevaluate = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    const note = safeTrim(req.body?.note) || null;
    const doneAt = Date.now();
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false });
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const resultCount = await _recomputeResults(tenantId, examId, exam, userId, 'reevaluate', doneAt, note, false);
    await MockExam.findOneAndUpdate(
      { tenantId, examId, isdeleted: false },
      {
        $set: {
          status: 'result_published',
          resultPublishedAt: exam.resultPublishedAt || doneAt,
          resultPublishedBy: exam.resultPublishedBy || userId || null,
          updatedBy: userId || null
        },
        $push: {
          reevaluateLogs: {
            reevaluatedAt: doneAt,
            reevaluatedBy: userId || null,
            note
          }
        }
      }
    );
    return res.status(200).json({
      status: true,
      message: `Reevaluation complete — ${resultCount} student result(s) recomputed and visible`,
      data: {
        examId,
        reevaluatedAt: doneAt,
        resultCount
      }
    });
  } catch (err) {
    return next(err);
  }
};

const bulkUploadHistorical = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tenantId = pickTid(req);
    const userId = safeTrim(req.body?.userId || '');
    const examCode = safeTrim(req.body?.examCode);
    const examName = safeTrim(req.body?.examName);
    const totalMarks = toNum(req.body?.totalMarks) || 0;
    const totalQuestions = toNum(req.body?.totalQuestions) || 0;
    const duration = toNum(req.body?.duration) || 0;
    const startTime = req.body?.startTime ? toNum(req.body.startTime) : null;
    const endTime = req.body?.endTime ? toNum(req.body.endTime) : null;
    const description = safeTrim(req.body?.description || '');
    const password = safeTrim(req.body?.password || '') || 'historical';
    const sectionsIn = Array.isArray(req.body?.sections) ? req.body.sections : [];
    const students = Array.isArray(req.body?.students) ? req.body.students : [];
    const classNo = req.body?.classNo ? toNum(req.body.classNo) : null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examCode) return res.status(400).json({ status: false, message: 'examCode is required' });
    if (!examName) return res.status(400).json({ status: false, message: 'examName is required' });
    if (!sectionsIn.length) return res.status(400).json({ status: false, message: 'sections[] is required' });
    if (!students.length) return res.status(400).json({ status: false, message: 'students[] is required' });
    if (!totalMarks) return res.status(400).json({ status: false, message: 'totalMarks is required' });
    if (classNo !== null && !isValidClassNo(classNo)) {
      return res.status(400).json({ status: false, message: 'classNo must be between 6 and 13' });
    }
    const dupExam = await MockExam.findOne({ tenantId, examCode, isdeleted: false }, { examId: 1 }).session(session).lean();
    if (dupExam) {
      await session.abortTransaction();
      return res.status(409).json({
        status: false,
        message: `Exam with examCode "${examCode}" already exists`
      });
    }
    const sections = sectionsIn.map((s, idx) => {
      const sectionId = safeTrim(s.sectionId) || uuid();
      if (!safeTrim(s.sectionCode)) throw Object.assign(new Error(`Section ${idx + 1}: sectionCode is required`), { httpStatus: 400 });
      if (!safeTrim(s.sectionName)) throw Object.assign(new Error(`Section ${idx + 1}: sectionName is required`), { httpStatus: 400 });
      if (!s.subjectId) throw Object.assign(new Error(`Section ${idx + 1}: subjectId is required`), { httpStatus: 400 });
      return {
        sectionId,
        sectionCode: safeTrim(s.sectionCode),
        sectionName: safeTrim(s.sectionName),
        subjectId: new mongoose.Types.ObjectId(String(s.subjectId)),
        numberOfQuestions: toNum(s.numberOfQuestions) || 0,
        sortOrder: toNum(s.sortOrder) || idx,
        status: 'active'
      };
    });
    const secMap = new Map(sections.map((s) => [s.sectionId, s]));
    for (const s of students) {
      const srs = Array.isArray(s.sectionResults) ? s.sectionResults : [];
      for (const sr of srs) {
        const sid = safeTrim(sr.sectionId);
        if (!secMap.has(sid)) {
          await session.abortTransaction();
          return res.status(400).json({
            status: false,
            message: `sectionId "${sid}" not found in sections (admissionNo: ${s.admissionNo})`
          });
        }
      }
    }
    const newExamId = uuid();
    const now = Date.now();
    const [newExam] = await MockExam.create(
      [
        {
          tenantId,
          examId: newExamId,
          examCode,
          examName,
          description: description || null,
          password,
          testType: 'practice',
          medium: 'en',
          calculatorType: 'none',
          sections,
          totalQuestions,
          totalMarks,
          duration,
          startTime,
          endTime,
          classNo,
          autoPublishAt: null,
          resultPublishedAt: now,
          resultPublishedBy: userId || null,
          status: 'result_published',
          graces: [],
          publishLogs: [
            {
              action: 'publish',
              publishedAt: now,
              publishedBy: userId || null,
              note: 'Historical exam bulk upload'
            }
          ],
          reevaluateLogs: [],
          isImported: true,
          isdeleted: false,
          createdBy: userId || null,
          updatedBy: userId || null
        }
      ],
      { session }
    );
    const incomingAdmNos = students.map((s) => safeTrim(s.admissionNo)).filter(Boolean);
    const seen = new Set();
    const dupes = [];
    for (const no of incomingAdmNos) {
      if (seen.has(no)) dupes.push(no);
      else seen.add(no);
    }
    if (dupes.length) {
      await session.abortTransaction();
      return res.status(400).json({
        status: false,
        message: 'Duplicate admissionNo(s) in students payload',
        duplicates: dupes
      });
    }
    const profiles = await StudentProfile.find({ tenantId, admissionNo: { $in: incomingAdmNos }, isdeleted: false }, { admissionNo: 1, studentId: 1, batchId: 1, centerId: 1, classNo: 1 })
      .session(session)
      .lean();
    const profileMap = new Map(profiles.map((p) => [safeTrim(p.admissionNo), p]));
    const validStudents = [];
    const notFoundErrors = [];
    for (const s of students) {
      const admNo = safeTrim(s.admissionNo);
      if (!admNo) continue;
      const profile = profileMap.get(admNo);
      if (!profile) {
        notFoundErrors.push({ admissionNo: admNo, message: 'Student not found in profiles' });
        continue;
      }
      validStudents.push({ ...s, _profile: profile });
    }
    const nullableNum = (v) => (v !== null && v !== undefined ? toNum(v) : null);
    const resultDocs = validStudents.map((s) => {
      const admNo = safeTrim(s.admissionNo);
      const profile = s._profile;
      const secResults = (Array.isArray(s.sectionResults) ? s.sectionResults : []).map((sr) => {
        const sid = safeTrim(sr.sectionId);
        const secMeta = secMap.get(sid) || {};
        return {
          sectionId: sid,
          subjectId: secMeta.subjectId || null,
          totalMarks: toNum(sr.totalMarks) || 0,
          totalQuestions: toNum(sr.totalQuestions) || 0,
          answeredCount: nullableNum(sr.answeredCount),
          correctCount: nullableNum(sr.correctCount),
          wrongCount: nullableNum(sr.wrongCount),
          skippedCount: nullableNum(sr.skippedCount),
          obtainedMarks: toNum(sr.obtainedMarks) || 0,
          timeTaken: toNum(sr.timeTaken) || 0
        };
      });
      const obtainedMarks = toNum(s.obtainedMarks) || 0;
      const totalQs = secResults.reduce((sum, sr) => sum + (sr.totalQuestions ?? 0), 0) || 0;
      const nullableSum = (field) => {
        const hasAny = secResults.some((sr) => sr[field] !== null && sr[field] !== undefined);
        if (!hasAny) return null;
        return secResults.reduce((sum, sr) => sum + (sr[field] ?? 0), 0);
      };
      const correctCount = nullableSum('correctCount');
      const wrongCount = nullableSum('wrongCount');
      const skippedCount = nullableSum('skippedCount');
      const answeredCount = nullableSum('answeredCount');
      return {
        tenantId,
        examId: newExamId,
        admissionNo: admNo,
        studentId: safeTrim(profile.studentId) || null,
        batchId: safeTrim(s.batchId) || null,
        centerId: safeTrim(s.centerId) || safeTrim(profile.centerId) || null,
        classNo: s.classNo ? toNum(s.classNo) : profile.classNo || null,
        obtainedMarks,
        totalMarks,
        sectionResults: secResults,
        answers: [],
        totalQuestions: totalQs,
        correctCount,
        wrongCount,
        skippedCount,
        answeredCount,
        startedAt: s.startedAt ? toNum(s.startedAt) : null,
        completedAt: s.completedAt ? toNum(s.completedAt) : now,
        timeTaken: s.timeTaken ? toNum(s.timeTaken) : 0,
        isLate: s.isLate === true,
        rank: null,
        percentile: null,
        status: 'result_published',
        isResultVisible: true,
        isImported: true,
        graceLogs: [],
        publishHistory: [
          {
            action: 'publish',
            publishedAt: now,
            publishedBy: userId || null,
            obtainedMarksBefore: null,
            obtainedMarksAfter: obtainedMarks,
            rankBefore: null,
            rankAfter: null,
            note: 'Historical bulk upload'
          }
        ],
        isdeleted: false,
        createdBy: userId || null,
        updatedBy: userId || null
      };
    });
    let insertedCount = 0;
    if (resultDocs.length) {
      const inserted = await MockExamResult.insertMany(resultDocs, { session, ordered: false });
      insertedCount = inserted.length;
    }
    await session.commitTransaction();
    return res.status(201).json({
      status: true,
      message: `Historical exam created and ${insertedCount} result(s) uploaded`,
      data: {
        examId: newExamId,
        examCode: newExam.examCode,
        examName: newExam.examName,
        status: newExam.status,
        totalStudents: students.length,
        insertedCount,
        skippedCount: notFoundErrors.length,
        errors: notFoundErrors.length ? notFoundErrors : undefined
      }
    });
  } catch (err) {
    await session.abortTransaction();
    if (err.httpStatus) {
      return res.status(err.httpStatus).json({ status: false, message: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ status: false, message: 'Duplicate examCode or result already exists' });
    }
    return next(err);
  } finally {
    session.endSession();
  }
};

const getNextExamCode = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const examCode = await generateExamCode(tenantId);
    return res.status(200).json({ status: true, examCode });
  } catch (err) {
    return next(err);
  }
};

const disableExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const doc = await MockExam.findOneAndUpdate({ tenantId, examId, isdeleted: false, status: { $ne: 'disabled' } }, { $set: { previousStatus: null } }, { new: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Exam not found or already disabled' });
    const updated = await MockExam.findOneAndUpdate({ tenantId, examId, isdeleted: false }, { $set: { status: 'disabled', previousStatus: doc.status, updatedBy: userId || null } }, { new: true }).lean();
    return res.status(200).json({ status: true, message: 'Exam disabled successfully', data: { examId, status: 'disabled', previousStatus: doc.status } });
  } catch (err) {
    return next(err);
  }
};

const enableExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false, status: 'disabled' }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found or not disabled' });
    const restoreStatus = safeTrim(exam.previousStatus) || 'published';
    const doc = await MockExam.findOneAndUpdate({ tenantId, examId, isdeleted: false }, { $set: { status: restoreStatus, previousStatus: null, updatedBy: userId || null } }, { new: true }).lean();
    return res.status(200).json({ status: true, message: `Exam enabled as ${restoreStatus}`, data: { examId, status: restoreStatus } });
  } catch (err) {
    return next(err);
  }
};

const deleteimportExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const userId = pickUid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    const doc = await MockExam.findOneAndUpdate({ tenantId, examId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Exam not found or already deleted' });
    await MockExamResult.updateMany({ tenantId, examId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } });

    return res.status(200).json({ status: true, message: 'Exam and results deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

export default {
  createExam,
  updateExam,
  listExams,
  getExam,
  deleteExam,
  publishExam,
  publishResult,
  checkAndAutoPublish,
  listExamsForStudent,
  duplicateExam,
  addGrace,
  removeGrace,
  reevaluate,
  bulkUploadHistorical,
  getNextExamCode,
  disableExam,
  enableExam,
  deleteimportExam
};
