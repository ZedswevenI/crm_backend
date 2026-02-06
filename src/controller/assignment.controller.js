import constants from '../helpers/constants.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Assignment from '../models/assignment.model.js';
import AssignmentQns from '../models/assingmentQns.model.js';
import ExamCategory from '../models/examcategory.model.js';
import ExamSubCategory from '../models/examsubcategory.model.js';
import Topic from '../models/topic.model.js';
import SubTopic from '../models/subtopic.model.js';

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
    console.log('err ', err);
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
    if (req.query.subTopicId) query.subTopicId = safeTrim(req.query.subTopicId);
    if (req.query.categoryId) query.categoryId = safeTrim(req.query.categoryId);
    if (req.query.subCategoryId) query.subCategoryId = safeTrim(req.query.subCategoryId);
    if (search) {
      const rx = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ testCode: rx }, { testId: rx }];
      const n = toNum(search);
      if (n) query.$or.push({ testNo: n });
    }
    if (String(list).toLowerCase() === 'full') {
      const rows = await Assignment.find(query).sort(sort).populate({ path: 'subjectId', model: 'subject', select: 'subjectName subjectCode' }).lean();
      return res.status(constants.HTTPS_SUCCESS).send({
        status: true,
        data: rows,
        count: rows.length,
        message: 'Assignment details retrieved Successfully'
      });
    }
    const count = await Assignment.countDocuments(query);
    const rows = await Assignment.find(query).sort(sort).skip(skip).limit(limit).populate({ path: 'subjectId', model: 'subject', select: 'subjectName subjectCode' }).lean();
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

export default {
  createAssignment,
  listAssignments,
  updateAssignment,
  deleteAssignment,
  importAssignments
};
