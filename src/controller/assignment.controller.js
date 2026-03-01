import constants from '../helpers/constants.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Assignment from '../models/assignment.model.js';
import AssignmentQns from '../models/assingmentQns.model.js';
import ExamCategory from '../models/examcategory.model.js';
import ExamSubCategory from '../models/examsubcategory.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import Topic from '../models/topic.model.js';
import SubTopic from '../models/subtopic.model.js';
import BatchAssignEnable from '../models/batchenabledAssignment.model.js';
import AssignmentResult from '../models/assignmentResult.model.js';

const pickTenantId = (req) => String(req.body?.entiId || req.body?.tenantId || '').trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
};
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ensureClassNo = (n) => Number.isFinite(n) && n >= 6 && n <= 13;
const mustObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));
const uuid = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
};

const validateCombo = async ({ tenantId, classNo, subjectId, topicId, subTopicId, categoryId, subCategoryId }) => {
  const cat = await ExamCategory.findOne({ tenantId, categoryId, isdeleted: false }, { categoryId: 1 }).lean();
  if (!cat) return { ok: false, message: 'Invalid categoryId' };
  const sub = await ExamSubCategory.findOne({ tenantId, subCategoryId, isdeleted: false }, { subCategoryId: 1, categoryId: 1 }).lean();
  if (!sub) return { ok: false, message: 'Invalid subCategoryId' };
  if (String(sub.categoryId) !== String(categoryId)) return { ok: false, message: 'SubCategory does not belong to Category' };
  const topic = await Topic.findOne({ tenantId, isdeleted: false, classNo, subjectId, topicId }, { topicId: 1 }).lean();
  if (!topic) return { ok: false, message: 'Invalid topicId for given class/subject' };
  const subTopic = await SubTopic.findOne({ tenantId, isdeleted: false, classNo, subjectId, topicId, subTopicId }, { subTopicId: 1 }).lean();
  if (!subTopic) return { ok: false, message: 'Invalid subTopicId for given topic/class/subject' };
  return { ok: true };
};

const round2 = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
};

const calcCgpa10 = (obtainedMarks, totalPossibleMarks) => {
  const ob = Number(obtainedMarks);
  const tot = Number(totalPossibleMarks);
  if (!Number.isFinite(ob) || !Number.isFinite(tot) || tot <= 0) return null;
  return round2((ob / tot) * 10);
};

const createAssignment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    const classNo = req.body?.classNo;
    const subjectIdRaw = req.body?.subjectId;
    const topicId = safeTrim(req.body?.topicId);
    const subTopicId = safeTrim(req.body?.subTopicId);
    const categoryId = safeTrim(req.body?.categoryId);
    const subCategoryId = safeTrim(req.body?.subCategoryId);
    const testNo = safeTrim(req.body?.testNo);
    const testCode = safeTrim(req.body?.testCode);
    const duration = toNum(req.body?.duration) || 60;
    const computeFor = toNum(req.body?.computeFor) || 10;
    const numberOfQuestions = toNum(req.body?.numberOfQuestions);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!ensureClassNo(classNo)) return res.status(400).json({ status: false, message: 'Invalid classNo (6..13)' });
    if (!subjectIdRaw || !mustObjectId(subjectIdRaw)) return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    if (!topicId || !subTopicId) return res.status(400).json({ status: false, message: 'topicId and subTopicId are required' });
    if (!categoryId || !subCategoryId) return res.status(400).json({ status: false, message: 'categoryId and subCategoryId are required' });
    if (!testNo) return res.status(400).json({ status: false, message: 'testNo is required' });
    if (!testCode) return res.status(400).json({ status: false, message: 'testCode is required' });
    if (numberOfQuestions < 0) return res.status(400).json({ status: false, message: 'numberOfQuestions must be >= 0' });
    const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const v = await validateCombo({ tenantId, classNo, subjectId, topicId, subTopicId, categoryId, subCategoryId });
    if (!v.ok) return res.status(400).json({ status: false, message: v.message });
    const dup = await Assignment.findOne(
      {
        tenantId,
        isdeleted: false,
        classNo,
        subjectId,
        topicId,
        subTopicId,
        categoryId,
        subCategoryId,
        $or: [{ testNo }, { testCode }]
      },
      { testId: 1 }
    ).lean();
    if (dup) return res.status(409).json({ status: false, message: 'Assignment already exists with same testNo or testCode for this mapping' });
    const doc = await Assignment.create({
      tenantId,
      classNo,
      subjectId,
      topicId,
      subTopicId,
      categoryId,
      subCategoryId,
      testId: uuid(),
      testNo,
      testCode,
      duration,
      computeFor,
      numberOfQuestions,
      status: safeTrim(req.body?.status) || 'active',
      createdBy: userId || null,
      updatedBy: null,
      isdeleted: false
    });
    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Assignment created successfully',
      data: doc
    });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate assignment (testId)' });
    return next(err);
  }
};

