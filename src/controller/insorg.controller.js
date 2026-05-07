import constants from '../helpers/constants.js';
import mongoose from 'mongoose';
import Department from '../models/department.model.js';
import Subject from '../models/subject.model.js';
import Topic from '../models/topic.model.js';
import SubTopic from '../models/subtopic.model.js';
import ExamCategory from '../models/examcategory.model.js';
import ExamSubCategory from '../models/examsubcategory.model.js';
import SchoolExam from '../models/schoolexam.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();

const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const toUpperName = (v) => {
  const s = safeTrim(v);
  return s ? s.toUpperCase() : '';
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toNum = (v) => {
  const n =
    typeof v === 'number'
      ? v
      : Number(
          String(v || '')
            .replace(/,/g, '')
            .trim()
        );
  return Number.isFinite(n) ? n : 0;
};
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const normName = (s) => safeTrim(s).replace(/\s+/g, ' ').trim();

const ensureClassNo = (classNo) => Number.isFinite(classNo) && classNo >= 6 && classNo <= 13;

const createDepartment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const departmentName = toUpperName(payload.departmentName);
    const departmentCode = safeTrim(payload.departmentCode) || null;
    if (!departmentName) {
      return res.status(400).json({ status: false, message: 'departmentName is required' });
    }
    const doc = await Department.create({
      tenantId,
      departmentName,
      departmentCode,
      isActive: payload.isActive === false ? false : true,
      isdeleted: false,
      createdBy: payload.userId || null,
      updatedBy: payload.userId || null
    });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Department created', data: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ status: false, message: 'Department already exists' });
    }
    return next(err);
  }
};

const listDepartments = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const search = safeTrim(req.query.search);
    const list = safeTrim(req.query.list);
    const query = { tenantId, isdeleted: false };
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ departmentName: rx }, { departmentCode: rx }];
    }
    if (list === 'full') {
      const rows = await Department.find(query).sort({ departmentName: 1 }).lean();
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'Request success',
        data: rows,
        count: rows.length
      });
    }
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([Department.find(query).sort({ departmentName: 1 }).skip(skip).limit(limit).lean(), Department.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: rows,
      count
    });
  } catch (err) {
    return next(err);
  }
};

const viewDepartment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const departmentId = safeTrim(req.body.departmentId);
    if (!departmentId) return res.status(400).json({ status: false, message: 'departmentId is required' });
    const doc = await Department.findOne({ _id: departmentId, tenantId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Department not found' });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const departmentId = safeTrim(payload.departmentId);
    if (!departmentId) return res.status(400).json({ status: false, message: 'departmentId is required' });
    const patch = {};
    if (payload.departmentName !== undefined) patch.departmentName = toUpperName(payload.departmentName);
    if (payload.departmentCode !== undefined) patch.departmentCode = safeTrim(payload.departmentCode) || null;
    if (payload.isActive !== undefined) patch.isActive = payload.isActive === false ? false : true;
    if (payload.userId !== undefined) patch.updatedBy = payload.userId || null;
    if (patch.departmentName !== undefined && !patch.departmentName) {
      return res.status(400).json({ status: false, message: 'departmentName cannot be empty' });
    }
    const doc = await Department.findOneAndUpdate({ _id: departmentId, tenantId, isdeleted: false }, { $set: patch }, { new: true });
    if (!doc) return res.status(404).json({ status: false, message: 'Department not found' });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Department updated', data: doc });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ status: false, message: 'Department name already exists' });
    }
    return next(err);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const departmentId = safeTrim(req.body.departmentId);
    if (!departmentId) return res.status(400).json({ status: false, message: 'departmentId is required' });
    const updatedBy = req.body.userId || null;
    const doc = await Department.findOneAndUpdate({ _id: departmentId, tenantId, isdeleted: false }, { $set: { isdeleted: true, isActive: false, updatedBy } }, { new: true });
    if (!doc) return res.status(404).json({ status: false, message: 'Department not found' });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Department deleted',
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const bulkImportDepartments = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const arr = Array.isArray(req.body.departments) ? req.body.departments : [];
    if (!arr.length) {
      return res.status(400).json({ status: false, message: 'departments must be a non-empty array' });
    }
    const seen = new Set();
    const normalized = [];
    for (const it of arr) {
      const departmentName = toUpperName(it?.departmentName);
      if (!departmentName) continue;
      if (seen.has(departmentName)) continue;
      seen.add(departmentName);
      normalized.push({
        tenantId,
        departmentName,
        departmentCode: safeTrim(it?.departmentCode) || null,
        isActive: it?.isActive === false ? false : true,
        isdeleted: false,
        createdBy: req.body.userId || null,
        updatedBy: req.body.userId || null
      });
    }
    if (!normalized.length) {
      return res.status(400).json({ status: false, message: 'No valid departmentName found to import' });
    }
    const names = normalized.map((d) => d.departmentName);
    const existing = await Department.find({ tenantId, isdeleted: false, departmentName: { $in: names } }, { _id: 0, departmentName: 1 }).lean();
    const existingSet = new Set((existing || []).map((e) => String(e.departmentName || '').toUpperCase()));
    const toInsert = normalized.filter((d) => !existingSet.has(d.departmentName));
    const skippedNames = normalized.filter((d) => existingSet.has(d.departmentName)).map((d) => d.departmentName);
    if (!toInsert.length) {
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'No new departments to import',
        insertedCount: 0,
        skippedCount: skippedNames.length,
        skippedNames
      });
    }
    const inserted = await Department.insertMany(toInsert, { ordered: false });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Bulk import completed',
      insertedCount: inserted?.length || 0,
      skippedCount: skippedNames.length,
      skippedNames,
      data: inserted
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ status: false, message: 'Duplicate department found during import' });
    }
    return next(err);
  }
};

const createSubject = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const subjectName = toUpperName(payload.subjectName);
    const subjectCode = safeTrim(payload.subjectCode) || null;
    const category = safeTrim(payload.category) || 'academic';
    if (!subjectName) return res.status(400).json({ status: false, message: 'subjectName is required' });
    const doc = await Subject.create({
      tenantId,
      subjectName,
      subjectCode,
      category,
      isActive: payload.isActive === false ? false : true,
      isdeleted: false,
      createdBy: payload.createdBy || null,
      updatedBy: payload.updatedBy || null
    });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Subject created', data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Subject already exists' });
    return next(err);
  }
};

