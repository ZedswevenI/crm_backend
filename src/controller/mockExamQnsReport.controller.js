import { v4 as uuid } from 'uuid';
import StudentBookmark from '../models/studentBookmark.model.js';
import QuestionReport from '../models/questionReport.model.js';
import MockExamQns from '../models/mockExamQns.model.js';
import AssignmentQns from '../models/assingmentQns.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const pickTid = (req) => safeTrim(req.body?.entiId || req.body?.tenantId);
const pickUid = (req) => safeTrim(req.body?.userId || req.user?.userId);

const fetchQuestionDetails = async (questionIds, sourceType) => {
  if (!questionIds.length) return new Map();
  const projection = {
    questionId: 1,
    questionType: 1,
    difficulty: 1,
    questionHtml: 1,
    questionOptions: 1,
    correctAnswer: 1,
    solutionHtml: 1,
    enableSolution: 1,
    passageId: 1,
    passageHtml: 1,
    topicId: 1,
    subTopicId: 1,
    tags: 1,
    subjectId: 1,
    positiveMarks: 1,
    negativeMarks: 1,
    numericMin: 1,
    numericMax: 1,
    hasPartialMarking: 1
  };
  let questions = [];
  if (sourceType === 'mockexam') {
    questions = await MockExamQns.find({ questionId: { $in: questionIds }, isdeleted: false }, projection)
      .populate('passageId', 'title passageHtml')
      .lean();
  } else {
    questions = await AssignmentQns.find({ questionId: { $in: questionIds }, isdeleted: false }, projection).lean();
  }
  return new Map(questions.map((q) => [safeTrim(q.questionId), q]));
};

const mergeQuestionDetails = (doc, qMap) => {
  const q = qMap.get(safeTrim(doc.questionId)) || null;
  return {
    ...doc,
    questionDetails: q
      ? {
          questionType: q.questionType || null,
          difficulty: q.difficulty || null,
          questionHtml: q.questionHtml || null,
          questionOptions: q.questionOptions || [],
          correctAnswer: q.correctAnswer || null,
          solutionHtml: q.enableSolution ? q.solutionHtml || null : null,
          positiveMarks: q.positiveMarks ?? null,
          negativeMarks: q.negativeMarks ?? null,
          hasPartialMarking: q.hasPartialMarking ?? false,
          numericMin: q.numericMin ?? null,
          numericMax: q.numericMax ?? null,
          topicId: q.topicId || null,
          subTopicId: q.subTopicId || null,
          tags: q.tags || [],
          subjectId: q.subjectId || null,
          passage: q.passageId ? { title: q.passageId?.title || null, passageHtml: q.passageId?.passageHtml || null } : q.passageHtml ? { title: null, passageHtml: q.passageHtml } : null
        }
      : null
  };
};