const updateAssignment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    const testId = safeTrim(req.body?.testId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!testId) return res.status(400).json({ status: false, message: 'testId is required' });
    const doc = await Assignment.findOne({ tenantId, testId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Assignment not found' });
    const set = {};
    if (req.body?.testNo !== undefined) {
      const testNo = toNum(req.body.testNo);
      if (!testNo) return res.status(400).json({ status: false, message: 'testNo is invalid' });
      set.testNo = testNo;
    }
    if (req.body?.testCode !== undefined) {
      const testCode = safeTrim(req.body.testCode);
      if (!testCode) return res.status(400).json({ status: false, message: 'testCode cannot be empty' });
      set.testCode = testCode;
    }
    if (req.body?.numberOfQuestions !== undefined) {
      const n = toNum(req.body.numberOfQuestions);
      if (n < 0) return res.status(400).json({ status: false, message: 'numberOfQuestions must be >= 0' });
      set.numberOfQuestions = n;
    }
    if (req.body?.status !== undefined) {
      const st = safeTrim(req.body.status);
      if (st) set.status = st;
    }
    if (req.body?.duration !== undefined) {
      if (st) set.duration = req.body?.duration;
    }
    if (req.body?.computeFor !== undefined) {
      if (st) set.computeFor = req.body?.computeFor;
    }
    const willChangeMapping = req.body?.classNo !== undefined || req.body?.subjectId !== undefined || req.body?.topicId !== undefined || req.body?.subTopicId !== undefined || req.body?.categoryId !== undefined || req.body?.subCategoryId !== undefined;
    if (willChangeMapping) {
      const classNo = req.body?.classNo !== undefined ? toNum(req.body.classNo) : doc.classNo;
      const subjectIdRaw = req.body?.subjectId !== undefined ? req.body.subjectId : doc.subjectId;
      const topicId = req.body?.topicId !== undefined ? safeTrim(req.body.topicId) : doc.topicId;
      const subTopicId = req.body?.subTopicId !== undefined ? safeTrim(req.body.subTopicId) : doc.subTopicId;
      const categoryId = req.body?.categoryId !== undefined ? safeTrim(req.body.categoryId) : doc.categoryId;
      const subCategoryId = req.body?.subCategoryId !== undefined ? safeTrim(req.body.subCategoryId) : doc.subCategoryId;
      if (!ensureClassNo(classNo)) return res.status(400).json({ status: false, message: 'Invalid classNo (6..13)' });
      if (!mustObjectId(subjectIdRaw)) return res.status(400).json({ status: false, message: 'Invalid subjectId' });
      if (!topicId || !subTopicId) return res.status(400).json({ status: false, message: 'topicId and subTopicId are required' });
      if (!categoryId || !subCategoryId) return res.status(400).json({ status: false, message: 'categoryId and subCategoryId are required' });
      const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
      const v = await validateCombo({ tenantId, classNo, subjectId, topicId, subTopicId, categoryId, subCategoryId });
      if (!v.ok) return res.status(400).json({ status: false, message: v.message });
      set.classNo = classNo;
      set.subjectId = subjectId;
      set.topicId = topicId;
      set.subTopicId = subTopicId;
      set.categoryId = categoryId;
      set.subCategoryId = subCategoryId;
      const newTestNo = set.testNo !== undefined ? set.testNo : doc.testNo;
      const newTestCode = set.testCode !== undefined ? set.testCode : doc.testCode;
      const dup = await Assignment.findOne(
        {
          tenantId,
          isdeleted: false,
          testId: { $ne: testId },
          classNo,
          subjectId,
          topicId,
          subTopicId,
          categoryId,
          subCategoryId,
          $or: [{ testNo: newTestNo }, { testCode: newTestCode }]
        },
        { testId: 1 }
      ).lean();
      if (dup) return res.status(409).json({ status: false, message: 'Another assignment already exists with same testNo or testCode for this mapping' });
    }
    if (!Object.keys(set).length) {
      return res.status(400).json({ status: false, message: 'No fields to update' });
    }
    set.updatedBy = userId || null;

    const updated = await Assignment.findOneAndUpdate({ tenantId, testId, isdeleted: false }, { $set: set }, { new: true, runValidators: true }).lean();
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Assignment updated successfully',
      data: updated
    });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate assignment (testId)' });
    return next(err);
  }
};