const listSubject = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req?.body?.entiId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const search = safeTrim(req.query.search);
    const list = safeTrim(req.query.list);
    const category = safeTrim(req.query.category);
    const isActive = req.query.isActive;
    const query = { tenantId, isdeleted: false };
    if (category) query.category = category;
    if (isActive !== undefined && isActive !== '') query.isActive = String(isActive) === 'true';
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ subjectName: rx }, { subjectCode: rx }];
    }
    if (list === 'full') {
      const rows = await Subject.find(query).sort({ subjectName: 1 }).lean();
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'Request success',
        data: rows,
        count: rows.length
      });
    }
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([Subject.find(query).sort({ subjectName: 1 }).skip(skip).limit(limit).lean(), Subject.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: rows,
      count
    });
  } catch (err) {
    return next(err);
  }
};

const viewSubject = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const subjectId = safeTrim(req.body.subjectId);
    if (!subjectId) return res.status(400).json({ status: false, message: 'subjectId is required' });
    const doc = await Subject.findOne({ _id: subjectId, tenantId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Subject not found' });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateSubject = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const subjectId = safeTrim(payload.subjectId);
    if (!subjectId) return res.status(400).json({ status: false, message: 'subjectId is required' });
    const patch = {};
    if (payload.subjectName !== undefined) patch.subjectName = toUpperName(payload.subjectName);
    if (payload.subjectCode !== undefined) patch.subjectCode = safeTrim(payload.subjectCode) || null;
    if (payload.category !== undefined) patch.category = safeTrim(payload.category) || 'academic';
    if (payload.isActive !== undefined) patch.isActive = payload.isActive === false ? false : true;
    if (payload.updatedBy !== undefined) patch.updatedBy = payload.updatedBy || null;
    if (patch.subjectName !== undefined && !patch.subjectName) {
      return res.status(400).json({ status: false, message: 'subjectName cannot be empty' });
    }
    const doc = await Subject.findOneAndUpdate({ _id: subjectId, tenantId, isdeleted: false }, { $set: patch }, { new: true });
    if (!doc) return res.status(404).json({ status: false, message: 'Subject not found' });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Subject updated', data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Subject already exists' });
    return next(err);
  }
};

const deleteSubject = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const subjectId = safeTrim(req.body.subjectId);
    if (!subjectId) return res.status(400).json({ status: false, message: 'subjectId is required' });
    const updatedBy = req.body.updatedBy || null;
    const doc = await Subject.findOneAndUpdate({ _id: subjectId, tenantId, isdeleted: false }, { $set: { isdeleted: true, isActive: false, updatedBy } }, { new: true });
    if (!doc) return res.status(404).json({ status: false, message: 'Subject not found' });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Subject deleted', data: doc });
  } catch (err) {
    return next(err);
  }
};

const bulkImportSubject = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const arr = Array.isArray(req.body.subjects) ? req.body.subjects : [];
    if (!arr.length) return res.status(400).json({ status: false, message: 'subjects must be a non-empty array' });
    const seen = new Set();
    const normalized = [];
    for (const it of arr) {
      const subjectName = toUpperName(it?.subjectName);
      if (!subjectName) continue;
      if (seen.has(subjectName)) continue;
      seen.add(subjectName);
      normalized.push({
        tenantId,
        subjectName,
        subjectCode: safeTrim(it?.subjectCode) || null,
        category: safeTrim(it?.category) || 'academic',
        isActive: it?.isActive === false ? false : true,
        isdeleted: false,
        createdBy: req.body.createdBy || null,
        updatedBy: req.body.updatedBy || null
      });
    }
    if (!normalized.length) {
      return res.status(400).json({ status: false, message: 'No valid subjectName found to import' });
    }
    const names = normalized.map((d) => d.subjectName);
    const existing = await Subject.find({ tenantId, isdeleted: false, subjectName: { $in: names } }, { _id: 0, subjectName: 1 }).lean();
    const existingSet = new Set((existing || []).map((e) => String(e.subjectName || '').toUpperCase()));
    const toInsert = normalized.filter((d) => !existingSet.has(d.subjectName));
    const skippedNames = normalized.filter((d) => existingSet.has(d.subjectName)).map((d) => d.subjectName);
    if (!toInsert.length) {
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'No new subjects to import',
        insertedCount: 0,
        skippedCount: skippedNames.length,
        skippedNames
      });
    }
    const inserted = await Subject.insertMany(toInsert, { ordered: false });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Bulk import completed',
      insertedCount: inserted?.length || 0,
      skippedCount: skippedNames.length,
      skippedNames,
      data: inserted
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Duplicate subject found during import' });
    return next(err);
  }
};

const createTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const classNo = toNum(req.body?.classNo);
    const subjectIdRaw = req.body?.subjectId;
    const topicName = safeTrim(req.body?.topicName);
    const topicCode = safeTrim(req.body?.topicCode) || null;
    const sortOrder = toNum(req.body?.sortOrder);
    if (!ensureClassNo(classNo) || !subjectIdRaw || !topicName) {
      return res.status(400).json({ status: false, message: 'classNo (6..13), subjectId, topicName are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(subjectIdRaw))) {
      return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    }
    const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const subj = await Subject.findOne({ tenantId, _id: subjectId, isdeleted: false }, { _id: 1 }).lean();
    if (!subj) return res.status(400).json({ status: false, message: 'Subject not found' });
    const doc = await Topic.create({
      tenantId,
      classNo,
      subjectId,
      topicName,
      topicCode,
      sortOrder,
      status: 'Active',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });
    return res.status(constants.HTTPS_CREATED || 201).json({ status: true, message: 'Topic created', data: doc });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return res.status(409).json({ status: false, message: 'Topic already exists for this class + subject' });
    }
    return next(err);
  }
};