const createBookmark = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const studentId = safeTrim(req.body?.studentId);
    const questionId = safeTrim(req.body?.questionId);
    const sourceType = safeTrim(req.body?.sourceType) || 'assignment';
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    if (!questionId) return res.status(400).json({ status: false, message: 'questionId is required' });
    if (!['mockexam', 'assignment'].includes(sourceType)) return res.status(400).json({ status: false, message: 'sourceType must be mockexam or assignment' });
    const doc = await StudentBookmark.findOneAndUpdate(
      { tenantId, studentId, questionId, sourceType, isdeleted: false },
      {
        $set: {
          note: safeTrim(req.body?.note) || null,
          subjectId: safeTrim(req.body?.subjectId) || null,
          examId: safeTrim(req.body?.examId) || null,
          sectionId: safeTrim(req.body?.sectionId) || null,
          assignmentId: safeTrim(req.body?.assignmentId) || null,
          updatedBy: userId || null
        },
        $setOnInsert: {
          tenantId,
          studentId,
          questionId,
          sourceType,
          bookmarkId: uuid(),
          createdBy: userId || null,
          isdeleted: false
        }
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({ status: true, message: 'Bookmarked successfully', data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Already bookmarked' });
    return next(err);
  }
};

const deleteBookmark = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const bookmarkId = safeTrim(req.body?.bookmarkId);
    const questionId = safeTrim(req.body?.questionId);
    const studentId = safeTrim(req.body?.studentId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const query = { tenantId, isdeleted: false };
    if (bookmarkId) query.bookmarkId = bookmarkId;
    else if (questionId && studentId) {
      query.questionId = questionId;
      query.studentId = studentId;
    } else return res.status(400).json({ status: false, message: 'bookmarkId or (questionId + studentId) is required' });
    const doc = await StudentBookmark.findOneAndUpdate(query, { $set: { isdeleted: true, updatedBy: userId || null } }, { new: true });
    if (!doc) return res.status(404).json({ status: false, message: 'Bookmark not found' });
    return res.status(200).json({ status: true, message: 'Bookmark removed' });
  } catch (err) {
    return next(err);
  }
};

const listBookmarks = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const studentId = safeTrim(req.body?.studentId);
    const sourceType = safeTrim(req.body?.sourceType) || null;
    const examId = safeTrim(req.body?.examId) || null;
    const subjectId = safeTrim(req.body?.subjectId) || null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    const page = Math.max(parseInt(req.body?.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.body?.limit || '20', 10), 1), 100);
    const skip = (page - 1) * limit;
    const query = { tenantId, studentId, isdeleted: false };
    if (sourceType) query.sourceType = sourceType;
    if (examId) query.examId = examId;
    if (subjectId) query.subjectId = subjectId;
    const [bookmarks, count] = await Promise.all([StudentBookmark.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), StudentBookmark.countDocuments(query)]);
    if (!bookmarks.length) return res.status(200).json({ status: true, data: [], count: 0, page, limit });
    const mockexamIds = bookmarks.filter((b) => b.sourceType === 'mockexam').map((b) => b.questionId);
    const assignmentIds = bookmarks.filter((b) => b.sourceType === 'assignment').map((b) => b.questionId);
    const [mockexamMap, assignmentMap] = await Promise.all([mockexamIds.length ? fetchQuestionDetails(mockexamIds, 'mockexam') : Promise.resolve(new Map()), assignmentIds.length ? fetchQuestionDetails(assignmentIds, 'assignment') : Promise.resolve(new Map())]);
    const data = bookmarks.map((b) => {
      const qMap = b.sourceType === 'mockexam' ? mockexamMap : assignmentMap;
      return mergeQuestionDetails(b, qMap);
    });
    return res.status(200).json({ status: true, data, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const createReport = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const studentId = safeTrim(req.body?.studentId);
    const studentName = safeTrim(req.body?.studentName);
    const questionId = safeTrim(req.body?.questionId);
    const sourceType = safeTrim(req.body?.sourceType) || 'assignment';
    const issueType = safeTrim(req.body?.issueType);
    const description = safeTrim(req.body?.description);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    if (!studentName) return res.status(400).json({ status: false, message: 'studentName is required' });
    if (!questionId) return res.status(400).json({ status: false, message: 'questionId is required' });
    if (!issueType) return res.status(400).json({ status: false, message: 'issueType is required' });
    if (!description) return res.status(400).json({ status: false, message: 'description is required' });
    if (!['mockexam', 'assignment'].includes(sourceType)) return res.status(400).json({ status: false, message: 'sourceType must be mockexam or assignment' });
    const doc = await QuestionReport.create({
      tenantId,
      reportId: uuid(),
      studentId,
      studentName,
      sourceType,
      questionId,
      examId: safeTrim(req.body?.examId) || null,
      sectionId: safeTrim(req.body?.sectionId) || null,
      assignmentId: safeTrim(req.body?.assignmentId) || null,
      issueType,
      description,
      status: 'PENDING',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });
    return res.status(201).json({ status: true, message: 'Report submitted successfully', data: doc });
  } catch (err) {
    return next(err);
  }
};

const listReports = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const page = Math.max(parseInt(req.body?.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.body?.limit || '20', 10), 1), 100);
    const skip = (page - 1) * limit;
    const query = { tenantId, isdeleted: false };
    if (req.body?.status) query.status = safeTrim(req.body.status);
    if (req.body?.sourceType) query.sourceType = safeTrim(req.body.sourceType);
    if (req.body?.examId) query.examId = safeTrim(req.body.examId);
    if (req.body?.studentId) query.studentId = safeTrim(req.body.studentId);
    if (req.body?.issueType) query.issueType = safeTrim(req.body.issueType);
    if (req.body?.questionId) query.questionId = safeTrim(req.body.questionId);
    const [rows, count] = await Promise.all([QuestionReport.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), QuestionReport.countDocuments(query)]);
    return res.status(200).json({ status: true, data: rows, count, page, limit });
  } catch (err) {
    return next(err);
  }
};

const updateReportStatus = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const recId = safeTrim(req.body?.recId);
    const status = safeTrim(req.body?.status);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    if (!status) return res.status(400).json({ status: false, message: 'status is required' });
    const VALID = ['PENDING', 'REVIEWING', 'FIXED', 'REJECTED'];
    if (!VALID.includes(status)) return res.status(400).json({ status: false, message: `status must be one of: ${VALID.join(', ')}` });
    const set = { status, updatedBy: userId || null };
    if (req.body?.adminRemark !== undefined) set.adminRemark = safeTrim(req.body.adminRemark) || null;
    if (['FIXED', 'REJECTED'].includes(status)) {
      set.resolvedBy = userId || null;
      set.resolvedAt = Date.now();
    }
    const doc = await QuestionReport.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: set }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Report not found' });
    return res.status(200).json({ status: true, message: 'Report status updated', data: doc });
  } catch (err) {
    return next(err);
  }
};

export default {
  createBookmark,
  deleteBookmark,
  listBookmarks,
  createReport,
  listReports,
  updateReportStatus
};