const listAssignments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const list = req.query.list || '';
    const tenantId = req.body.entiId;
    const query = { tenantId, isdeleted: false };
    if (req.query.classNo) query.classNo = toNum(req.query.classNo);
    if (req.query.subjectId && mustObjectId(req.query.subjectId)) query.subjectId = new mongoose.Types.ObjectId(String(req.query.subjectId));
    if (req.query.topicId) query.topicId = safeTrim(req.query.topicId);
    if (req.query.subTopicId || req.query.subtopicId) query.subTopicId = safeTrim(req.query.subtopicId || req.query.subtopicId);
    if (req.query.categoryId) query.categoryId = safeTrim(req.query.categoryId);
    if (req.query.subCategoryId) query.subCategoryId = safeTrim(req.query.subCategoryId);
    if (search) {
      const rx = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ testCode: rx }, { testId: rx }];
      const n = toNum(search);
      if (n) query.$or.push({ testNo: n });
    }
    let rows = [];
    let count = 0;
    if (String(list).toLowerCase() === 'full') {
      rows = await Assignment.find(query).sort(sort).populate({ path: 'subjectId', model: 'subject', select: 'subjectName subjectCode' }).lean();
      count = rows.length;
    } else {
      count = await Assignment.countDocuments(query);
      rows = await Assignment.find(query).sort(sort).skip(skip).limit(limit).populate({ path: 'subjectId', model: 'subject', select: 'subjectName subjectCode' }).lean();
    }
    const topicIds = [...new Set(rows.map((r) => r.topicId).filter(Boolean))];
    const subTopicIds = [...new Set(rows.map((r) => r.subTopicId).filter(Boolean))];
    const catIds = [...new Set(rows.map((r) => r.categoryId).filter(Boolean))];
    const subCatIds = [...new Set(rows.map((r) => r.subCategoryId).filter(Boolean))];
    const [topics, subtopics, categories, subcategories] = await Promise.all([
      Topic.find({ tenantId, topicId: { $in: topicIds }, isdeleted: false }, 'topicId topicName').lean(),
      SubTopic.find({ tenantId, subTopicId: { $in: subTopicIds }, isdeleted: false }, 'subTopicId subTopicName').lean(),
      ExamCategory.find({ tenantId, categoryId: { $in: catIds }, isdeleted: false }, 'categoryId categoryName').lean(),
      ExamSubCategory.find({ tenantId, subCategoryId: { $in: subCatIds }, isdeleted: false }, 'subCategoryId subCategoryName').lean()
    ]);
    const topicMap = new Map(topics.map((t) => [t.topicId, t.topicName]));
    const subTopicMap = new Map(subtopics.map((st) => [st.subTopicId, st.subTopicName]));
    const catMap = new Map(categories.map((c) => [c.categoryId, c.categoryName]));
    const subCatMap = new Map(subcategories.map((sc) => [sc.subCategoryId, sc.subCategoryName]));
    rows = rows.map((r) => ({
      ...r,
      topicName: topicMap.get(r.topicId) || null,
      subTopicName: subTopicMap.get(r.subTopicId) || null,
      categoryName: catMap.get(r.categoryId) || null,
      subCategoryName: subCatMap.get(r.subCategoryId) || null,
      level: `${catMap.get(r.categoryId) || null} ${subCatMap.get(r.subCategoryId) || null}`
    }));
    if (String(list).toLowerCase() === 'full') {
      return res.status(constants.HTTPS_SUCCESS).send({
        status: true,
        data: rows,
        count: count,
        message: 'Assignment details retrieved Successfully'
      });
    }
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: rows,
      page: page,
      count: count,
      message: 'Assignment details retrieved Successfully'
    });
  } catch (err) {
    next(err);
  }
};

