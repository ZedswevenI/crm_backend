import constants from '../helpers/constants.js';
import Department from '../models/department.model.js';
import Subject from '../models/subject.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toUpperName = (v) => {
  const s = safeTrim(v);
  return s ? s.toUpperCase() : '';
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  viewSubject
};
