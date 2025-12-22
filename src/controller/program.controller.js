import constants from '../helpers/constants.js';
import Program from '../models/program.model.js';

const pickTenantId = (req) => (req.body?.entiId || req.body?.tenantId || '').toString().trim();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();

const createProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const doc = await Program.create({
      tenantId,
      academicYear: safeTrim(payload.academicYear),
      studyingClass: safeTrim(payload.studyingClass),
      goingToClass: payload.goingToClass ? safeTrim(payload.goingToClass) : null,
      programName: safeTrim(payload.programName),
      programCodes: payload.programCodes,
      programType: payload.programType ? safeTrim(payload.programType) : null,
      duration: payload.duration ? safeTrim(payload.duration) : null,
      target: payload.target ? safeTrim(payload.target) : null,
      excelId: payload.excelId ?? null,
      options: Array.isArray(payload.options) ? payload.options : [],
      status: payload.status || 'Active',
      isdeleted: false
    });
    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Program created successfully',
      data: doc
    });
  } catch (err) {
    console.log('err ', err);
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const viewProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const doc = await Program.findOne({ _id: recId, tenantId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Program not found' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const payload = req.body || {};
    const updateDoc = {};
    if (payload.academicYear !== undefined) updateDoc.academicYear = safeTrim(payload.academicYear);
    if (payload.studyingClass !== undefined) updateDoc.studyingClass = safeTrim(payload.studyingClass);
    if (payload.goingToClass !== undefined) updateDoc.goingToClass = payload.goingToClass ? safeTrim(payload.goingToClass) : null;
    if (payload.programName !== undefined) updateDoc.programName = safeTrim(payload.programName);
    if (payload.programCodes !== undefined) updateDoc.programCodes = payload.programCodes;
    if (payload.programType !== undefined) updateDoc.programType = payload.programType ? safeTrim(payload.programType) : null;
    if (payload.duration !== undefined) updateDoc.duration = payload.duration ? safeTrim(payload.duration) : null;
    if (payload.target !== undefined) updateDoc.target = payload.target ? safeTrim(payload.target) : null;
    if (payload.excelId !== undefined) updateDoc.excelId = payload.excelId ?? null;
    if (payload.options !== undefined) updateDoc.options = Array.isArray(payload.options) ? payload.options : [];
    if (payload.status !== undefined) updateDoc.status = payload.status;
    if (!Object.keys(updateDoc).length) {
      return res.status(400).json({ status: false, message: 'No fields to update' });
    }
    const updated = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ status: false, message: 'Program not found or already deleted' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program updated successfully',
      data: updated
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const deleteProgram = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const deleted = await Program.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true });
    if (!deleted) return res.status(404).json({ status: false, message: 'Program not found or already deleted' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program deleted successfully',
      data: deleted
    });
  } catch (err) {
    return next(err);
  }
};

const listPrograms = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required in query' });
    const listType = req.query.list;
    const sort = req.query.sort || '-createdAt';
    const search = safeTrim(req.query.search);
    const academicYear = safeTrim(req.query.academicYear);
    const studyingClass = safeTrim(req.query.studyingClass);
    const status = safeTrim(req.query.status);
    const query = { tenantId, isdeleted: false };
    if (academicYear) query.academicYear = academicYear;
    if (studyingClass) query.studyingClass = studyingClass;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { programName: { $regex: search, $options: 'i' } },
        { programType: { $regex: search, $options: 'i' } },
        { target: { $regex: search, $options: 'i' } },
        { duration: { $regex: search, $options: 'i' } },
        { programCodes: { $regex: search, $options: 'i' } },
        { 'options.version': { $regex: search, $options: 'i' } }
      ];
    }
    let data;
    let count;
    let page;
    if (listType === 'full') {
      data = await Program.find(query).sort('createdAt');
      count = data.length;
    } else {
      page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;
      count = await Program.countDocuments(query);
      data = await Program.find(query).sort(sort).skip(skip).limit(limit);
    }
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Program list retrieved successfully',
      data,
      page,
      count
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createProgram,
  viewProgram,
  updateProgram,
  deleteProgram,
  listPrograms
};