const deleteAssignment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const testId = safeTrim(req.body?.testId);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!testId) return res.status(400).json({ status: false, message: 'testId is required' });
    const doc = await Assignment.findOneAndUpdate({ tenantId, testId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Assignment not found or already deleted' });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Assignment deleted successfully',
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const importAssignments = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const mode = safeTrim(req.body?.mode || 'insert').toLowerCase();
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows must be a non-empty array' });
    const ops = [];
    const rowErrors = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const classNo = toNum(r.classNo);
      const subjectIdRaw = r.subjectId;
      const topicId = safeTrim(r.topicId);
      const subTopicId = safeTrim(r.subTopicId);
      const categoryId = safeTrim(r.categoryId);
      const subCategoryId = safeTrim(r.subCategoryId);
      const testNo = toNum(r.testNo);
      const testCode = safeTrim(r.testCode);
      const numberOfQuestions = toNum(r.numberOfQuestions);
      const duration = toNum(req.body?.duration) || 60;
      const computeFor = toNum(req.body?.computeFor) || 10;
      if (!ensureClassNo(classNo) || !subjectIdRaw || !mustObjectId(subjectIdRaw) || !topicId || !subTopicId || !categoryId || !subCategoryId || !testNo || !testCode) {
        rowErrors.push({ row: i + 1, message: 'classNo, subjectId, topicId, subTopicId, categoryId, subCategoryId, testNo, testCode are required' });
        continue;
      }
      if (numberOfQuestions < 0) {
        rowErrors.push({ row: i + 1, message: 'numberOfQuestions must be >= 0' });
        continue;
      }
      const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
      const v = await validateCombo({ tenantId, classNo, subjectId, topicId, subTopicId, categoryId, subCategoryId });
      if (!v.ok) {
        rowErrors.push({ row: i + 1, message: v.message });
        continue;
      }
      const testId = safeTrim(r.testId) || uuid();
      const doc = {
        tenantId,
        classNo,
        subjectId,
        topicId,
        subTopicId,
        categoryId,
        subCategoryId,
        testId,
        testNo,
        testCode,
        numberOfQuestions,
        duration,
        computeFor,
        status: safeTrim(r.status) || 'active',
        updatedBy: userId || null,
        isdeleted: false
      };
      if (mode === 'upsert') {
        ops.push({
          updateOne: {
            filter: { tenantId, testId, isdeleted: false },
            update: { $set: doc, $setOnInsert: { createdBy: userId || null } },
            upsert: true
          }
        });
      } else {
        doc.createdBy = userId || null;
        ops.push({ insertOne: { document: doc } });
      }
    }
    if (!ops.length) {
      return res.status(400).json({ status: false, message: 'No valid rows to import', rowErrors });
    }
    const result = await Assignment.bulkWrite(ops, { ordered: false });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Assignments imported successfully',
      data: {
        inserted: result?.insertedCount || 0,
        upserted: result?.upsertedCount || 0,
        modified: result?.modifiedCount || 0
      },
      rowErrors
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ status: false, message: 'Duplicate assignment found while importing (testId / unique conflict)' });
    }
    return next(err);
  }
};

const enableTeststoBatch = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    const batchId = safeTrim(req.body?.batchId);
    const subjectId = safeTrim(req.body?.subjectId);
    const classNo = toNum(req.body?.classNo);
    const userId = safeTrim(req.body?.userId);
    const tests = Array.isArray(req.body?.tests) ? req.body.tests : [];
    if (!tenantId || !batchId || !subjectId || !tests.length) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'entiId, batchId, subjectId and tests[] are required'
      });
    }
    const now = Date.now();
    const studsRaw = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', batchId }, { _id: 0, admissionNo: 1, studentId: 1 }).lean();
    const students = (studsRaw || [])
      .map((s) => ({
        admissionNo: safeTrim(s?.admissionNo),
        studentId: safeTrim(s?.studentId) || null,
        status: 'ASSIGNED',
        assignedAt: now,
        startedAt: null,
        completedAt: null,
        numberOfAttempts: 0,
        cgpa: null
      }))
      .filter((x) => !!x.admissionNo);
    const ops = [];
    for (const t of tests) {
      const testId = safeTrim(t?.testId);
      const testNo = t?.testNo === null || t?.testNo === undefined ? null : safeTrim(t?.testNo);
      if (!testId) continue;
      ops.push({
        updateOne: {
          filter: { tenantId, batchId, subjectId, testId },
          update: {
            $set: {
              tenantId,
              batchId,
              subjectId,
              classNo,
              testId,
              testNo,
              status: 'enabled',
              enabledAt: now,
              enabledBy: userId || null,
              disabledAt: null,
              disabledBy: null,
              isdeleted: false
            },
            $setOnInsert: {
              students
            }
          },
          upsert: true
        }
      });
    }
    if (!ops.length) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'No valid testId found in tests[]'
      });
    }
    await BatchAssignEnable.bulkWrite(ops, { ordered: false });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Tests enabled successfully'
    });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'Tests enabled successfully'
      });
    }
    return next(err);
  }
};

const disableTeststoBatch = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    const batchId = safeTrim(req.body?.batchId);
    const subjectId = safeTrim(req.body?.subjectId);
    const userId = safeTrim(req.body?.userId);
    const testIds = Array.isArray(req.body?.testIds) ? req.body.testIds : [];
    if (!tenantId || !batchId || !subjectId || !testIds.length) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'entiId, batchId, subjectId and testIds[] are required'
      });
    }
    const now = Date.now();
    await BatchAssignEnable.updateMany({ tenantId, batchId, subjectId, testId: { $in: testIds.map(safeTrim).filter(Boolean) }, isdeleted: false }, { $set: { status: 'disabled', disabledAt: now, disabledBy: userId || null } });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Tests disabled successfully'
    });
  } catch (err) {
    return next(err);
  }
};

