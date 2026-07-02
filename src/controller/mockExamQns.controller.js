import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import logger from '../helpers/logger.js';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3Client from '../middlewares/s3config.js';
import MockExamQns from '../models/mockExamQns.model.js';
import MockExam from '../models/mockExam.model.js';
import ExamPassage from '../models/passage.model.js';
import Counter from '../models/counter.model.js';
import Subject from '../models/subject.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const toNum = (v, def = 0) => {
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : def;
};
const pickTid = (req) => safeTrim(req.body?.entiId || req.body?.tenantId);
const pickUid = (req) => safeTrim(req.body?.userId || req.user?.userId);
const mustObjId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));
const uuid = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));

const isValidClassNo = (n) => {
  const v = toNum(n);
  return Number.isFinite(v) && v >= 6 && v <= 13;
};

const BUCKET = process.env.AWS_S3_QUESTION_BUCKET;
const REGION = process.env.AWS_REGION || 'ap-south-1';
const ALLOWED_TYPES = new Set(['mcq_single', 'mcq_multi', 'true_false', 'short_answer', 'integer', 'subjective', 'numeric', 'passage_qns', 'matrix']);
const ALLOWED_DIFF = new Set(['easy', 'medium', 'hard']);

function buildImageKey(name) {
  const ext = path.extname(name) || '';
  const base = path
    .basename(name, ext)
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '');
  return `mockexam/questions/${base}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
}
function extractKey(input) {
  if (!input) return '';
  const raw = String(input);
  if (!raw.startsWith('http')) return raw.replace(/^\/+/, '');
  try {
    return new URL(raw).pathname.replace(/^\/+/, '');
  } catch {
    return '';
  }
}
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter((i) => i?.url).map((i, idx) => ({ url: safeTrim(i.url), label: safeTrim(i.label), order: typeof i.order === 'number' ? i.order : idx }));
}
function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((o) => ({
    key: safeTrim(o?.key) || null,
    textHtml: o?.textHtml == null ? '' : String(o.textHtml),
    images: normalizeImages(o?.images),
    isCorrect: o?.isCorrect === true || String(o?.isCorrect).toLowerCase() === 'true',
    partialMark: toNum(o?.partialMark, 0)
  }));
}
function normalizeColumns(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((c) => c?.key || c?.text)
    .map((c) => ({
      key: safeTrim(c.key || ''),
      text: safeTrim(c.text || '')
    }));
}

function needsOptions(qt) {
  return ['mcq_single', 'mcq_multi'].includes(qt);
}

function needsOneCorrect(qt) {
  return ['mcq_single', 'true_false'].includes(qt);
}

function validateQDoc(d, label) {
  if (!d.tenantId) return `${label}: tenantId required`;
  if (d.examId && !d.sectionId) return `${label}: sectionId required when examId is set`;
  if (!ALLOWED_TYPES.has(d.questionType)) return `${label}: invalid questionType`;
  if (!ALLOWED_DIFF.has(d.difficulty)) return `${label}: invalid difficulty`;
  if (needsOptions(d.questionType)) {
    if (!d.questionOptions?.length) return `${label}: questionOptions required for ${d.questionType}`;
    if (needsOneCorrect(d.questionType) && !d.questionOptions.some((o) => o.isCorrect)) return `${label}: at least one correct option required`;
  }
  if (d.questionType === 'numeric' && d.numericMin != null && d.numericMax != null && d.numericMin > d.numericMax) return `${label}: numericMin must be <= numericMax`;
  if (d.questionType === 'matrix') {
    if (!d.leftColumn?.length) return `${label}: leftColumn is required for matrix`;
    if (!d.rightColumn?.length) return `${label}: rightColumn is required for matrix`;
  }
  return null;
}

const generateQuestionNo = async (tenantId, subjectId) => {
  let subjectPrefix = 'GEN';
  if (subjectId) {
    const subjectDoc = await Subject.findOne({ _id: subjectId, isdeleted: false }, { subjectCode: 1 }).lean();
    if (subjectDoc?.subjectCode) {
      subjectPrefix = safeTrim(subjectDoc.subjectCode)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 3)
        .padEnd(3, 'X');
    }
  }
  const counterKey = `questionNo_${subjectPrefix}`;
  const doc = await Counter.findOneAndUpdate(
    { tenantId, key: counterKey },
    {
      $inc: { seq: 1 },
      $setOnInsert: { tenantId, key: counterKey }
    },
    { new: true, upsert: true }
  );
  return `Q${subjectPrefix}${String(doc.seq).padStart(5, '0')}`;
};

// ─── UPLOAD IMAGE ─────────────────────────────────────────────────────────────
const uploadImage = async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ status: false, message: 'No files uploaded' });
    if (!BUCKET) return res.status(500).json({ status: false, message: 'S3 bucket not configured' });
    const base = `${req.protocol}://${req.get('host')}`;
    const files = await Promise.all(
      req.files.map(async (f) => {
        const key = buildImageKey(f.originalname);
        await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: f.buffer, ContentType: f.mimetype }));
        return { key, s3Url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`, url: `${base}/mockexamqns/image?key=${encodeURIComponent(key)}`, fileName: f.originalname };
      })
    );
    return res.status(201).json({ status: true, message: 'Images uploaded successfully', files });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message || 'Upload failed' });
  }
};

// ─── GET IMAGE ────────────────────────────────────────────────────────────────
const getImage = async (req, res) => {
  try {
    const key = extractKey(req.query?.url || req.body?.url || '');
    if (!key) return res.status(400).json({ status: false, message: 'key is required' });
    if (!BUCKET) return res.status(500).json({ status: false, message: 'S3 bucket not configured' });
    const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 1800 });
    return res.status(200).json({ status: true, url });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message || 'Failed to fetch image' });
  }
};

// ─── CREATE SINGLE QUESTION ───────────────────────────────────────────────────
const createQuestion = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);
    const sectionId = safeTrim(req.body?.sectionId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!sectionId) return res.status(400).json({ status: false, message: 'sectionId is required' });
    // const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { 'sections.sectionId': 1, 'sections.subjectId': 1 }).lean();
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { 'sections.sectionId': 1, 'sections.subjectId': 1, 'sections.numberOfQuestions': 1, 'sections.sectionName': 1, totalQuestions: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const section = (exam.sections || []).find((s) => safeTrim(s.sectionId) === sectionId);
    if (!section) return res.status(400).json({ status: false, message: 'sectionId not found in this exam' });
    const sectionLimit = toNum(section.numberOfQuestions);
    if (sectionLimit > 0) {
      const currentSectionCount = await MockExamQns.countDocuments({
        tenantId,
        examId,
        sectionId,
        isdeleted: false
      });
      if (currentSectionCount >= sectionLimit) {
        return res.status(400).json({
          status: false,
          message: `Section "${section.sectionName}" is already at its question limit (${sectionLimit})`
        });
      }
    }
    const examData = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { totalQuestions: 1 }).lean();
    const examLimit = toNum(examData?.totalQuestions);
    if (examLimit > 0) {
      const currentTotalCount = await MockExamQns.countDocuments({
        tenantId,
        examId,
        isdeleted: false
      });
      if (currentTotalCount >= examLimit) {
        return res.status(400).json({
          status: false,
          message: `Exam is already at its total question limit (${examLimit})`
        });
      }
    }
    const subjectIdRaw = req.body?.subjectId || section.subjectId;
    if (!subjectIdRaw || !mustObjId(subjectIdRaw)) return res.status(400).json({ status: false, message: 'subjectId is required' });
    if (req.body?.passageId && !mustObjId(req.body.passageId)) return res.status(400).json({ status: false, message: 'Invalid passageId' });
    const qt = safeTrim(req.body?.questionType).toLowerCase();
    const diff = safeTrim(req.body?.difficulty || 'medium').toLowerCase();
    const opts = normalizeOptions(req.body?.questionOptions);
    const questionNo = await generateQuestionNo(tenantId, subjectIdRaw);
    const qt_check = safeTrim(req.body?.questionType).toLowerCase();
    const doc = {
      tenantId,
      examId,
      sectionId,
      questionNo,
      subjectId: new mongoose.Types.ObjectId(String(subjectIdRaw)),
      questionId: safeTrim(req.body?.questionId) || uuid(),
      topicId: safeTrim(req.body?.topicId) || null,
      subTopicId: safeTrim(req.body?.subTopicId) || null,
      questionType: qt,
      difficulty: diff,
      images: normalizeImages(req.body?.images),
      positiveMarks: toNum(req.body?.positiveMarks),
      negativeMarks: toNum(req.body?.negativeMarks),
      // hasPartialMarking: req.body?.hasPartialMarking === true,
      hasPartialMarking: qt_check === 'matrix' ? true : req.body?.hasPartialMarking === true,
      numericMin: req.body?.numericMin != null ? toNum(req.body.numericMin) : null,
      numericMax: req.body?.numericMax != null ? toNum(req.body.numericMax) : null,
      questionHtml: req.body?.questionHtml ?? '',
      passageHtml: req.body?.passageHtml ?? '',
      instructionHtml: req.body?.instructionHtml ?? '',
      solutionHtml: req.body?.solutionHtml ?? '',
      passageId: req.body?.passageId ? new mongoose.Types.ObjectId(String(req.body.passageId)) : null,
      enablePassage: req.body?.enablePassage === true,
      enableInstruction: req.body?.enableInstruction === true,
      enableSolution: req.body?.enableSolution === true,
      leftColumn: normalizeColumns(req.body?.leftColumn),
      rightColumn: normalizeColumns(req.body?.rightColumn),
      questionOptions: opts,
      correctAnswer: String(req.body?.correctAnswer || ''),
      classNo: toNum(exam.classNo) || null,
      tags: Array.isArray(req.body?.tags) ? req.body.tags.map(safeTrim).filter(Boolean) : [],
      sortOrder: toNum(req.body?.sortOrder),
      status: safeTrim(req.body?.status) || 'active',
      isdeleted: false,
      createdBy: userId,
      updatedBy: userId
    };
    const err = validateQDoc(doc, 'Question');
    if (err) return res.status(400).json({ status: false, message: err });
    const created = await MockExamQns.create(doc);
    return res.status(201).json({ status: true, message: 'Question created successfully', data: created });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate question (examId + questionId already exists)' });
    return next(err);
  }
};

// ─── BULK CREATE QUESTIONS ────────────────────────────────────────────────────
const createQuestionsBulk = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);
    const sectionId = safeTrim(req.body?.sectionId);
    const payload = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!sectionId) return res.status(400).json({ status: false, message: 'sectionId is required' });
    if (!payload.length) return res.status(400).json({ status: false, message: 'questions[] must be non-empty' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { 'sections.sectionId': 1, 'sections.subjectId': 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const section = (exam.sections || []).find((s) => safeTrim(s.sectionId) === sectionId);
    if (!section) return res.status(400).json({ status: false, message: 'sectionId not found in this exam' });
    const secSubjectId = section.subjectId ? new mongoose.Types.ObjectId(String(section.subjectId)) : null;
    const incomingIds = payload.map((q) => safeTrim(q?.questionId)).filter(Boolean);
    if (incomingIds.length) {
      const existing = await MockExamQns.find({ tenantId, examId, questionId: { $in: incomingIds }, isdeleted: false }, { questionId: 1, _id: 0 }).lean();
      if (existing.length) return res.status(409).json({ status: false, message: 'Duplicate questionIds found', conflicts: existing.map((e) => e.questionId) });
    }
    const docs = payload.map((q, idx) => {
      const qt = safeTrim(q?.questionType).toLowerCase();
      const subjectRaw = q?.subjectId || secSubjectId;
      return {
        tenantId,
        examId,
        sectionId,
        subjectId: subjectRaw ? new mongoose.Types.ObjectId(String(subjectRaw)) : null,
        questionId: safeTrim(q?.questionId) || uuid(),
        topicId: safeTrim(q?.topicId) || null,
        subTopicId: safeTrim(q?.subTopicId) || null,
        questionType: qt,
        difficulty: safeTrim(q?.difficulty || 'medium').toLowerCase(),
        images: normalizeImages(q?.images),
        positiveMarks: toNum(q?.positiveMarks),
        negativeMarks: toNum(q?.negativeMarks),
        hasPartialMarking: q?.hasPartialMarking === true,
        numericMin: q?.numericMin != null ? toNum(q.numericMin) : null,
        numericMax: q?.numericMax != null ? toNum(q.numericMax) : null,
        questionHtml: q?.questionHtml ?? '',
        passageHtml: q?.passageHtml ?? '',
        instructionHtml: q?.instructionHtml ?? '',
        solutionHtml: q?.solutionHtml ?? '',
        passageId: q?.passageId && mustObjId(q.passageId) ? new mongoose.Types.ObjectId(String(q.passageId)) : null,
        enablePassage: q?.enablePassage === true,
        enableInstruction: q?.enableInstruction === true,
        enableSolution: q?.enableSolution === true,
        questionOptions: normalizeOptions(q?.questionOptions),
        leftColumn: normalizeColumns(q.leftColumn || []),
        rightColumn: normalizeColumns(q.rightColumn || []),
        correctAnswer: String(q?.correctAnswer || ''),
        tags: Array.isArray(q?.tags) ? q.tags.map(safeTrim).filter(Boolean) : [],
        sortOrder: toNum(q?.sortOrder, idx),
        status: safeTrim(q?.status) || 'active',
        classNo: toNum(exam.classNo) || null,
        isdeleted: false,
        createdBy: userId,
        updatedBy: userId
      };
    });
    for (let i = 0; i < docs.length; i++) {
      const e = validateQDoc(docs[i], `Row ${i + 1}`);
      if (e) return res.status(400).json({ status: false, message: e });
    }
    const inserted = await MockExamQns.insertMany(docs, { ordered: true });
    return res.status(201).json({ status: true, message: 'Questions created successfully', insertedCount: inserted.length, data: inserted });
  } catch (err) {
    return next(err);
  }
};

// ─── UPDATE QUESTION ──────────────────────────────────────────────────────────
const updateQuestion = async (req, res, next) => {
  try {
    const recId = safeTrim(req.body?.recId);
    const userId = pickUid(req);
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const existing = await MockExamQns.findOne({ _id: recId, isdeleted: false });
    if (!existing) return res.status(404).json({ status: false, message: 'Question not found' });
    const set = {};
    const strFields = ['questionType', 'difficulty', 'questionHtml', 'passageHtml', 'instructionHtml', 'solutionHtml', 'correctAnswer', 'status'];
    for (const f of strFields) {
      if (req.body?.[f] !== undefined) {
        if (f === 'questionType') set.questionType = safeTrim(req.body[f]).toLowerCase();
        else if (f === 'difficulty') set.difficulty = safeTrim(req.body[f]).toLowerCase();
        else set[f] = req.body[f];
      }
    }
    const numFields = ['positiveMarks', 'negativeMarks', 'sortOrder'];
    for (const f of numFields) {
      if (req.body?.[f] !== undefined) set[f] = toNum(req.body[f]);
    }
    // const boolFields = ['hasPartialMarking', 'enablePassage', 'enableInstruction', 'enableSolution'];
    // for (const f of boolFields) {
    //   if (req.body?.[f] !== undefined) set[f] = req.body[f] === true;
    // }
    const boolFields = ['enablePassage', 'enableInstruction', 'enableSolution'];
    for (const f of boolFields) {
      if (req.body?.[f] !== undefined) set[f] = req.body[f] === true;
    }
    if (req.body?.hasPartialMarking !== undefined) {
      const finalType = safeTrim(set.questionType || existing.questionType).toLowerCase();
      set.hasPartialMarking = finalType === 'matrix' ? true : req.body.hasPartialMarking === true;
    }
    if (req.body?.numericMin !== undefined) set.numericMin = req.body.numericMin != null ? toNum(req.body.numericMin) : null;
    if (req.body?.numericMax !== undefined) set.numericMax = req.body.numericMax != null ? toNum(req.body.numericMax) : null;
    if (Array.isArray(req.body?.images)) set.images = normalizeImages(req.body.images);
    if (Array.isArray(req.body?.questionOptions)) set.questionOptions = normalizeOptions(req.body.questionOptions);
    if (Array.isArray(req.body?.tags)) set.tags = req.body.tags.map(safeTrim).filter(Boolean);
    if (Array.isArray(req.body?.leftColumn)) set.leftColumn = normalizeColumns(req.body.leftColumn);
    if (Array.isArray(req.body?.rightColumn)) set.rightColumn = normalizeColumns(req.body.rightColumn);
    if (req.body?.passageId !== undefined) {
      if (req.body.passageId && !mustObjId(req.body.passageId)) return res.status(400).json({ status: false, message: 'Invalid passageId' });
      set.passageId = req.body.passageId ? new mongoose.Types.ObjectId(String(req.body.passageId)) : null;
      set.passageHtml = set.passageId ? '' : (set.passageHtml ?? existing.passageHtml); // clear inline if passageId set
    }
    const finalType = safeTrim(set.questionType || existing.questionType).toLowerCase();
    const finalOpts = set.questionOptions || existing.questionOptions || [];
    if (needsOptions(finalType)) {
      if (!finalOpts.length) return res.status(400).json({ status: false, message: `questionOptions required for ${finalType}` });
      if (needsOneCorrect(finalType) && !finalOpts.some((o) => o.isCorrect)) return res.status(400).json({ status: false, message: 'At least one correct option required' });
    }
    set.updatedBy = userId;
    const updated = await MockExamQns.findOneAndUpdate({ _id: recId, isdeleted: false }, { $set: set }, { new: true }).lean();
    return res.status(200).json({ status: true, message: 'Question updated successfully', data: updated });
  } catch (err) {
    return next(err);
  }
};

// ─── DELETE QUESTION ──────────────────────────────────────────────────────────
const deleteQuestion = async (req, res, next) => {
  try {
    const recId = safeTrim(req.body?.recId);
    const userId = pickUid(req);
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const updated = await MockExamQns.findOneAndUpdate({ _id: recId, isdeleted: false }, { $set: { isdeleted: true, status: 'inactive', updatedBy: userId } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Question not found or already deleted' });
    return res.status(200).json({ status: true, message: 'Question deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

// ─── BULK DELETE BY SECTION ───────────────────────────────────────────────────
const bulkDeleteBySection = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const sectionId = safeTrim(req.body?.sectionId);
    const userId = pickUid(req);
    if (!tenantId || !examId || !sectionId) return res.status(400).json({ status: false, message: 'tenantId, examId, sectionId are required' });
    const result = await MockExamQns.updateMany({ tenantId, examId, sectionId, isdeleted: false }, { $set: { isdeleted: true, status: 'inactive', updatedBy: userId } });
    return res.status(200).json({ status: true, message: 'Bulk delete successful', matchedCount: result.matchedCount, modifiedCount: result.modifiedCount });
  } catch (err) {
    return next(err);
  }
};

// ─── LIST BY SECTION ──────────────────────────────────────────────────────────
const listQuestionsBySection = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const sectionId = safeTrim(req.body?.sectionId);
    if (!tenantId || !examId || !sectionId) return res.status(400).json({ status: false, message: 'tenantId, examId are required' });
    const query = { tenantId, examId, sectionId, isdeleted: false };
    if (req.body?.difficulty) query.difficulty = safeTrim(req.body.difficulty).toLowerCase();
    if (req.body?.questionType) query.questionType = safeTrim(req.body.questionType).toLowerCase();
    if (req.body?.status) query.status = safeTrim(req.body.status);
    if (req.body?.subjectId && mustObjId(req.body.subjectId)) query.subjectId = new mongoose.Types.ObjectId(String(req.body.subjectId));
    const questions = await MockExamQns.find(query).sort({ sortOrder: 1 }).lean();
    return res.status(200).json({ status: true, data: questions, count: questions.length });
  } catch (err) {
    return next(err);
  }
};

// ─── GET QUESTIONS BY EXAM (password protected) ───────────────────────────────
const getQuestionsByExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const examQuery = { tenantId, isdeleted: false, examId };
    const exam = await MockExam.findOne(examQuery).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const questions = await MockExamQns.find({ tenantId, examId: exam.examId, isdeleted: false, status: 'active' }, {}).sort({ sectionId: 1, sortOrder: 1 }).populate('subjectId', 'subjectName subjectCode').lean();
    const passageIds = [...new Set(questions.filter((q) => q.passageId).map((q) => String(q.passageId)))];
    let passageMap = new Map();
    if (passageIds.length) {
      const passages = await ExamPassage.find({ _id: { $in: passageIds }, isdeleted: false }, { passageHtml: 1, title: 1 }).lean();
      passageMap = new Map(passages.map((p) => [String(p._id), p]));
    }
    const enriched = questions.map((q) => ({
      ...q,
      passageData: q.passageId ? passageMap.get(String(q.passageId)) || null : null
    }));
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    const grouped = {};
    for (const q of enriched) {
      const sid = safeTrim(q.sectionId);
      if (!grouped[sid]) {
        const sec = secMap.get(sid) || {};
        grouped[sid] = { sectionId: sid, sectionCode: sec.sectionCode || sid, sectionName: sec.sectionName || sid, subjectId: sec.subjectId || null, sortOrder: sec.sortOrder || 0, questions: [] };
      }
      grouped[sid].questions.push(q);
    }
    const sections = Object.values(grouped).sort((a, b) => a.sortOrder - b.sortOrder);
    return res.status(200).json({
      status: true,
      message: 'Questions loaded',
      data: {
        examId: exam.examId,
        examCode: exam.examCode,
        examName: exam.examName,
        duration: exam.duration,
        totalMarks: exam.totalMarks,
        totalQuestions: exam.totalQuestions,
        startTime: exam.startTime,
        endTime: exam.endTime,
        calculatorType: exam.calculatorType,
        questions: enriched
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getQuestionsByCode = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const examCode = safeTrim(req.body?.examCode);
    const password = safeTrim(req.body?.password);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId && !examCode) return res.status(400).json({ status: false, message: 'examId or examCode is required' });
    if (!password) return res.status(400).json({ status: false, message: 'password is required' });
    const examQuery = { tenantId, isdeleted: false, ...(examId ? { examId } : { examCode }) };
    const exam = await MockExam.findOne(examQuery).populate('instructionId', 'title contentHtml language').lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    if (safeTrim(exam.password) !== password) return res.status(401).json({ status: false, message: 'Invalid password' });
    const now = Date.now();
    if (exam.startTime && now < exam.startTime) return res.status(403).json({ status: false, message: 'Exam has not started yet' });
    if (exam.endTime && now > exam.endTime) return res.status(403).json({ status: false, message: 'Exam window has closed' });
    const questions = await MockExamQns.find({ tenantId, examId: exam.examId, isdeleted: false, status: 'active' }, { solutionHtml: 0, correctAnswer: 0, 'questionOptions.isCorrect': 0, 'questionOptions.partialMark': 0 })
      .sort({ sectionId: 1, sortOrder: 1 })
      .populate('subjectId', 'subjectName subjectCode')
      .lean();
    const passageIds = [...new Set(questions.filter((q) => q.passageId).map((q) => String(q.passageId)))];
    let passageMap = new Map();
    if (passageIds.length) {
      const passages = await ExamPassage.find({ _id: { $in: passageIds }, isdeleted: false }, { passageHtml: 1, title: 1 }).lean();
      passageMap = new Map(passages.map((p) => [String(p._id), p]));
    }
    const enriched = questions.map((q) => ({
      ...q,
      passageData: q.passageId ? passageMap.get(String(q.passageId)) || null : null
    }));
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    const grouped = {};
    for (const q of enriched) {
      const sid = safeTrim(q.sectionId);
      if (!grouped[sid]) {
        const sec = secMap.get(sid) || {};
        grouped[sid] = { sectionId: sid, sectionCode: sec.sectionCode || sid, sectionName: sec.sectionName || sid, subjectId: sec.subjectId || null, sortOrder: sec.sortOrder || 0, questions: [] };
      }
      grouped[sid].questions.push(q);
    }
    const sections = Object.values(grouped).sort((a, b) => a.sortOrder - b.sortOrder);
    return res.status(200).json({
      status: true,
      message: 'Questions loaded',
      data: {
        examId: exam.examId,
        examCode: exam.examCode,
        examName: exam.examName,
        duration: exam.duration,
        totalMarks: exam.totalMarks,
        totalQuestions: exam.totalQuestions,
        startTime: exam.startTime,
        endTime: exam.endTime,
        calculatorType: exam.calculatorType,
        instructions: exam.instructionId,
        sections
      }
    });
  } catch (err) {
    return next(err);
  }
};

// const getExamQuestionsWithAnswers = async (req, res, next) => {
//   try {
//     const tenantId = safeTrim(req.body?.tenantId || req.body?.entiId);
//     const examId = safeTrim(req.body?.examId);
//     const examCode = safeTrim(req.body?.examCode);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
//     if (!examId && !examCode) return res.status(400).json({ status: false, message: 'examId or examCode is required' });
//     const examQuery = { tenantId, isdeleted: false };
//     if (examId) examQuery.examId = examId;
//     else examQuery.examCode = examCode;
//     const exam = await MockExam.findOne(examQuery, { examId: 1, examName: 1, examCode: 1, sections: 1, totalMarks: 1, totalQuestions: 1, duration: 1 }).lean();
//     if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
//     const questions = await MockExamQns.find({ tenantId, examId: exam.examId, isdeleted: false }, { __v: 0 }).sort({ sortOrder: 1 }).lean();
//     return res.status(200).json({
//       status: true,
//       data: {
//         examId: exam.examId,
//         examCode: exam.examCode,
//         examName: exam.examName,
//         totalQuestions: exam.totalQuestions,
//         totalMarks: exam.totalMarks,
//         duration: exam.duration,
//         sections: exam.sections || [],
//         questions,
//         count: questions.length
//       }
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

// ─── VIEW SINGLE QUESTION (admin) ─────────────────────────────────────────────

const getExamQuestionsWithAnswers = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.tenantId || req.body?.entiId);
    const examId = safeTrim(req.body?.examId);
    const examCode = safeTrim(req.body?.examCode);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId && !examCode) return res.status(400).json({ status: false, message: 'examId or examCode is required' });
    const examQuery = { tenantId, isdeleted: false };
    if (examId) examQuery.examId = examId;
    else examQuery.examCode = examCode;
    const exam = await MockExam.findOne(examQuery, {
      examId: 1,
      examName: 1,
      examCode: 1,
      sections: 1,
      totalMarks: 1,
      totalQuestions: 1,
      duration: 1,
      startTime: 1,
      endTime: 1,
      classNo: 1
    }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const questions = await MockExamQns.find({ tenantId, examId: exam.examId, isdeleted: false }, { __v: 0 }).sort({ sectionId: 1, sortOrder: 1 }).populate('subjectId', 'subjectName subjectCode _id').lean();
    const passageIds = [...new Set(questions.filter((q) => q.passageId).map((q) => String(q.passageId)))];
    let passageMap = new Map();
    if (passageIds.length) {
      const passages = await ExamPassage.find({ _id: { $in: passageIds }, isdeleted: false }, { passageHtml: 1, title: 1, language: 1 }).lean();
      passageMap = new Map(passages.map((p) => [String(p._id), p]));
    }
    const enriched = questions.map((q) => {
      const passageData = q.passageId ? passageMap.get(String(q.passageId)) || null : null;
      return {
        ...q,
        passageData: passageData
          ? {
              title: passageData.title || null,
              passageHtml: passageData.passageHtml || null,
              language: passageData.language || null
            }
          : q.enablePassage && q.passageHtml
            ? { title: null, passageHtml: q.passageHtml, language: null }
            : null,
        solutionHtml: q.enableSolution ? q.solutionHtml || null : null,
        instructionHtml: q.enableInstruction ? q.instructionHtml || null : null
      };
    });
    const secMap = new Map((exam.sections || []).map((s) => [safeTrim(s.sectionId), s]));
    const grouped = {};
    for (const q of enriched) {
      const sid = safeTrim(q.sectionId);
      if (!grouped[sid]) {
        const sec = secMap.get(sid) || {};
        grouped[sid] = {
          sectionId: sid,
          sectionCode: sec.sectionCode || sid,
          sectionName: sec.sectionName || sid,
          subjectId: sec.subjectId || null,
          sortOrder: sec.sortOrder || 0,
          questions: []
        };
      }
      grouped[sid].questions.push(q);
    }
    const sections = Object.values(grouped).sort((a, b) => a.sortOrder - b.sortOrder);
    return res.status(200).json({
      status: true,
      data: {
        examId: exam.examId,
        examCode: exam.examCode,
        examName: exam.examName,
        totalQuestions: exam.totalQuestions,
        totalMarks: exam.totalMarks,
        duration: exam.duration,
        startTime: exam.startTime || null,
        endTime: exam.endTime || null,
        classNo: exam.classNo || null,
        sections: exam.sections || [],
        groupedSections: sections,
        questions: enriched,
        count: enriched.length
      }
    });
  } catch (err) {
    return next(err);
  }
};

const viewQuestion = async (req, res, next) => {
  try {
    const recId = safeTrim(req.body?.recId);
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const q = await MockExamQns.findOne({ _id: recId, isdeleted: false }).populate({ path: 'passageId', model: 'exampassage', select: 'title passageHtml language' }).lean();
    if (!q) return res.status(404).json({ status: false, message: 'Question not found' });
    return res.status(200).json({ status: true, message: 'Success', data: q });
  } catch (err) {
    return next(err);
  }
};

// ─── UPDATE SORT ORDER ────────────────────────────────────────────────────────
const updateSortOrder = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const questions = req.body?.questions;
    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ status: false, message: 'questions[] is required' });
    const ops = questions.map((q) => ({
      updateOne: {
        filter: { _id: safeTrim(q.qId), tenantId, examId, isdeleted: false },
        update: { $set: { sortOrder: toNum(q.sortOrder) } }
      }
    }));
    await MockExamQns.bulkWrite(ops, { ordered: false });
    return res.status(200).json({ status: true, message: 'Sort order updated successfully' });
  } catch (err) {
    return next(err);
  }
};

// ─── createQuestionInBank ──────────────────────────────────────────────────────
const createQuestionInBank = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const {
      questionType,
      subjectId,
      topicId,
      subTopicId,
      difficulty,
      positiveMarks,
      negativeMarks,
      hasPartialMarking,
      numericMin,
      numericMax,
      questionHtml,
      passageId,
      passageHtml,
      instructionHtml,
      solutionHtml,
      enablePassage,
      enableInstruction,
      enableSolution,
      correctAnswer,
      questionOptions,
      images,
      tags,
      sortOrder,
      status
    } = req.body;
    const classNo = req.body?.classNo ? toNum(req.body.classNo) : null;
    if (!isValidClassNo(classNo)) {
      return res.status(400).json({ status: false, message: 'classNo must be between 6 and 13' });
    }
    if (!questionType) return res.status(400).json({ status: false, message: 'questionType is required' });
    if (!subjectId || !mustObjId(subjectId)) return res.status(400).json({ status: false, message: 'valid subjectId is required for bank questions' });
    if (!topicId) return res.status(400).json({ status: false, message: 'topicId is required for bank questions' });
    const questionNo = await generateQuestionNo(tenantId, subjectId);
    const doc = await MockExamQns.create({
      tenantId,
      examId: null,
      sectionId: null,
      subjectId: new mongoose.Types.ObjectId(String(subjectId)),
      questionId: uuid(),
      questionNo,
      topicId: safeTrim(topicId) || null,
      subTopicId: safeTrim(subTopicId) || null,
      questionType: safeTrim(questionType).toLowerCase(),
      difficulty: safeTrim(difficulty) || 'medium',
      positiveMarks: toNum(positiveMarks, 0),
      negativeMarks: toNum(negativeMarks, 0),
      // hasPartialMarking: !!hasPartialMarking,
      hasPartialMarking: safeTrim(questionType).toLowerCase() === 'matrix' ? true : !!hasPartialMarking,
      numericMin: numericMin !== undefined ? toNum(numericMin) : null,
      numericMax: numericMax !== undefined ? toNum(numericMax) : null,
      questionHtml: questionHtml || '',
      passageId: passageId || null,
      passageHtml: passageId ? '' : passageHtml || '',
      instructionHtml: instructionHtml || '',
      solutionHtml: solutionHtml || '',
      enablePassage: !!enablePassage,
      enableInstruction: !!enableInstruction,
      enableSolution: !!enableSolution,
      correctAnswer: safeTrim(correctAnswer) || '',
      questionOptions: normalizeOptions(questionOptions),
      leftColumn: normalizeColumns(req.body?.leftColumn),
      rightColumn: normalizeColumns(req.body?.rightColumn),
      images: normalizeImages(images),
      tags: Array.isArray(tags) ? tags.map(safeTrim).filter(Boolean) : [],
      sortOrder: toNum(sortOrder, 0),
      status: safeTrim(status) || 'active',
      classNo,
      createdBy: userId || null,
      updatedBy: userId || null,
      isdeleted: false
    });
    return res.status(200).json({ status: true, message: 'Question created in bank', data: doc });
  } catch (err) {
    return next(err);
  }
};

const createQuestionsBulkInBank = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!questions.length) return res.status(400).json({ status: false, message: 'questions[] is required' });
    const docs = [];
    for (const q of questions) {
      if (!q.questionType) return res.status(400).json({ status: false, message: 'questionType is required for all questions' });
      if (!q.subjectId || !mustObjId(q.subjectId)) return res.status(400).json({ status: false, message: 'valid subjectId is required for all bank questions' });
      if (!q.topicId) return res.status(400).json({ status: false, message: 'topicId is required for all bank questions' });
      if (!isValidClassNo(q.classNo)) {
        return res.status(400).json({
          status: false,
          message: `classNo must be between 6 and 13 (question index ${questions.indexOf(q) + 1})`
        });
      }
      const questionNo = await generateQuestionNo(tenantId, q.subjectId);
      docs.push({
        tenantId,
        examId: null,
        sectionId: null,
        subjectId: new mongoose.Types.ObjectId(String(q.subjectId)),
        questionId: uuid(),
        questionNo,
        topicId: safeTrim(q.topicId),
        subTopicId: safeTrim(q.subTopicId) || null,
        questionType: safeTrim(q.questionType).toLowerCase(),
        difficulty: safeTrim(q.difficulty) || 'medium',
        positiveMarks: toNum(q.positiveMarks, 0),
        negativeMarks: toNum(q.negativeMarks, 0),
        // hasPartialMarking: !!q.hasPartialMarking,
        hasPartialMarking: safeTrim(q?.questionType).toLowerCase() === 'matrix' ? true : q?.hasPartialMarking === true,
        numericMin: q.numericMin !== undefined ? toNum(q.numericMin) : null,
        numericMax: q.numericMax !== undefined ? toNum(q.numericMax) : null,
        questionHtml: q.questionHtml || '',
        passageId: q.passageId || null,
        passageHtml: q.passageId ? '' : q.passageHtml || '',
        leftColumn: normalizeColumns(q.leftColumn || []),
        rightColumn: normalizeColumns(q.rightColumn || []),
        instructionHtml: q.instructionHtml || '',
        solutionHtml: q.solutionHtml || '',
        enablePassage: !!q.enablePassage,
        enableInstruction: !!q.enableInstruction,
        enableSolution: !!q.enableSolution,
        correctAnswer: safeTrim(q.correctAnswer) || '',
        questionOptions: normalizeOptions(q.questionOptions),
        images: normalizeImages(q.images),
        tags: Array.isArray(q.tags) ? q.tags.map(safeTrim).filter(Boolean) : [],
        sortOrder: toNum(q.sortOrder, 0),
        status: safeTrim(q.status) || 'active',
        classNo: toNum(q.classNo),
        createdBy: userId || null,
        updatedBy: userId || null,
        isdeleted: false
      });
    }
    const inserted = await MockExamQns.insertMany(docs, { ordered: true });
    return res.status(200).json({ status: true, message: `${inserted.length} questions created in bank`, count: inserted.length, data: inserted });
  } catch (err) {
    return next(err);
  }
};

// ─── listQuestionBank ─────────────────────────────────────────────────────────
const listQuestionBank = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const subjectId = req.query.subjectId;
    const topicId = req.query.topicId;
    const subTopicId = req.query.subTopicId;
    const difficulty = req.query.difficulty;
    const questionType = req.query.questionType;
    const status = req.query.status;
    const classNo = req.query.classNo || req.body?.classNo;
    const page = Math.max(parseInt(req.query.page || req.body.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || req.body.limit || '20', 10), 1), 200);
    const query = { tenantId, examId: null, isdeleted: false };
    if (subjectId && mustObjId(subjectId)) query.subjectId = new mongoose.Types.ObjectId(String(subjectId));
    if (topicId) query.topicId = safeTrim(topicId);
    if (subTopicId) query.subTopicId = safeTrim(subTopicId);
    if (difficulty) query.difficulty = safeTrim(difficulty);
    if (questionType) query.questionType = safeTrim(questionType).toLowerCase();
    if (status) query.status = safeTrim(status);
    if (classNo) query.classNo = toNum(classNo);
    if (req.body.list === 'full') {
      const rows = await MockExamQns.find(query).sort({ createdAt: -1 }).lean();
      return res.status(200).json({ status: true, data: rows, count: rows.length });
    }
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([MockExamQns.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), MockExamQns.countDocuments(query)]);
    return res.status(200).json({ status: true, data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const mapQuestionToExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const recId = safeTrim(req.body?.recId);
    const examId = safeTrim(req.body?.examId);
    const sectionId = safeTrim(req.body?.sectionId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId (_id) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!sectionId) return res.status(400).json({ status: false, message: 'sectionId is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const section = (exam.sections || []).find((s) => safeTrim(s.sectionId) === sectionId);
    if (!section) {
      return res.status(400).json({ status: false, message: `Section ${sectionId} not found in exam` });
    }
    const question = await MockExamQns.findOne({ _id: recId, tenantId, isdeleted: false }).lean();
    if (!question) return res.status(404).json({ status: false, message: 'Question not found' });
    if (exam.classNo && question.classNo && toNum(exam.classNo) !== toNum(question.classNo)) {
      return res.status(400).json({
        status: false,
        message: `Class mismatch — exam is for Class ${exam.classNo} but question belongs to Class ${question.classNo}`
      });
    }
    const alreadyMapped = await MockExamQns.findOne(
      {
        tenantId,
        examId,
        sectionId,
        isdeleted: false,
        sourceQuestionId: question.questionId
      },
      { _id: 1 }
    ).lean();
    if (alreadyMapped) {
      return res.status(409).json({
        status: false,
        message: 'This question is already mapped to this exam section'
      });
    }
    const sectionLimit = toNum(section.numberOfQuestions);
    if (sectionLimit > 0) {
      const currentSectionCount = await MockExamQns.countDocuments({
        tenantId,
        examId,
        sectionId,
        isdeleted: false
      });
      if (currentSectionCount >= sectionLimit) {
        return res.status(400).json({
          status: false,
          message: `Section "${section.sectionName}" is already at its question limit (${sectionLimit})`
        });
      }
    }
    const examLimit = toNum(exam.totalQuestions);
    if (examLimit > 0) {
      const currentTotalCount = await MockExamQns.countDocuments({
        tenantId,
        examId,
        isdeleted: false
      });
      if (currentTotalCount >= examLimit) {
        return res.status(400).json({
          status: false,
          message: `Exam is already at its total question limit (${examLimit})`
        });
      }
    }
    const resolvedSubjectId = question.subjectId || (section.subjectId ? new mongoose.Types.ObjectId(String(section.subjectId)) : null);
    const questionNo = await generateQuestionNo(tenantId, resolvedSubjectId);
    const raw = { ...question };
    delete raw._id;
    delete raw.__v;
    delete raw.createdAt;
    delete raw.updatedAt;
    const copy = await MockExamQns.create({
      ...raw,
      examId,
      sectionId,
      subjectId: resolvedSubjectId,
      questionNo,
      questionId: uuid(),
      sourceQuestionId: question.questionId,
      createdBy: userId || null,
      updatedBy: userId || null,
      isdeleted: false
    });
    const actualTotal = await MockExamQns.countDocuments({ tenantId, examId, isdeleted: false });
    const actualSection = await MockExamQns.countDocuments({ tenantId, examId, sectionId, isdeleted: false });
    return res.status(200).json({
      status: true,
      message: 'Question mapped to exam successfully',
      data: {
        ...copy.toObject(),
        examTotalQuestions: actualTotal,
        sectionQuestionCount: actualSection
      }
    });
  } catch (err) {
    return next(err);
  }
};

const unmapQuestionFromExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const recId = safeTrim(req.body?.recId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId (_id) is required' });
    const question = await MockExamQns.findOne({ _id: recId, tenantId, isdeleted: false }).lean();
    if (!question) {
      return res.status(404).json({ status: false, message: 'Question not found' });
    }
    if (!question.examId) {
      return res.status(400).json({
        status: false,
        message: 'This is a bank question — nothing to unmap'
      });
    }
    await MockExamQns.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true, status: 'inactive', updatedBy: userId || null } });
    const actualTotal = await MockExamQns.countDocuments({
      tenantId,
      examId: question.examId,
      isdeleted: false
    });
    return res.status(200).json({
      status: true,
      message: 'Question removed from exam. Bank question untouched.',
      data: {
        removedQuestionId: question.questionId,
        examTotalQuestions: actualTotal
      }
    });
  } catch (err) {
    return next(err);
  }
};

// ─── bulkMapQuestionsToExam ───────────────────────────────────────────────────
const bulkMapQuestionsToExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);
    const sectionId = safeTrim(req.body?.sectionId);
    const recIds = Array.isArray(req.body?.recIds) ? req.body.recIds.map(safeTrim).filter(Boolean) : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!sectionId) return res.status(400).json({ status: false, message: 'sectionId is required' });
    if (!recIds.length) return res.status(400).json({ status: false, message: 'recIds[] is required' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const section = (exam.sections || []).find((s) => safeTrim(s.sectionId) === sectionId);
    if (!section) {
      return res.status(400).json({ status: false, message: `Section ${sectionId} not found in exam` });
    }
    const currentTotalCount = await MockExamQns.countDocuments({ tenantId, examId, isdeleted: false });
    const currentSectionCount = await MockExamQns.countDocuments({ tenantId, examId, sectionId, isdeleted: false });
    const sectionLimit = toNum(section.numberOfQuestions);
    const examLimit = toNum(exam.totalQuestions);
    const sectionSlots = sectionLimit > 0 ? sectionLimit - currentSectionCount : Infinity;
    const examSlots = examLimit > 0 ? examLimit - currentTotalCount : Infinity;
    const canAdd = Math.min(sectionSlots, examSlots);
    if (canAdd <= 0) {
      return res.status(400).json({
        status: false,
        message: sectionSlots <= 0 ? `Section "${section.sectionName}" is already at its question limit (${sectionLimit})` : `Exam is already at its total question limit (${examLimit})`
      });
    }
    const questions = await MockExamQns.find({ _id: { $in: recIds }, tenantId, isdeleted: false }).lean();
    if (!questions.length) {
      return res.status(404).json({ status: false, message: 'No questions found' });
    }
    const sourceIds = questions.map((q) => q.questionId).filter(Boolean);
    const alreadyMappedDocs = await MockExamQns.find(
      {
        tenantId,
        examId,
        sectionId,
        sourceQuestionId: { $in: sourceIds },
        isdeleted: false
      },
      { sourceQuestionId: 1 }
    ).lean();
    const alreadyMappedSet = new Set(alreadyMappedDocs.map((d) => safeTrim(d.sourceQuestionId)));
    const results = { mapped: 0, skipped: 0, errors: [] };
    const newDocs = [];
    let totalMarksAdded = 0;
    let totalQuestionsAdded = 0;
    for (const question of questions) {
      try {
        if (exam.classNo && question.classNo && toNum(exam.classNo) !== toNum(question.classNo)) {
          results.skipped++;
          results.errors.push({
            recId: String(question._id),
            message: `Class mismatch — exam is for Class ${exam.classNo} but question belongs to Class ${question.classNo}`
          });
          continue;
        }
        if (alreadyMappedSet.has(question.questionId)) {
          results.skipped++;
          results.errors.push({
            recId: String(question._id),
            message: 'Already mapped to this exam section'
          });
          continue;
        }
        // inside the for loop, before pushing to newDocs:
        if (newDocs.length >= canAdd) {
          results.skipped++;
          results.errors.push({
            recId: String(question._id),
            message: `Limit reached — only ${canAdd} question(s) could be added`
          });
          continue;
        }
        const resolvedSubjectId = question.subjectId || (section.subjectId ? new mongoose.Types.ObjectId(String(section.subjectId)) : null);
        const questionNo = await generateQuestionNo(tenantId, resolvedSubjectId);
        const raw = { ...question };
        delete raw._id;
        delete raw.__v;
        delete raw.createdAt;
        delete raw.updatedAt;
        newDocs.push({
          ...raw,
          examId,
          sectionId,
          subjectId: resolvedSubjectId,
          questionNo,
          questionId: uuid(),
          sourceQuestionId: question.questionId,
          createdBy: userId || null,
          updatedBy: userId || null,
          isdeleted: false
        });
        totalMarksAdded += toNum(question.positiveMarks);
        totalQuestionsAdded++;
        results.mapped++;
      } catch (e) {
        results.errors.push({ recId: String(question._id), error: e.message });
      }
    }
    if (newDocs.length) {
      await MockExamQns.insertMany(newDocs, { ordered: false });
    }
    const actualTotal = await MockExamQns.countDocuments({ tenantId, examId, isdeleted: false });
    const actualSection = await MockExamQns.countDocuments({ tenantId, examId, sectionId, isdeleted: false });
    return res.status(200).json({
      status: true,
      message: `Bulk map complete — ${results.mapped} mapped, ${results.skipped} skipped`,
      data: {
        ...results,
        examTotalQuestions: actualTotal,
        sectionQuestionCount: actualSection
      }
    });
  } catch (err) {
    return next(err);
  }
};

const bulkUploadAnswers = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);
    const payload = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!payload.length) return res.status(400).json({ status: false, message: 'questions[] must be non-empty' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { examId: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const incomingIds = payload.map((q) => safeTrim(q?.questionId)).filter(Boolean);
    if (!incomingIds.length) {
      return res.status(400).json({ status: false, message: 'No valid questionIds provided' });
    }
    const existingQns = await MockExamQns.find({ tenantId, examId, questionId: { $in: incomingIds }, isdeleted: false }, { questionId: 1, questionType: 1, questionOptions: 1 }).lean();
    const existingMap = new Map(existingQns.map((q) => [q.questionId, q]));
    const notFound = incomingIds.filter((id) => !existingMap.has(id));
    if (notFound.length) {
      return res.status(400).json({
        status: false,
        message: `${notFound.length} question(s) not found in this exam`,
        notFound
      });
    }
    const ops = [];
    const errors = [];
    const updated = [];
    for (const item of payload) {
      const questionId = safeTrim(item?.questionId);
      if (!questionId) continue;
      const existing = existingMap.get(questionId);
      if (!existing) continue;
      const set = { updatedBy: userId || null };
      if (item.correctAnswer !== undefined) {
        set.correctAnswer = safeTrim(item.correctAnswer);
      }
      if (item.solutionHtml !== undefined) {
        set.solutionHtml = item.solutionHtml ?? '';
        set.enableSolution = true;
      }
      if (Array.isArray(item.questionOptions) && item.questionOptions.length) {
        const existingOpts = Array.isArray(existing.questionOptions) ? existing.questionOptions : [];
        const incomingOptMap = new Map(item.questionOptions.filter((o) => safeTrim(o?.key) !== '').map((o) => [safeTrim(o?.key), o]));
        const qt = safeTrim(existing.questionType).toLowerCase();
        const updatedOpts = existingOpts.map((opt) => {
          const optKey = safeTrim(opt?.key);
          const incomingOpt = incomingOptMap.get(optKey);
          if (incomingOpt !== undefined) {
            return {
              ...(opt.toObject ? opt.toObject() : opt),
              isCorrect: incomingOpt.isCorrect === true,
              partialMark: incomingOpt.partialMark !== undefined ? toNum(incomingOpt.partialMark) : toNum(opt.partialMark)
            };
          }
          return opt.toObject ? opt.toObject() : opt;
        });
        if (['mcq_single', 'true_false'].includes(qt)) {
          const correctCount = updatedOpts.filter((o) => o.isCorrect).length;
          if (correctCount === 0) {
            errors.push({
              questionId,
              message: `${qt} must have at least one correct option`
            });
            continue;
          }
          if (correctCount > 1) {
            errors.push({
              questionId,
              message: `${qt} can only have one correct option`
            });
            continue;
          }
        }
        set.questionOptions = updatedOpts;
      }
      if (Object.keys(set).length <= 1) {
        errors.push({ questionId, message: 'No fields to update' });
        continue;
      }
      if (safeTrim(existing.questionType).toLowerCase() === 'matrix') {
        set.hasPartialMarking = true;
      }
      ops.push({
        updateOne: {
          filter: { tenantId, examId, questionId, isdeleted: false },
          update: { $set: set }
        }
      });
      updated.push(questionId);
    }
    let bulkResult = null;
    if (ops.length) {
      bulkResult = await MockExamQns.bulkWrite(ops, { ordered: false });
    }
    return res.status(200).json({
      status: true,
      message: `${updated.length} question(s) updated${errors.length ? `, ${errors.length} skipped` : ''}`,
      data: {
        updatedCount: updated.length,
        skippedCount: errors.length,
        updatedIds: updated,
        errors: errors.length ? errors : undefined
      }
    });
  } catch (err) {
    return next(err);
  }
};

const previewNextQuestionNo = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const subjectId = safeTrim(req.body?.subjectId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!subjectId) return res.status(400).json({ status: false, message: 'subjectId is required' });

    // Get subject prefix — same logic as generateQuestionNo
    let subjectPrefix = 'GEN';
    const subjectDoc = await Subject.findOne({ _id: subjectId, isdeleted: false }, { subjectCode: 1 }).lean();
    if (subjectDoc?.subjectCode) {
      subjectPrefix = safeTrim(subjectDoc.subjectCode)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 3)
        .padEnd(3, 'X');
    }

    // READ current counter value — no increment
    const counterKey = `questionNo_${subjectPrefix}`;
    const doc = await Counter.findOne({ tenantId, key: counterKey }).lean();
    const nextSeq = (doc?.seq ?? 0) + 1;

    return res.status(200).json({
      status: true,
      questionNo: `Q${subjectPrefix}${String(nextSeq).padStart(5, '0')}`
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  uploadImage,
  getImage,
  createQuestion,
  createQuestionsBulk,
  updateQuestion,
  deleteQuestion,
  bulkDeleteBySection,
  listQuestionsBySection,
  getQuestionsByExam,
  viewQuestion,
  updateSortOrder,
  getQuestionsByCode,
  createQuestionInBank,
  createQuestionsBulkInBank,
  listQuestionBank,
  mapQuestionToExam,
  unmapQuestionFromExam,
  bulkMapQuestionsToExam,
  bulkUploadAnswers,
  previewNextQuestionNo,
  getExamQuestionsWithAnswers
};