const listTopics = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const list = req.query.list || '';
    const tenantId = req.body.entiId;
    const query = {
      tenantId: tenantId,
      isdeleted: false
    };
    if (req.query.classNo !== undefined && String(req.query.classNo).trim() !== '') {
      const cn = Number(req.query.classNo);
      if (Number.isFinite(cn)) {
        query.classNo = cn;
      }
    }
    if (req.query.subjectId !== undefined && String(req.query.subjectId).trim() !== '') {
      const sid = String(req.query.subjectId).trim();
      if (mongoose.Types.ObjectId.isValid(sid)) {
        query.subjectId = new mongoose.Types.ObjectId(sid);
      }
    }
    if (search) {
      const rx = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ topicName: rx }, { topicCode: rx }, { topicId: rx }];
    }
    if (String(list).toLowerCase() === 'full') {
      const rows = await Topic.find(query)
        .sort(sort)
        .populate({
          path: 'subjectId',
          model: 'subject',
          select: 'subjectName subjectCode'
        })
        .lean();
      return res.status(constants.HTTPS_SUCCESS).send({
        status: true,
        data: rows,
        count: rows.length,
        message: 'Topic details retrieved Successfully'
      });
    }
    const count = await Topic.countDocuments(query);
    const rows = await Topic.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'subjectId',
        model: 'subject',
        select: 'subjectName subjectCode'
      })
      .lean();
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: rows,
      page: page,
      count: count,
      message: 'Topic details retrieved Successfully'
    });
  } catch (err) {
    next(err);
  }
};

const deleteTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const classNo = toNum(req.body?.classNo);
    const subjectIdRaw = req.body?.subjectId;
    const topicId = safeTrim(req.body?.topicId);
    if (!ensureClassNo(classNo) || !subjectIdRaw || !topicId) {
      return res.status(400).json({ status: false, message: 'classNo (6..13), subjectId, topicId are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(subjectIdRaw))) {
      return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    }
    const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const tp = await Topic.findOne({ tenantId, classNo, subjectId, topicId, isdeleted: false });
    if (!tp) return res.status(404).json({ status: false, message: 'Topic not found' });
    tp.isdeleted = true;
    tp.updatedBy = userId || null;
    await tp.save();
    await SubTopic.updateMany({ tenantId, classNo, subjectId, topicId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } });
    return res.status(200).json({ status: true, message: 'Topic deleted', data: { topicId } });
  } catch (err) {
    return next(err);
  }
};