const listEnabledTestsforBatch = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId || req.body?.tenantId);
    const batchId = safeTrim(req.body?.batchId);
    const subjectId = safeTrim(req.body?.subjectId);
    if (!tenantId || !batchId || !subjectId) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'entiId, batchId and subjectId are required'
      });
    }
    const rows = await BatchAssignEnable.find({ tenantId, batchId, subjectId, isdeleted: false, status: 'enabled' }, { _id: 1, testId: 1, testNo: 1, enabledAt: 1, enabledBy: 1 }).sort({ enabledAt: -1 }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Enabled tests loaded',
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const normalizeArr = (v) => (Array.isArray(v) ? v.map((x) => safeTrim(x)).filter(Boolean) : []);

const sameSet = (a = [], b = []) => {
  const A = new Set(normalizeArr(a));
  const B = new Set(normalizeArr(b));
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
};

const buildCorrectAnswerRaw = (q) => {
  const qt = safeTrim(q?.questionType).toLowerCase();
  const opts = Array.isArray(q?.questionOptions) ? q.questionOptions : [];
  if (qt === 'mcq_single' || qt === 'true_false') {
    const one = opts.find((o) => o?.isCorrect === true);
    return safeTrim(one?.key || one?.textHtml || '');
  }
  if (qt === 'mcq_multi') {
    return opts
      .filter((o) => o?.isCorrect === true)
      .map((o) => safeTrim(o?.key || o?.textHtml || ''))
      .filter(Boolean);
  }
  return null;
};

const evalObjective = (q, answerRaw) => {
  const qt = safeTrim(q?.questionType).toLowerCase();
  const correct = buildCorrectAnswerRaw(q);
  if (answerRaw === null || answerRaw === undefined) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
  if (qt === 'mcq_single' || qt === 'true_false') {
    const a = safeTrim(answerRaw);
    const c = safeTrim(correct);
    if (!a) return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
    const ok = a === c;
    return { isCorrect: ok, correctAnswerRaw: correct };
  }
  if (qt === 'mcq_multi') {
    const a = normalizeArr(answerRaw);
    const ok = sameSet(a, correct);
    return { isCorrect: ok, correctAnswerRaw: correct };
  }
  return { isCorrect: null, correctAnswerRaw: correct, marksAwarded: 0 };
};

const submitAssignmentResult = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    const classNo = toNum(req.body?.classNo);
    const subjectId = safeTrim(req.body?.subjectId);
    const testId = safeTrim(req.body?.testId);
    const batchId = safeTrim(req.body?.batchId);
    const numberOfReattempts = toNum(req.body?.numberOfReattempts || 1);
    if (!tenantId || !admissionNo || !classNo || !subjectId || !testId) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'entiId, admissionNo, classNo, subjectId, testId are required'
      });
    }
    if (numberOfReattempts < 0) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'numberOfReattempts must be >= 0'
      });
    }
    const assignment = await Assignment.findOne({
      tenantId,
      isdeleted: false,
      classNo,
      subjectId: new mongoose.Types.ObjectId(subjectId),
      testId
    }).lean();
    if (!assignment) {
      return res.status(constants.HTTPS_NOT_FOUND).json({
        status: false,
        message: 'Assignment not found for this testId'
      });
    }
    const incomingAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    if (!incomingAnswers.length) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'answers[] is required'
      });
    }
    const questions = await AssignmentQns.find({ tenantId, testId, isdeleted: false }, { _id: 0, questionId: 1, questionType: 1, positiveMarks: 1, negativeMarks: 1, questionOptions: 1 }).lean();
    const qById = new Map((questions || []).map((q) => [safeTrim(q.questionId), q]));
    const evaluated = [];
    let obtainedMarks = 0;
    let totalPossibleMarks = 0;
    for (const q of questions || []) {
      totalPossibleMarks += toNum(q?.positiveMarks);
    }
    for (const a of incomingAnswers) {
      const qid = safeTrim(a?.questionId);
      if (!qid) continue;
      const q = qById.get(qid) || null;
      const isSkipped = a?.isSkipped === true;
      const answerRaw = isSkipped ? null : (a?.answerRaw ?? null);
      const pos = q ? toNum(q.positiveMarks) : toNum(a?.positiveMarks);
      const neg = q ? toNum(q.negativeMarks) : toNum(a?.negativeMarks);
      let isCorrect = null;
      let correctAnswerRaw = null;
      let marksAwarded = 0;
      if (q && !isSkipped) {
        const ev = evalObjective(q, answerRaw);
        isCorrect = ev.isCorrect;
        correctAnswerRaw = ev.correctAnswerRaw ?? null;
        if (isCorrect === true) marksAwarded = pos;
        else if (isCorrect === false) marksAwarded = neg ? -Math.abs(neg) : 0;
        else marksAwarded = 0;
      }
      if (isSkipped) {
        isCorrect = null;
        marksAwarded = 0;
      }
      obtainedMarks += toNum(marksAwarded);
      evaluated.push({
        questionId: qid,
        answerRaw,
        isCorrect,
        isSkipped,
        positiveMarks: pos,
        negativeMarks: neg,
        marksAwarded,
        correctAnswerRaw
      });
    }
    const completedAt = toNum(req.body?.completedAt) || Date.now();
    const startedAt = toNum(req.body?.startedAt) || null;
    const doc = await AssignmentResult.create({
      tenantId,
      admissionNo,
      studentId: safeTrim(req.body?.studentId) || null,
      batchId: batchId || null,
      classNo,
      subjectId: new mongoose.Types.ObjectId(subjectId),
      topicId: safeTrim(assignment.topicId),
      subTopicId: safeTrim(assignment.subTopicId),
      categoryId: safeTrim(assignment.categoryId),
      subCategoryId: safeTrim(assignment.subCategoryId),
      testId: safeTrim(assignment.testId),
      testNo: safeTrim(assignment.testNo),
      testCode: safeTrim(assignment.testCode),
      assignmentId: assignment._id,
      numberOfReattempts,
      startedAt,
      completedAt,
      totalQuestions: toNum(req.body?.totalQuestions) || evaluated.length,
      totalMarks: toNum(req.body?.totalMarks) || 0,
      answers: evaluated,
      status: 'completed',
      createdBy: safeTrim(req.body?.userId) || safeTrim(req.body?.createdBy) || null,
      updatedBy: safeTrim(req.body?.userId) || safeTrim(req.body?.updatedBy) || null
    });
    if (batchId) {
      const cgpa = calcCgpa10(obtainedMarks, totalPossibleMarks);
      await BatchAssignEnable.updateOne({ tenantId, batchId, subjectId, testId, isdeleted: false, students: { $exists: false } }, { $set: { students: [] } });
      const upd1 = await BatchAssignEnable.updateOne(
        { tenantId, batchId, subjectId, testId, isdeleted: false },
        {
          $set: {
            'students.$[st].status': 'COMPLETED',
            'students.$[st].completedAt': completedAt,
            'students.$[st].startedAt': startedAt,
            'students.$[st].cgpa': cgpa,
            'students.$[st].numberOfAttempts': numberOfReattempts
          }
        },
        {
          arrayFilters: [{ 'st.admissionNo': admissionNo }]
        }
      );
      if (!upd1?.modifiedCount) {
        const bt = await BatchAssignEnable.findOne({ tenantId, batchId, subjectId, testId, isdeleted: false }, { enabledAt: 1 }).lean();
        const assignedAt = toNum(bt?.enabledAt) || Date.now();
        await BatchAssignEnable.updateOne(
          { tenantId, batchId, subjectId, testId, isdeleted: false },
          {
            $push: {
              students: {
                admissionNo,
                studentId: safeTrim(req.body?.studentId) || null,
                status: 'COMPLETED',
                assignedAt,
                startedAt,
                completedAt,
                numberOfAttempts: numberOfReattempts,
                cgpa
              }
            }
          }
        );
      }
    }
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Test result submitted',
      data: doc
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'Duplicate submission for this student/test/reattempt'
      });
    }
    return next(err);
  }
};

