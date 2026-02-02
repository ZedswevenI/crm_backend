import constants from '../helpers/constants.js';
import AcademicYear from '../models/academicYear.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toEpoch = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createAcademicYear = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const academicYear = safeTrim(payload.academicYear);
    const startOn = toEpoch(payload.startOn);
    const endOn = toEpoch(payload.endOn);
    if (!academicYear || !startOn || !endOn) {
      return res.status(400).json({ status: false, message: 'academicYear, startOn, endOn are required' });
    }
    if (startOn >= endOn) return res.status(400).json({ status: false, message: 'startOn must be before endOn' });
    const doc = await AcademicYear.create({
      tenantId,
      academicYear,
      startOn,
      endOn,
      label: safeTrim(payload.label) || null,
      status: safeTrim(payload.status) || 'Active',
      isdeleted: false,
      createdBy: payload.userId || null,
      updatedBy: payload.userId || null
    });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Academic year created', data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Academic year already exists' });
    return next(err);
  }
};

const listAcademicYears = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const list = safeTrim(req.query.list);
    const search = safeTrim(req.query.search);
    const status = safeTrim(req.query.status);
    const sort = safeTrim(req.query.sort) || 'startOn';
    const query = { tenantId, isdeleted: false };
    if (status && status !== 'ALL') query.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ academicYear: rx }, { label: rx }];
    }
    if (list === 'full') {
      const rows = await AcademicYear.find(query).sort(sort).lean();
      return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: rows, count: rows.length });
    }
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([AcademicYear.find(query).sort(sort).skip(skip).limit(limit).lean(), AcademicYear.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: rows, count });
  } catch (err) {
    return next(err);
  }
};

const viewAcademicYear = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const academicYear = safeTrim(req.body?.academicYear);
    const recId = safeTrim(req.body?.recId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId && !academicYear) return res.status(400).json({ status: false, message: 'recId or academicYear is required' });
    const q = { tenantId, isdeleted: false };
    if (recId) q._id = recId;
    if (academicYear) q.academicYear = academicYear;
    const doc = await AcademicYear.findOne(q).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Academic year not found' });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Request success', data: doc });
  } catch (err) {
    return next(err);
  }
};

const updateAcademicYear = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = safeTrim(req.body?.recId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const payload = req.body || {};
    const patch = {};
    if (payload.academicYear !== undefined) patch.academicYear = safeTrim(payload.academicYear);
    if (payload.startOn !== undefined) patch.startOn = toEpoch(payload.startOn);
    if (payload.endOn !== undefined) patch.endOn = toEpoch(payload.endOn);
    if (payload.label !== undefined) patch.label = safeTrim(payload.label) || null;
    if (payload.status !== undefined) patch.status = safeTrim(payload.status) || 'Active';
    patch.updatedBy = payload.userId || null;
    const doc0 = await AcademicYear.findOne({ _id: recId, tenantId, isdeleted: false });
    if (!doc0) return res.status(404).json({ status: false, message: 'Academic year not found' });
    const s = patch.startOn !== undefined ? patch.startOn : doc0.startOn;
    const e = patch.endOn !== undefined ? patch.endOn : doc0.endOn;
    if (s && e && s >= e) return res.status(400).json({ status: false, message: 'startOn must be before endOn' });
    const doc = await AcademicYear.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: patch }, { new: true }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Academic year updated', data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Academic year already exists' });
    return next(err);
  }
};

const deleteAcademicYear = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = safeTrim(req.body?.recId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const doc = await AcademicYear.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true, status: 'Inactive', updatedBy: req.body.userId || null } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Academic year not found' });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Academic year deleted', data: doc });
  } catch (err) {
    return next(err);
  }
};

export default {
  createAcademicYear,
  listAcademicYears,
  viewAcademicYear,
  updateAcademicYear,
  deleteAcademicYear
};