const bulkUpsertTopics = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows is required (non-empty array)' });
    const defaultClassNo = toNum(req.body?.classNo);
    const defaultSubjectIdRaw = req.body?.subjectId;
    const map = new Map();
    const subjectIdStrSet = new Set();
    let badRowCount = 0;
    for (const r of rows) {
      const classNo = toNum(r?.classNo ?? defaultClassNo);
      const subjectIdRaw = r?.subjectId ?? defaultSubjectIdRaw;
      const topicName = normName(r?.topicName);
      if (!ensureClassNo(classNo) || !subjectIdRaw || !topicName) {
        badRowCount++;
        continue;
      }
      const subjectIdStr = String(subjectIdRaw).trim();
      if (!mongoose.Types.ObjectId.isValid(subjectIdStr)) {
        badRowCount++;
        continue;
      }
      subjectIdStrSet.add(subjectIdStr);
      const key = `${classNo}__${subjectIdStr.toLowerCase()}__${topicName.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          classNo,
          subjectIdStr,
          topicName,
          topicCode: safeTrim(r?.topicCode) || null,
          sortOrder: toNum(r?.sortOrder)
        });
      }
    }
    const cleanRows = Array.from(map.values());
    if (!cleanRows.length) {
      return res.status(400).json({
        status: false,
        message: 'No valid topic rows. Each row requires classNo (6..13), subjectId (ObjectId), and topicName'
      });
    }
    const subjectIds = Array.from(subjectIdStrSet).map((id) => new mongoose.Types.ObjectId(id));
    const subjectDocs = await Subject.find({ tenantId, _id: { $in: subjectIds }, isdeleted: false }, { _id: 1 }).lean();
    const validSubjectSet = new Set(subjectDocs.map((s) => String(s._id)));
    const finalRows = cleanRows.filter((r) => validSubjectSet.has(r.subjectIdStr));
    if (!finalRows.length) {
      return res.status(400).json({
        status: false,
        message: 'No rows accepted. Subject not found / invalid for given tenant.'
      });
    }
    const ops = finalRows.map((r) => {
      const subjectId = new mongoose.Types.ObjectId(r.subjectIdStr);
      return {
        updateOne: {
          filter: {
            tenantId,
            classNo: r.classNo,
            subjectId,
            topicName: r.topicName,
            isdeleted: false
          },
          update: {
            $set: {
              topicCode: r.topicCode,
              sortOrder: r.sortOrder,
              status: 'Active',
              updatedBy: userId || null
            },
            $setOnInsert: {
              tenantId,
              classNo: r.classNo,
              subjectId,
              topicName: r.topicName,
              isdeleted: false,
              createdBy: userId || null
            }
          },
          upsert: true
        }
      };
    });
    const wr = await Topic.bulkWrite(ops, { ordered: false });
    const saved = await Topic.find(
      {
        tenantId,
        isdeleted: false,
        subjectId: { $in: subjectIds.filter((id) => validSubjectSet.has(String(id))) }
      },
      { _id: 0 }
    )
      .sort({ classNo: 1, sortOrder: 1, createdAt: 1 })
      .lean();
    return res.status(200).json({
      status: true,
      message: 'Bulk topics upserted',
      data: {
        input: rows.length,
        accepted: finalRows.length,
        skipped: rows.length - finalRows.length,
        invalidRows: badRowCount,
        matched: wr.matchedCount || 0,
        modified: wr.modifiedCount || 0,
        upserted: wr.upsertedCount || 0,
        rows: saved
      }
    });
  } catch (err) {
    return next(err);
  }
};

const viewTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const topicId = safeTrim(req.body?.topicId);
    if (!topicId) return res.status(400).json({ status: false, message: 'topicId is required' });

    const doc = await Topic.findOne({ tenantId, topicId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Topic not found' });

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const topicId = safeTrim(req.body?.topicId);
    if (!topicId) return res.status(400).json({ status: false, message: 'topicId is required' });

    const doc = await Topic.findOne({ tenantId, topicId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Topic not found' });

    const set = {};

    if (req.body?.topicName !== undefined) {
      const topicName = normName(req.body?.topicName);
      if (!topicName) return res.status(400).json({ status: false, message: 'topicName cannot be empty' });

      const dup = await Topic.findOne(
        {
          tenantId,
          classNo: doc.classNo,
          subjectId: doc.subjectId,
          topicName,
          isdeleted: false,
          topicId: { $ne: topicId }
        },
        { _id: 0, topicId: 1 }
      ).lean();

      if (dup) return res.status(409).json({ status: false, message: 'Topic already exists for this subject' });
      set.topicName = topicName;
    }

    if (req.body?.topicCode !== undefined) set.topicCode = safeTrim(req.body?.topicCode) || null;
    if (req.body?.sortOrder !== undefined) set.sortOrder = toNum(req.body?.sortOrder);

    if (req.body?.status !== undefined) {
      const st = safeTrim(req.body?.status);
      if (st && !['Active', 'Inactive'].includes(st)) {
        return res.status(400).json({ status: false, message: 'status must be Active or Inactive' });
      }
      if (st) set.status = st;
    }

    set.updatedBy = userId || null;

    await Topic.updateOne({ tenantId, topicId, isdeleted: false }, { $set: set });
    return res.status(200).json({ status: true, message: 'Topic updated', data: { topicId } });
  } catch (err) {
    return next(err);
  }
};

const createSubTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const classNo = toNum(req.body?.classNo);
    const subjectIdRaw = req.body?.subjectId;
    const topicId = safeTrim(req.body?.topicId);
    const subTopicName = safeTrim(req.body?.subTopicName);
    const subTopicCode = safeTrim(req.body?.subTopicCode) || null;
    const sortOrder = toNum(req.body?.sortOrder);
    if (!ensureClassNo(classNo) || !subjectIdRaw || !topicId || !subTopicName) {
      return res.status(400).json({ status: false, message: 'classNo (6..13), subjectId, topicId, subTopicName are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(subjectIdRaw))) {
      return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    }
    const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const tp = await Topic.findOne({ tenantId, classNo, subjectId, topicId, isdeleted: false }, { _id: 0, topicId: 1 }).lean();
    if (!tp) return res.status(400).json({ status: false, message: 'Topic not found for given class + subject' });
    const doc = await SubTopic.create({
      tenantId,
      classNo,
      subjectId,
      topicId,
      subTopicName,
      subTopicCode,
      sortOrder,
      status: 'Active',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });
    return res.status(constants.HTTPS_CREATED || 201).json({ status: true, message: 'Sub-topic created', data: doc });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return res.status(409).json({ status: false, message: 'Sub-topic already exists for this topic' });
    }
    return next(err);
  }
};

const listSubTopics = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const list = req.query.list || '';
    const tenantId = req.body.entiId;
    const query = {
      tenantId: tenantId,
      isdeleted: false
    };
    if (req.query.classNo !== undefined && String(req.query.classNo).trim() !== '') {
      const cn = Number(req.query.classNo);
      if (Number.isFinite(cn)) {
        query.classNo = cn;
      }
    }
    if (req.query.subjectId !== undefined && String(req.query.subjectId).trim() !== '') {
      const sid = String(req.query.subjectId).trim();
      if (mongoose.Types.ObjectId.isValid(sid)) {
        query.subjectId = new mongoose.Types.ObjectId(sid);
      }
    }
    if (req.query.topicId !== undefined && String(req.query.topicId).trim() !== '') {
      query.topicId = String(req.query.topicId).trim();
    }
    if (search) {
      const rx = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ subTopicName: rx }, { subTopicCode: rx }, { subTopicId: rx }];
    }
    if (String(list).toLowerCase() === 'full') {
      const rows = await SubTopic.find(query)
        .sort(sort)
        .populate({
          path: 'subjectId',
          model: 'subject',
          select: 'subjectName subjectCode'
        })
        .populate({
          path: 'topicId',
          model: 'topic',
          localField: 'topicId',
          foreignField: 'topicId',
          select: 'topicName topicCode'
        })
        .lean();
      return res.status(constants.HTTPS_SUCCESS).send({
        status: true,
        data: rows,
        count: rows.length,
        message: 'SubTopic details retrieved Successfully'
      });
    }
    const count = await SubTopic.countDocuments(query);
    const rows = await SubTopic.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'subjectId',
        model: 'subject',
        select: 'subjectName subjectCode'
      })
      .populate({
        path: 'topicId',
        model: 'topic',
        localField: 'topicId',
        foreignField: 'topicId',
        select: 'topicName topicCode'
      })
      .lean();
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: rows,
      page: page,
      count: count,
      message: 'SubTopic details retrieved Successfully'
    });
  } catch (err) {
    next(err);
  }
};

const deleteSubTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const classNo = toNum(req.body?.classNo);
    const subjectIdRaw = req.body?.subjectId;
    const topicId = safeTrim(req.body?.topicId);
    const subTopicId = safeTrim(req.body?.subTopicId);
    if (!ensureClassNo(classNo) || !subjectIdRaw || !topicId || !subTopicId) {
      return res.status(400).json({ status: false, message: 'classNo (6..13), subjectId, topicId, subTopicId are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(subjectIdRaw))) {
      return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    }
    const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const st = await SubTopic.findOne({ tenantId, classNo, subjectId, topicId, subTopicId, isdeleted: false });
    if (!st) return res.status(404).json({ status: false, message: 'Sub-topic not found' });
    st.isdeleted = true;
    st.updatedBy = userId || null;
    await st.save();
    return res.status(200).json({ status: true, message: 'Sub-topic deleted', data: { subTopicId } });
  } catch (err) {
    return next(err);
  }
};

const bulkUpsertSubTopics = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const classNo = toNum(req.body?.classNo);
    const subjectIdRaw = req.body?.subjectId;
    const topicId = safeTrim(req.body?.topicId);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!ensureClassNo(classNo) || !subjectIdRaw || !topicId) {
      return res.status(400).json({ status: false, message: 'classNo (6..13), subjectId, topicId are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(subjectIdRaw))) {
      return res.status(400).json({ status: false, message: 'Invalid subjectId' });
    }
    const subjectId = new mongoose.Types.ObjectId(String(subjectIdRaw));
    const tp = await Topic.findOne({ tenantId, classNo, subjectId, topicId, isdeleted: false }, { _id: 0, topicId: 1 }).lean();
    if (!tp) return res.status(400).json({ status: false, message: 'Topic not found for given class + subject' });
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows is required (non-empty array)' });
    const map = new Map();
    for (const r of rows) {
      const subTopicName = normName(r?.subTopicName);
      if (!subTopicName) continue;
      const key = subTopicName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          subTopicName,
          subTopicCode: safeTrim(r?.subTopicCode) || null,
          sortOrder: toNum(r?.sortOrder)
        });
      }
    }
    const cleanRows = Array.from(map.values());
    if (!cleanRows.length) {
      return res.status(400).json({ status: false, message: 'No valid subtopic rows (subTopicName missing)' });
    }
    const ops = cleanRows.map((r) => ({
      updateOne: {
        filter: { tenantId, classNo, subjectId, topicId, subTopicName: r.subTopicName, isdeleted: false },
        update: {
          $set: {
            subTopicCode: r.subTopicCode,
            sortOrder: r.sortOrder,
            status: 'Active',
            updatedBy: userId || null
          },
          $setOnInsert: {
            tenantId,
            classNo,
            subjectId,
            topicId,
            subTopicName: r.subTopicName,
            isdeleted: false,
            createdBy: userId || null
          }
        },
        upsert: true
      }
    }));
    const wr = await SubTopic.bulkWrite(ops, { ordered: false });
    const saved = await SubTopic.find({ tenantId, classNo, subjectId, topicId, isdeleted: false }, { _id: 0 }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    return res.status(200).json({
      status: true,
      message: 'Bulk sub-topics upserted',
      data: {
        input: rows.length,
        accepted: cleanRows.length,
        matched: wr.matchedCount || 0,
        modified: wr.modifiedCount || 0,
        upserted: wr.upsertedCount || 0,
        rows: saved
      }
    });
  } catch (err) {
    return next(err);
  }
};

const viewSubTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const subTopicId = safeTrim(req.body?.subTopicId);
    if (!subTopicId) return res.status(400).json({ status: false, message: 'subTopicId is required' });

    const doc = await SubTopic.findOne({ tenantId, subTopicId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Sub-topic not found' });

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateSubTopic = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const subTopicId = safeTrim(req.body?.subTopicId);
    if (!subTopicId) return res.status(400).json({ status: false, message: 'subTopicId is required' });

    const doc = await SubTopic.findOne({ tenantId, subTopicId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Sub-topic not found' });

    const set = {};

    if (req.body?.subTopicName !== undefined) {
      const subTopicName = normName(req.body?.subTopicName);
      if (!subTopicName) return res.status(400).json({ status: false, message: 'subTopicName cannot be empty' });

      const dup = await SubTopic.findOne(
        {
          tenantId,
          classNo: doc.classNo,
          subjectId: doc.subjectId,
          topicId: doc.topicId,
          subTopicName,
          isdeleted: false,
          subTopicId: { $ne: subTopicId }
        },
        { _id: 0, subTopicId: 1 }
      ).lean();

      if (dup) return res.status(409).json({ status: false, message: 'Sub-topic already exists for this topic' });
      set.subTopicName = subTopicName;
    }

    if (req.body?.subTopicCode !== undefined) set.subTopicCode = safeTrim(req.body?.subTopicCode) || null;
    if (req.body?.sortOrder !== undefined) set.sortOrder = toNum(req.body?.sortOrder);

    if (req.body?.status !== undefined) {
      const st = safeTrim(req.body?.status);
      if (st && !['Active', 'Inactive'].includes(st)) {
        return res.status(400).json({ status: false, message: 'status must be Active or Inactive' });
      }
      if (st) set.status = st;
    }

    set.updatedBy = userId || null;

    await SubTopic.updateOne({ tenantId, subTopicId, isdeleted: false }, { $set: set });
    return res.status(200).json({ status: true, message: 'Sub-topic updated', data: { subTopicId } });
  } catch (err) {
    return next(err);
  }
};

const bulkUpsertExamCategories = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows is required (non-empty array)' });
    const map = new Map();
    for (const r of rows) {
      const categoryName = normName(r?.categoryName);
      if (!categoryName) continue;
      const key = categoryName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          categoryName,
          categoryCode: safeTrim(r?.categoryCode) || null
        });
      }
    }
    const cleanRows = Array.from(map.values());
    if (!cleanRows.length) return res.status(400).json({ status: false, message: 'No valid category rows (categoryName missing)' });
    const ops = cleanRows.map((r) => ({
      updateOne: {
        filter: { tenantId, categoryName: r.categoryName, isdeleted: false },
        update: {
          $set: {
            categoryCode: r.categoryCode,
            status: 'Active',
            updatedBy: userId || null
          },
          $setOnInsert: {
            tenantId,
            categoryName: r.categoryName,
            isdeleted: false,
            createdBy: userId || null
          }
        },
        upsert: true
      }
    }));
    const wr = await ExamCategory.bulkWrite(ops, { ordered: false });
    const saved = await ExamCategory.find({ tenantId, isdeleted: false }, { _id: 0 }).sort({ categoryName: 1, createdAt: 1 }).lean();
    return res.status(200).json({
      status: true,
      message: 'Bulk exam categories upserted',
      data: {
        input: rows.length,
        accepted: cleanRows.length,
        matched: wr.matchedCount || 0,
        modified: wr.modifiedCount || 0,
        upserted: wr.upsertedCount || 0,
        rows: saved
      }
    });
  } catch (err) {
    return next(err);
  }
};

const listExamCategories = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const list = req.query.list || '';
    const tenantId = req.body.entiId;
    const query = {
      tenantId: tenantId,
      isdeleted: false
    };
    if (search) {
      const rx = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ categoryName: rx }, { categoryCode: rx }, { categoryId: rx }];
    }
    if (String(list).toLowerCase() === 'full') {
      const rows = await ExamCategory.find(query).sort(sort).lean();
      return res.status(constants.HTTPS_SUCCESS).send({
        status: true,
        data: rows,
        count: rows.length,
        message: 'Exam Category details retrieved Successfully'
      });
    }
    const count = await ExamCategory.countDocuments(query);
    const rows = await ExamCategory.find(query).sort(sort).skip(skip).limit(limit).lean();
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: rows,
      page: page,
      count: count,
      message: 'Exam Category details retrieved Successfully'
    });
  } catch (err) {
    next(err);
  }
};

const viewExamCategory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const categoryId = safeTrim(req.body?.categoryId);
    if (!categoryId) return res.status(400).json({ status: false, message: 'categoryId is required' });

    const doc = await ExamCategory.findOne({ tenantId, categoryId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Category not found' });

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: doc });
  } catch (err) {
    return next(err);
  }
};

const createExamCategory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const categoryName = normName(req.body?.categoryName);
    const categoryCode = safeTrim(req.body?.categoryCode) || null;
    if (!categoryName) return res.status(400).json({ status: false, message: 'categoryName is required' });
    const exists = await ExamCategory.findOne({ tenantId, categoryName, isdeleted: false }, { _id: 0, categoryId: 1 }).lean();
    if (exists) return res.status(409).json({ status: false, message: 'Category already exists' });
    const doc = await ExamCategory.create({
      tenantId,
      categoryName,
      categoryCode,
      status: 'Active',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });
    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Exam category created',
      data: { categoryId: doc.categoryId }
    });
  } catch (err) {
    return next(err);
  }
};

const editExamCategory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const categoryId = safeTrim(req.body?.categoryId);
    if (!categoryId) return res.status(400).json({ status: false, message: 'categoryId is required' });
    const doc = await ExamCategory.findOne({ tenantId, categoryId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Category not found' });
    const set = {};
    if (req.body?.categoryName !== undefined) {
      const categoryName = normName(req.body?.categoryName);
      if (!categoryName) return res.status(400).json({ status: false, message: 'categoryName cannot be empty' });
      const dup = await ExamCategory.findOne({ tenantId, categoryName, isdeleted: false, categoryId: { $ne: categoryId } }, { _id: 0, categoryId: 1 }).lean();
      if (dup) return res.status(409).json({ status: false, message: 'Category name already exists' });
      set.categoryName = categoryName;
    }
    if (req.body?.categoryCode !== undefined) {
      set.categoryCode = safeTrim(req.body?.categoryCode) || null;
    }
    if (req.body?.status !== undefined) {
      const st = safeTrim(req.body?.status);
      if (st && !['Active', 'Inactive'].includes(st)) {
        return res.status(400).json({ status: false, message: 'status must be Active or Inactive' });
      }
      if (st) set.status = st;
    }
    set.updatedBy = userId || null;
    await ExamCategory.updateOne({ tenantId, categoryId, isdeleted: false }, { $set: set });
    return res.status(200).json({ status: true, message: 'Exam category updated', data: { categoryId } });
  } catch (err) {
    return next(err);
  }
};

const deleteExamCategory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const categoryId = safeTrim(req.body?.categoryId);
    if (!categoryId) return res.status(400).json({ status: false, message: 'categoryId is required' });
    const doc = await ExamCategory.findOne({ tenantId, categoryId, isdeleted: false }, { _id: 0, categoryId: 1 }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Category not found' });
    const hasSubs = await ExamSubCategory.exists({ tenantId, categoryId, isdeleted: false });
    if (hasSubs) {
      return res.status(400).json({ status: false, message: 'Cannot delete category. Sub-categories exist.' });
    }
    await ExamCategory.updateOne({ tenantId, categoryId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } });
    return res.status(200).json({ status: true, message: 'Exam category deleted', data: { categoryId } });
  } catch (err) {
    return next(err);
  }
};

const createExamSubCategory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const categoryId = safeTrim(req.body?.categoryId);
    const subCategoryName = normName(req.body?.subCategoryName);
    const subCategoryCode = safeTrim(req.body?.subCategoryCode) || null;
    const sortOrder = toNum(req.body?.sortOrder);
    if (!categoryId) return res.status(400).json({ status: false, message: 'categoryId is required' });
    if (!subCategoryName) return res.status(400).json({ status: false, message: 'subCategoryName is required' });
    const cat = await ExamCategory.findOne({ tenantId, categoryId, isdeleted: false }, { _id: 0, categoryId: 1 }).lean();
    if (!cat) return res.status(400).json({ status: false, message: 'Exam category not found' });
    const exists = await ExamSubCategory.findOne({ tenantId, categoryId, subCategoryName, isdeleted: false }, { _id: 0, subCategoryId: 1 }).lean();
    if (exists) return res.status(409).json({ status: false, message: 'Sub-category already exists for this category' });
    const doc = await ExamSubCategory.create({
      tenantId,
      categoryId,
      subCategoryName,
      subCategoryCode,
      sortOrder,
      status: 'Active',
      isdeleted: false,
      createdBy: userId || null,
      updatedBy: userId || null
    });
    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Exam sub-category created',
      data: { subCategoryId: doc.subCategoryId }
    });
  } catch (err) {
    return next(err);
  }
};

const editExamSubCategory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const subCategoryId = safeTrim(req.body?.subCategoryId);
    const categoryId = safeTrim(req.body?.categoryId);
    if (!subCategoryId) return res.status(400).json({ status: false, message: 'subCategoryId is required' });
    if (!categoryId) return res.status(400).json({ status: false, message: 'categoryId is required' });
    const doc = await ExamSubCategory.findOne({ tenantId, subCategoryId, categoryId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Sub-category not found' });
    const set = {};
    if (req.body?.subCategoryName !== undefined) {
      const subCategoryName = normName(req.body?.subCategoryName);
      if (!subCategoryName) return res.status(400).json({ status: false, message: 'subCategoryName cannot be empty' });
      const dup = await ExamSubCategory.findOne({ tenantId, categoryId, subCategoryName, isdeleted: false, subCategoryId: { $ne: subCategoryId } }, { _id: 0, subCategoryId: 1 }).lean();
      if (dup) return res.status(409).json({ status: false, message: 'Sub-category name already exists for this category' });

      set.subCategoryName = subCategoryName;
    }
    if (req.body?.subCategoryCode !== undefined) {
      set.subCategoryCode = safeTrim(req.body?.subCategoryCode) || null;
    }
    if (req.body?.sortOrder !== undefined) {
      set.sortOrder = toNum(req.body?.sortOrder);
    }
    if (req.body?.status !== undefined) {
      const st = safeTrim(req.body?.status);
      if (st && !['Active', 'Inactive'].includes(st)) {
        return res.status(400).json({ status: false, message: 'status must be Active or Inactive' });
      }
      if (st) set.status = st;
    }
    set.updatedBy = userId || null;
    await ExamSubCategory.updateOne({ tenantId, subCategoryId, categoryId, isdeleted: false }, { $set: set });
    return res.status(200).json({ status: true, message: 'Exam sub-category updated', data: { subCategoryId } });
  } catch (err) {
    return next(err);
  }
};

const deleteExamSubCategory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const categoryId = safeTrim(req.body?.categoryId);
    const subCategoryId = safeTrim(req.body?.subCategoryId);
    if (!categoryId || !subCategoryId) {
      return res.status(400).json({ status: false, message: 'categoryId and subCategoryId are required' });
    }
    const doc = await ExamSubCategory.findOne({ tenantId, categoryId, subCategoryId, isdeleted: false }, { _id: 0, subCategoryId: 1 }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Sub-category not found' });
    await ExamSubCategory.updateOne({ tenantId, categoryId, subCategoryId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } });
    return res.status(200).json({ status: true, message: 'Exam sub-category deleted', data: { subCategoryId } });
  } catch (err) {
    return next(err);
  }
};

const viewExamSubCategory = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const categoryId = safeTrim(req.body?.categoryId);
    const subCategoryId = safeTrim(req.body?.subCategoryId);
    if (!categoryId || !subCategoryId) {
      return res.status(400).json({ status: false, message: 'categoryId and subCategoryId are required' });
    }

    const doc = await ExamSubCategory.findOne({ tenantId, categoryId, subCategoryId, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Sub-category not found' });

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: doc });
  } catch (err) {
    return next(err);
  }
};

const listExamSubCategories = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || '-createdAt';
    const search = req.query.search || '';
    const list = req.query.list || '';
    const tenantId = req.body.entiId;
    const query = {
      tenantId: tenantId,
      isdeleted: false
    };
    if (req.query.categoryId !== undefined && String(req.query.categoryId).trim() !== '') {
      query.categoryId = String(req.query.categoryId).trim();
    }
    if (search) {
      const rx = { $regex: search.trim(), $options: 'i' };
      query.$or = [{ subCategoryName: rx }, { subCategoryCode: rx }, { subCategoryId: rx }];
    }
    if (String(list).toLowerCase() === 'full') {
      const rows = await ExamSubCategory.find(query).sort(sort).lean();
      return res.status(constants.HTTPS_SUCCESS).send({
        status: true,
        data: rows,
        count: rows.length,
        message: 'Exam SubCategory details retrieved Successfully'
      });
    }
    const count = await ExamSubCategory.countDocuments(query);
    const rows = await ExamSubCategory.find(query).sort(sort).skip(skip).limit(limit).lean();
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: rows,
      page: page,
      count: count,
      message: 'Exam SubCategory details retrieved Successfully'
    });
  } catch (err) {
    next(err);
  }
};

const bulkUpsertExamSubCategories = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const categoryId = safeTrim(req.body?.categoryId);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!categoryId) {
      return res.status(400).json({ status: false, message: 'categoryId is required' });
    }
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows is required (non-empty array)' });
    const cat = await ExamCategory.findOne({ tenantId, categoryId, isdeleted: false }, { _id: 0, categoryId: 1 }).lean();
    if (!cat) return res.status(400).json({ status: false, message: 'Exam category not found' });
    const map = new Map();
    for (const r of rows) {
      const subCategoryName = normName(r?.subCategoryName);
      if (!subCategoryName) continue;
      const key = subCategoryName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          subCategoryName,
          subCategoryCode: safeTrim(r?.subCategoryCode) || null,
          sortOrder: toNum(r?.sortOrder)
        });
      }
    }
    const cleanRows = Array.from(map.values());
    if (!cleanRows.length) return res.status(400).json({ status: false, message: 'No valid subcategory rows (subCategoryName missing)' });
    const ops = cleanRows.map((r) => ({
      updateOne: {
        filter: { tenantId, categoryId, subCategoryName: r.subCategoryName, isdeleted: false },
        update: {
          $set: {
            subCategoryCode: r.subCategoryCode,
            sortOrder: r.sortOrder,
            status: 'Active',
            updatedBy: userId || null
          },
          $setOnInsert: {
            tenantId,
            categoryId,
            subCategoryName: r.subCategoryName,
            isdeleted: false,
            createdBy: userId || null
          }
        },
        upsert: true
      }
    }));
    const wr = await ExamSubCategory.bulkWrite(ops, { ordered: false });
    const saved = await ExamSubCategory.find({ tenantId, categoryId, isdeleted: false }, { _id: 0 }).sort({ sortOrder: 1, subCategoryName: 1, createdAt: 1 }).lean();
    return res.status(200).json({
      status: true,
      message: 'Bulk exam sub-categories upserted',
      data: {
        categoryId,
        input: rows.length,
        accepted: cleanRows.length,
        matched: wr.matchedCount || 0,
        modified: wr.modifiedCount || 0,
        upserted: wr.upsertedCount || 0,
        rows: saved
      }
    });
  } catch (err) {
    return next(err);
  }
};

const createSchoolExam = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { examName, academicYear, classNo, startDate, endDate } = req.body;

    if (!tenantId || !examName || !academicYear || !classNo) {
      return res.status(400).json({ status: false, message: 'tenantId, examName, academicYear, and classNo are required' });
    }
    const exam = await SchoolExam.create({
      tenantId,
      examName: safeTrim(examName),
      academicYear: safeTrim(academicYear),
      classNo: toNum(classNo),
      startDate: startDate ? toNum(startDate) : null,
      endDate: endDate ? toNum(endDate) : null,
      createdBy: req.body?.userId || null
    });

    return res.status(201).json({ status: true, message: 'School exam created successfully', data: exam });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ status: false, message: 'Exam already exists for this class and academic year' });
    return next(err);
  }
};

// 3c. List School Exams
const listSchoolExams = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const { academicYear, classNo, status, page = 1, limit = 20 } = req.body;

    const query = { tenantId, isdeleted: false };
    if (academicYear) query.academicYear = safeTrim(academicYear);
    if (classNo) query.classNo = toNum(classNo);
    if (status) query.status = safeTrim(status);

    const skip = (Math.max(1, toInt(page)) - 1) * Math.min(200, Math.max(1, toInt(limit)));

    const [rows, count] = await Promise.all([SchoolExam.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SchoolExam.countDocuments(query)]);

    return res.status(200).json({
      status: true,
      message: 'School exams retrieved successfully',
      data: rows,
      count,
      page,
      limit
    });
  } catch (err) {
    return next(err);
  }
};

// 3d. Update/Edit School Exam
const updateSchoolExam = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const examId = safeTrim(req.body?.examId);

    if (!tenantId || !examId) {
      return res.status(400).json({ status: false, message: 'tenantId and examId are required' });
    }

    const exam = await SchoolExam.findOne({ tenantId, examId, isdeleted: false });
    if (!exam) return res.status(404).json({ status: false, message: 'School exam not found' });

    const updates = {};
    if (req.body.examName) updates.examName = safeTrim(req.body.examName);
    if (req.body.academicYear) updates.academicYear = safeTrim(req.body.academicYear);
    if (req.body.classNo) updates.classNo = toNum(req.body.classNo);
    if (req.body.startDate !== undefined) updates.startDate = req.body.startDate ? toNum(req.body.startDate) : null;
    if (req.body.endDate !== undefined) updates.endDate = req.body.endDate ? toNum(req.body.endDate) : null;
    if (req.body.status) updates.status = safeTrim(req.body.status);

    if (Object.keys(updates).length > 0) {
      updates.updatedBy = req.body?.userId || null;

      // Check for unique constraint violation if critical fields are changed
      if (updates.examName || updates.academicYear || updates.classNo) {
        const checkName = updates.examName || exam.examName;
        const checkAy = updates.academicYear || exam.academicYear;
        const checkClass = updates.classNo || exam.classNo;

        const duplicate = await SchoolExam.findOne({
          tenantId,
          isdeleted: false,
          examId: { $ne: examId },
          examName: checkName,
          academicYear: checkAy,
          classNo: checkClass
        }).lean();

        if (duplicate) {
          return res.status(409).json({ status: false, message: 'Another exam already exists for this name, class, and academic year' });
        }
      }

      const updatedDoc = await SchoolExam.findOneAndUpdate({ tenantId, examId, isdeleted: false }, { $set: updates }, { new: true }).lean();

      return res.status(200).json({ status: true, message: 'School exam updated', data: updatedDoc });
    }

    return res.status(400).json({ status: false, message: 'No valid fields provided for update' });
  } catch (err) {
    return next(err);
  }
};

const deleteSchoolExam = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const examId = safeTrim(req.body?.examId);

    if (!tenantId || !examId) return res.status(400).json({ status: false, message: 'tenantId and examId are required' });

    const deletedDoc = await SchoolExam.findOneAndUpdate({ tenantId, examId, isdeleted: false }, { $set: { isdeleted: true, updatedBy: req.body?.userId || null } }, { new: true }).lean();

    if (!deletedDoc) return res.status(404).json({ status: false, message: 'School exam not found or already deleted' });

    return res.status(200).json({ status: true, message: 'School exam deleted successfully' });
  } catch (err) {
    return next(err);
  }
};

// 3f. Bulk Upload School Exams
const bulkUploadSchoolExams = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const userId = safeTrim(req.body?.userId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows array cannot be empty' });

    const ops = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const examName = safeTrim(row.examName);
      const academicYear = safeTrim(row.academicYear);
      const classNo = toNum(row.classNo);

      if (!examName || !academicYear || !classNo) {
        errors.push({ row: i + 1, message: 'examName, academicYear, and classNo are required' });
        continue;
      }

      ops.push({
        updateOne: {
          filter: { tenantId, examName, academicYear, classNo, isdeleted: false },
          update: {
            $set: {
              tenantId,
              examName,
              academicYear,
              classNo,
              startDate: row.startDate ? toNum(row.startDate) : null,
              endDate: row.endDate ? toNum(row.endDate) : null,
              status: safeTrim(row.status) || 'PLANNED',
              updatedBy: userId || null
            },
            $setOnInsert: {
              examId: uuid(),
              createdBy: userId || null
            }
          },
          upsert: true // Creates if it doesn't exist, updates if it does
        }
      });
    }

    if (!ops.length) return res.status(400).json({ status: false, message: 'No valid rows to process', errors });

    const result = await SchoolExam.bulkWrite(ops, { ordered: false });

    return res.status(200).json({
      status: true,
      message: 'Bulk upload completed',
      data: {
        inserted: result.upsertedCount || 0,
        updated: result.modifiedCount || 0
      },
      errors
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createDepartment,
  listDepartments,
  viewDepartment,
  updateDepartment,
  deleteDepartment,
  bulkImportDepartments,
  createSubject,
  listSubject,
  updateSubject,
  deleteSubject,
  bulkImportSubject,
  viewSubject,
  createTopic,
  listTopics,
  createSubTopic,
  listSubTopics,
  deleteTopic,
  deleteSubTopic,
  bulkUpsertTopics,
  bulkUpsertSubTopics,
  bulkUpsertExamCategories,
  bulkUpsertExamSubCategories,
  listExamCategories,
  listExamSubCategories,
  createExamCategory,
  editExamCategory,
  deleteExamCategory,
  createExamSubCategory,
  editExamSubCategory,
  deleteExamSubCategory,
  viewTopic,
  updateTopic,
  viewSubTopic,
  updateSubTopic,
  viewExamCategory,
  viewExamSubCategory,
  createSchoolExam,
  listSchoolExams,
  updateSchoolExam,
  deleteSchoolExam,
  bulkUploadSchoolExams
};