const listResultsByStudent = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const admissionNo = safeTrim(req.body?.admissionNo);
    if (!tenantId || !admissionNo) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({ status: false, message: 'entiId and admissionNo are required' });
    }
    const page = Math.max(1, toNum(req.query?.page) || 1);
    const limit = Math.min(200, Math.max(1, toNum(req.query?.limit) || 20));
    const skip = (page - 1) * limit;
    const query = { tenantId, isdeleted: false, admissionNo };
    if (safeTrim(req.body?.batchId)) query.batchId = safeTrim(req.body.batchId);
    if (safeTrim(req.body?.testId)) query.testId = safeTrim(req.body.testId);
    const [rows, count] = await Promise.all([AssignmentResult.find(query).sort({ completedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(), AssignmentResult.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Results loaded',
      data: rows,
      count,
      page,
      limit
    });
  } catch (err) {
    return next(err);
  }
};

const listResultsByTest = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const testId = safeTrim(req.body?.testId);
    if (!tenantId || !testId) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({ status: false, message: 'entiId and testId are required' });
    }
    const page = Math.max(1, toNum(req.query?.page) || 1);
    const limit = Math.min(200, Math.max(1, toNum(req.query?.limit) || 20));
    const skip = (page - 1) * limit;
    const query = { tenantId, isdeleted: false, testId };
    if (safeTrim(req.body?.batchId)) query.batchId = safeTrim(req.body.batchId);
    if (safeTrim(req.body?.classNo)) query.classNo = toNum(req.body.classNo);
    if (safeTrim(req.body?.subjectId) && mongoose.Types.ObjectId.isValid(req.body.subjectId)) {
      query.subjectId = new mongoose.Types.ObjectId(req.body.subjectId);
    }
    const [rows, count] = await Promise.all([AssignmentResult.find(query).sort({ completedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(), AssignmentResult.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Test results loaded',
      data: rows,
      count,
      page,
      limit
    });
  } catch (err) {
    return next(err);
  }
};

const listResultsByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchId = safeTrim(req.body?.batchId);
    if (!tenantId || !batchId) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({ status: false, message: 'entiId and batchId are required' });
    }
    const page = Math.max(1, toNum(req.query?.page) || 1);
    const limit = Math.min(200, Math.max(1, toNum(req.query?.limit) || 20));
    const skip = (page - 1) * limit;
    const query = { tenantId, isdeleted: false, batchId };
    if (safeTrim(req.body?.testId)) query.testId = safeTrim(req.body.testId);
    if (safeTrim(req.body?.admissionNo)) query.admissionNo = safeTrim(req.body.admissionNo);
    const [rows, count] = await Promise.all([AssignmentResult.find(query).sort({ completedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(), AssignmentResult.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Batch results loaded',
      data: rows,
      count,
      page,
      limit
    });
  } catch (err) {
    return next(err);
  }
};

const listTopicEnableStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchId = safeTrim(req.body?.batchId);
    const classNo = toNum(req.query?.classNo);
    const subjectId = safeTrim(req.query?.subjectId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    if (!classNo) return res.status(400).json({ status: false, message: 'classNo is required' });
    if (!subjectId || !mustObjectId(subjectId)) return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    const enabledRows = await BatchAssignEnable.find({ tenantId, batchId, subjectId, isdeleted: false, status: 'enabled' }, { _id: 0, testId: 1 }).lean();
    const enabledTestIds = (enabledRows || []).map((x) => safeTrim(x?.testId)).filter(Boolean);
    const enabledAssignments = enabledTestIds.length
      ? await Assignment.find(
          {
            tenantId,
            isdeleted: false,
            classNo,
            subjectId: new mongoose.Types.ObjectId(subjectId),
            testId: { $in: enabledTestIds }
          },
          { _id: 0, testId: 1, topicId: 1 }
        ).lean()
      : [];
    const enabledTopicCount = new Map();
    for (const a of enabledAssignments || []) {
      const tid = safeTrim(a?.topicId);
      if (!tid) continue;
      enabledTopicCount.set(tid, (enabledTopicCount.get(tid) || 0) + 1);
    }
    const enabledTopicSet = new Set(Array.from(enabledTopicCount.keys()));
    const allTopics = await Topic.find({ tenantId, isdeleted: false, classNo, subjectId: new mongoose.Types.ObjectId(subjectId) }, { _id: 0, topicId: 1, topicName: 1, topicCode: 1, sortOrder: 1, status: 1 })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    const rows = (allTopics || []).map((t) => {
      const tid = safeTrim(t?.topicId);
      return {
        topicId: tid,
        topicName: safeTrim(t?.topicName),
        topicCode: safeTrim(t?.topicCode),
        enabled: enabledTopicSet.has(tid),
        enabledTestCount: enabledTopicCount.get(tid) || 0
      };
    });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Topic enable status loaded',
      data: rows
    });
  } catch (err) {
    return next(err);
  }
};

const enabledTestsByTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchId = safeTrim(req.body?.batchId);
    const classNo = toNum(req.query?.classNo);
    const subjectIdRaw = safeTrim(req.query?.subjectId);
    const topicId = safeTrim(req.query?.topicId);
    if (!tenantId) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'tenantId (entiId) is required'
      });
    }
    if (!batchId) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'batchId is required'
      });
    }
    if (!ensureClassNo(classNo)) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'Invalid classNo (6..13)'
      });
    }
    if (!subjectIdRaw || !mustObjectId(subjectIdRaw)) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'Invalid subjectId'
      });
    }
    if (!topicId) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({
        status: false,
        message: 'topicId is required'
      });
    }
    const subjectObjId = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const enabledRows = await BatchAssignEnable.find(
      {
        tenantId,
        batchId,
        subjectId: subjectIdRaw,
        isdeleted: false,
        status: 'enabled'
      },
      { _id: 0, testId: 1, testNo: 1, enabledAt: 1 }
    ).lean();
    const enabledTestIds = (enabledRows || []).map((x) => safeTrim(x?.testId)).filter(Boolean);
    if (!enabledTestIds.length) {
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'No enabled tests for this batch/subject',
        data: [],
        count: 0
      });
    }
    const assignments = await Assignment.find(
      {
        tenantId,
        isdeleted: false,
        classNo,
        subjectId: subjectObjId,
        topicId,
        testId: { $in: enabledTestIds }
      },
      {
        _id: 0,
        testId: 1,
        testNo: 1,
        testCode: 1,
        topicId: 1,
        subTopicId: 1,
        categoryId: 1,
        subCategoryId: 1
      }
    ).lean();
    if (!assignments.length) {
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'No enabled tests found for this topic',
        data: [],
        count: 0
      });
    }
    const topicDoc = await Topic.findOne({ tenantId, isdeleted: false, classNo, subjectId: subjectObjId, topicId }, { _id: 0, topicId: 1, topicName: 1, topicCode: 1 }).lean();
    const subTopicIds = Array.from(new Set((assignments || []).map((a) => safeTrim(a?.subTopicId)).filter(Boolean)));
    const [subTopics, cats, subs] = await Promise.all([
      SubTopic.find({ tenantId, isdeleted: false, classNo, subjectId: subjectObjId, topicId, subTopicId: { $in: subTopicIds } }, { _id: 0, subTopicId: 1, subTopicName: 1, subTopicCode: 1 }).lean(),
      ExamCategory.find({ tenantId, isdeleted: false, categoryId: { $in: Array.from(new Set(assignments.map((a) => safeTrim(a?.categoryId)).filter(Boolean))) } }, { _id: 0, categoryId: 1, categoryName: 1, categoryCode: 1 }).lean(),
      ExamSubCategory.find({ tenantId, isdeleted: false, subCategoryId: { $in: Array.from(new Set(assignments.map((a) => safeTrim(a?.subCategoryId)).filter(Boolean))) } }, { _id: 0, subCategoryId: 1, subCategoryName: 1, subCategoryCode: 1, categoryId: 1 }).lean()
    ]);
    const stMap = new Map((subTopics || []).map((x) => [safeTrim(x.subTopicId), x]));
    const catMap = new Map((cats || []).map((x) => [safeTrim(x.categoryId), x]));
    const subCatMap = new Map((subs || []).map((x) => [safeTrim(x.subCategoryId), x]));
    const tName = safeTrim(topicDoc?.topicName || '');
    const tCode = safeTrim(topicDoc?.topicCode || '');
    const data = (assignments || []).map((a) => {
      const st = stMap.get(safeTrim(a?.subTopicId)) || null;
      const cat = catMap.get(safeTrim(a?.categoryId)) || null;
      const subc = subCatMap.get(safeTrim(a?.subCategoryId)) || null;
      return {
        topicId: safeTrim(a?.topicId),
        topicName: tName || safeTrim(a?.topicId),
        topicCode: tCode || null,
        subTopicId: safeTrim(a?.subTopicId),
        subTopicName: safeTrim(st?.subTopicName) || safeTrim(a?.subTopicId),
        subTopicCode: safeTrim(st?.subTopicCode) || null,
        categoryId: safeTrim(a?.categoryId),
        examCategory: safeTrim(cat?.categoryName) || safeTrim(a?.categoryId),
        examCategoryCode: safeTrim(cat?.categoryCode) || null,
        subCategoryId: safeTrim(a?.subCategoryId),
        examSubCategory: safeTrim(subc?.subCategoryName) || safeTrim(a?.subCategoryId),
        examSubCategoryCode: safeTrim(subc?.subCategoryCode) || null,
        testId: safeTrim(a?.testId),
        testNo: safeTrim(a?.testNo),
        testCode: safeTrim(a?.testCode) || null
      };
    });
    data.sort((x, y) => toNum(x.testNo) - toNum(y.testNo));
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Enabled tests loaded',
      data,
      count: data.length
    });
  } catch (err) {
    return next(err);
  }
};

const getTestIds = async (req, res, next) => {
  try {
    const Tests = await Assignment.find({}, { testId: 1, testNo: 1 });
    return res.status(200).json({ status: true, data: Tests, count: Tests.length });
  } catch (err) {
    next(err);
  }
};

export default {
  createAssignment,
  listAssignments,
  updateAssignment,
  deleteAssignment,
  importAssignments,
  enableTeststoBatch,
  disableTeststoBatch,
  listEnabledTestsforBatch,
  submitAssignmentResult,
  listResultsByStudent,
  listResultsByTest,
  listResultsByBatch,
  listTopicEnableStatus,
  enabledTestsByTopic,
  getTestIds: getTestIds
};
