import constants from '../helpers/constants.js';
import logger from '../helpers/logger.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { signAccessToken, signRefreshToken, hashToken, verifyAccessToken, verifyRefreshToken } from '../helpers/auth.helper.js';
import Tenant from '../models/tenant.model.js';
import User from '../models/users.model.js';
import Center from '../models/center.model.js';
import Token from '../models/auth.model.js';
import FeePlan from '../models/feeplan.model.js';
import Program from '../models/program.model.js';
import Staff from '../models/staff.model.js';
import Subject from '../models/subject.model.js';
import Department from '../models/department.model.js';

dotenv.config();
const Rounds = 12;

const pickTenantId = (req) => (req.body?.entiId || req.body?.tenantId || '').toString().trim();
const safeLower = (v) => (v === null || v === undefined ? '' : String(v)).trim().toLowerCase();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ROLE_MAP = {
  L1: 'Academic Head',
  L2: 'Admission Manager',
  L3: 'Accounts Manager',
  L4: 'Academic Operations'
};

const safeUpper = (v) => {
  const s = safeTrim(v);
  return s ? s.toUpperCase() : '';
};
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

const normalizePhone = (v) => safeTrim(v).replace(/\s+/g, '');
const normalizeEmail = (v) => {
  const s = safeTrim(v);
  return s ? s.toLowerCase() : null;
};

const buildSort = (raw) => {
  const s = safeTrim(raw);
  if (!s) return { createdAt: -1 };
  if (s.startsWith('-')) return { [s.slice(1)]: -1 };
  return { [s]: 1 };
};

const toStaffResponse = (d) => {
  if (!d) return d;
  return {
    _id: d._id,
    staffId: d.staffId,
    staffCode: d.staffCode,
    staffName: d.staffName,
    role: d.role,
    phone: d.phone,
    email: d.email,
    centerId: d.centerId,
    joiningDate: d.joiningDate,
    relievingDate: d.relievingDate,
    facultyType: d.facultyType,
    subject: d.subject,
    payroll: d.payroll,
    department: d.department,
    weekoff: d.weekoff,
    status: d.status,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  };
};

const STAFF_ROLES = ['Faculty', 'Center Head', 'Counsellor', 'Admin'];
const FACULTY_TYPES = ['TEACHING', 'NON_TEACHING'];
const PAYROLL_TYPES = ['suguna', 'z7i'];
const WEEKOFF_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const isValidEmail = (email) => {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
};

const parseWeekoff = (v) => {
  if (Array.isArray(v)) return v.map((x) => safeTrim(x)).filter(Boolean);
  const s = safeTrim(v);
  if (!s) return [];
  return s
    .split(',')
    .map((x) => safeTrim(x))
    .filter(Boolean);
};

const validateRow = (r) => {
  const errors = [];
  if (!r.staffName) errors.push('Staff Name required');
  if (!r.staffCode) errors.push('Staff Code required');
  if (!r.role) errors.push('Role required');
  if (r.role && !STAFF_ROLES.includes(r.role)) errors.push('Invalid role');
  if (!r.phone) errors.push('Phone required');
  if (r.email && !isValidEmail(r.email)) errors.push('Invalid email');
  if (!r.centerId) errors.push('Center required');
  if (!r.joiningDate) errors.push('Joining Date required');
  if (!r.payroll) errors.push('Payroll required');
  if (r.payroll && !PAYROLL_TYPES.includes(r.payroll)) errors.push('Invalid payroll');
  if (!r.department) errors.push('Department required');
  if (r.department && !isValidObjectId(r.department)) errors.push('Invalid department id');
  if (r.role === 'Faculty') {
    if (!r.facultyType) errors.push('Faculty Type required for Faculty');
    if (r.facultyType && !FACULTY_TYPES.includes(r.facultyType)) errors.push('Invalid facultyType');
    if (r.facultyType === 'TEACHING') {
      if (!r.subject) errors.push('Subject required for Teaching faculty');
      if (r.subject && !isValidObjectId(r.subject)) errors.push('Invalid subject id');
    }
    if (r.facultyType === 'NON_TEACHING') {
    }
  }
  const wk = Array.isArray(r.weekoff) ? r.weekoff : [];
  if (wk.length) {
    const bad = wk.filter((d) => !WEEKOFF_DAYS.includes(d));
    if (bad.length) errors.push(`Invalid weekoff: ${bad.join(', ')}`);
  }
  return errors;
};

const createInstitute = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const tenantName = safeTrim(req.body.tenantName);
    const tenantCode = safeTrim(req.body.tenantCode);
    const email = safeLower(req.body.email);
    const phone = safeTrim(req.body.phone);
    const contactName = safeTrim(req.body.contactName);
    const address1 = safeTrim(req.body.Address1);
    const address2 = safeTrim(req.body.Address2);
    const city = safeTrim(req.body.City);
    const state = safeTrim(req.body.State);
    const pincode = safeTrim(req.body.entZip);
    const password = safeTrim(req.body.password);
    const termsAccepted = !!req.body.terms_verified;
    if (!tenantName || !tenantCode || !email || !phone || !contactName || !address1 || !city || !state || !pincode || !password) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({
        status: false,
        message: 'tenantName, tenantCode, email, phone, contactName, Address1, City, State, entZip and password are required'
      });
    }
    const entityCreate = new Tenant({
      tenantName,
      tenantCode,
      tenantId: uuid(),
      email,
      phone,
      cntatName: contactName,
      entAddress1: address1,
      entAddress2: address2 || null,
      entArea: req.body.Area || null,
      entCity: city,
      entState: state,
      entCountry: req.body.Country || null,
      entZip: pincode,
      entWebsite: req.body.Website || null,
      hasGST: false,
      GSTN: req.body.gstn || null,
      status: req.body.status || 'Active',
      istermAccepted: termsAccepted,
      isdeleted: false
    });
    await entityCreate.save({ session });
    const hashedPassword = await bcrypt.hash(password, Rounds);
    const createAdminUsr = new User({
      tenantId: entityCreate.tenantId,
      userId: uuid(),
      name: contactName,
      email: entityCreate.email,
      phone: entityCreate.phone,
      password: hashedPassword,
      roleLevel: 'L1',
      roleLabel: ROLE_MAP.L1,
      status: 'Active',
      isdeleted: false
    });
    await createAdminUsr.save({ session });
    await session.commitTransaction();
    const response = createAdminUsr.toObject();
    delete response.password;
    delete response.isdeleted;
    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Institute created successfully',
      data: {
        tenantId: entityCreate.tenantId,
        tenantName: entityCreate.tenantName,
        tenantCode: entityCreate.tenantCode,
        adminUser: response
      }
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    await session.abortTransaction();
    return next(err);
  } finally {
    session.endSession();
  }
};

const viewInstitute = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const inst = await Tenant.findOne({ tenantId, isdeleted: false }).lean();
    if (!inst) {
      return res.status(constants.HTTPS_NOT_FOUND || 404).json({ status: false, message: 'Institute not found' });
    }
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, data: inst });
  } catch (err) {
    return next(err);
  }
};

const updateInstitute = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const updateDoc = {};
    if (req.body.tenantName !== undefined) updateDoc.tenantName = safeTrim(req.body.tenantName);
    if (req.body.tenantCode !== undefined) updateDoc.tenantCode = safeTrim(req.body.tenantCode);
    if (req.body.contactName !== undefined) updateDoc.cntatName = safeTrim(req.body.contactName);
    if (req.body.Address1 !== undefined) updateDoc.entAddress1 = safeTrim(req.body.Address1);
    if (req.body.Address2 !== undefined) updateDoc.entAddress2 = safeTrim(req.body.Address2) || null;
    if (req.body.City !== undefined) updateDoc.entCity = safeTrim(req.body.City);
    if (req.body.State !== undefined) updateDoc.entState = safeTrim(req.body.State);
    if (req.body.entZip !== undefined) updateDoc.entZip = safeTrim(req.body.entZip);
    if (req.body.status !== undefined) updateDoc.status = req.body.status;
    if (Object.keys(updateDoc).length === 0) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({ status: false, message: 'No fields to update' });
    }
    const updated = await Tenant.findOneAndUpdate({ tenantId, isdeleted: false }, { $set: updateDoc }, { new: true }).lean();
    if (!updated) {
      return res.status(constants.HTTPS_NOT_FOUND || 404).json({ status: false, message: 'Institute not found' });
    }
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, message: 'Institute updated successfully', data: updated });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const createCenter = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const centerName = safeTrim(req.body.centerName);
    const centerCode = safeTrim(req.body.centerCode);
    const address1 = safeTrim(req.body.address1);
    const city = safeTrim(req.body.city);
    const state = safeTrim(req.body.state);
    const pincode = safeTrim(req.body.pincode);
    if (!centerName || !centerCode || !address1 || !city || !state || !pincode) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({
        status: false,
        message: 'centerName, centerCode, address1, city, state, pincode are required'
      });
    }
    const doc = await Center.create({
      tenantId,
      centerId: uuid(),
      centerName,
      centerCode,
      email: req.body.email ? safeLower(req.body.email) : null,
      phone: req.body.phone ? safeTrim(req.body.phone) : null,
      cntatName: req.body.contactName ? safeTrim(req.body.contactName) : null,
      address1,
      address2: req.body.address2 ? safeTrim(req.body.address2) : null,
      area: req.body.area ? safeTrim(req.body.area).toLowerCase() : null,
      city,
      state,
      country: req.body.country ? safeTrim(req.body.country).toLowerCase() : null,
      pincode,
      status: req.body.status || 'Active',
      isdeleted: false
    });

    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Center created successfully',
      data: doc
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const listCenters = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const listType = req.query.list;
    const sort = req.query.sort || '-createdAt';
    const search = safeTrim(req.query.search);
    const status = safeTrim(req.query.status);
    const query = { tenantId, isdeleted: false };
    if (status) query.status = status;
    if (search) {
      query.$or = [{ centerName: { $regex: search, $options: 'i' } }, { centerCode: { $regex: search, $options: 'i' } }, { city: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
    }
    let data;
    let count;
    let page;
    if (listType === 'full') {
      data = await Center.find(query).sort('createdAt');
      count = data.length;
    } else {
      page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      count = await Center.countDocuments(query);
      data = await Center.find(query).sort(sort).skip(skip).limit(limit);
    }
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Center list retrieved successfully',
      data,
      page,
      count
    });
  } catch (err) {
    return next(err);
  }
};

const viewCenter = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { recId } = req.body;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const center = await Center.findOne({ _id: recId, tenantId, isdeleted: false });
    if (!center) return res.status(404).json({ status: false, message: 'Center not found' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, data: center });
  } catch (err) {
    return next(err);
  }
};

const updateCenter = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { recId } = req.body;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const updateDoc = {};
    if (req.body.centerName !== undefined) updateDoc.centerName = safeTrim(req.body.centerName);
    if (req.body.centerCode !== undefined) updateDoc.centerCode = safeTrim(req.body.centerCode);
    if (req.body.email !== undefined) updateDoc.email = req.body.email ? safeLower(req.body.email) : null;
    if (req.body.phone !== undefined) updateDoc.phone = req.body.phone ? safeTrim(req.body.phone) : null;
    if (req.body.address1 !== undefined) updateDoc.address1 = safeTrim(req.body.address1);
    if (req.body.address2 !== undefined) updateDoc.address2 = req.body.address2 ? safeTrim(req.body.address2) : null;
    if (req.body.area !== undefined) updateDoc.area = req.body.area ? safeTrim(req.body.area).toLowerCase() : null;
    if (req.body.city !== undefined) updateDoc.city = safeTrim(req.body.city);
    if (req.body.state !== undefined) updateDoc.state = safeTrim(req.body.state);
    if (req.body.pincode !== undefined) updateDoc.pincode = safeTrim(req.body.pincode);
    if (req.body.status !== undefined) updateDoc.status = req.body.status;
    if (Object.keys(updateDoc).length === 0) {
      return res.status(400).json({ status: false, message: 'No fields to update' });
    }
    const updated = await Center.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true });
    if (!updated) return res.status(404).json({ status: false, message: 'Center not found or already deleted' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, message: 'Center updated successfully', data: updated });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const deleteCenter = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { recId } = req.body;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const deleted = await Center.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true });
    if (!deleted) return res.status(404).json({ status: false, message: 'Center not found or already deleted' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, message: 'Center deleted successfully', data: deleted });
  } catch (err) {
    return next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const name = safeTrim(req.body.name);
    const email = safeLower(req.body.email);
    const phone = safeTrim(req.body.phone);
    const password = safeTrim(req.body.password);
    const roleLevel = safeTrim(req.body.roleLevel) || 'L4';
    const roleLabel = ROLE_MAP[roleLevel] || safeTrim(req.body.roleLabel) || ROLE_MAP.L4;
    if (!name || !email || !phone || !password) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({
        status: false,
        message: 'name, email, phone and password are required'
      });
    }
    const hashedPassword = await bcrypt.hash(password, Rounds);
    const doc = await User.create({
      tenantId,
      userId: uuid(),
      name,
      email,
      phone,
      password: hashedPassword,
      empCode: req.body.empCode ? safeTrim(req.body.empCode) : null,
      roleLevel,
      roleLabel,
      centerId: req.body.centerId ? safeTrim(req.body.centerId) : null,
      centerName: req.body.centerName ? safeTrim(req.body.centerName) : null,
      status: req.body.status || 'Active',
      isdeleted: false
    });
    const out = doc.toObject();
    delete out.password;
    return res.status(constants.HTTPS_CREATED || 201).json({ status: true, message: 'User created successfully', data: out });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const listType = req.query.list;
    const sort = req.query.sort || '-createdAt';
    const search = safeTrim(req.query.search);
    const roleLevel = safeTrim(req.query.roleLevel);
    const status = safeTrim(req.query.status);
    const centerId = safeTrim(req.query.centerId);
    const query = { tenantId, isdeleted: false };
    if (roleLevel) query.roleLevel = roleLevel;
    if (status) query.status = status;
    if (centerId) query.centerId = centerId;
    if (search) {
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }, { userId: { $regex: search, $options: 'i' } }];
    }
    let data;
    let count;
    let page;
    if (listType === 'full') {
      data = await User.find(query).sort('createdAt').select('-password');
      count = data.length;
    } else {
      page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;
      count = await User.countDocuments(query);
      data = await User.find(query).sort(sort).skip(skip).limit(limit).select('-password');
    }
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'User list retrieved successfully',
      data,
      page,
      count
    });
  } catch (err) {
    return next(err);
  }
};

const viewUser = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { recId } = req.body;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const user = await User.findOne({ _id: recId, tenantId, isdeleted: false }).select('-password');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, data: user });
  } catch (err) {
    return next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { recId } = req.body;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const updateDoc = {};
    if (req.body.name !== undefined) updateDoc.name = safeTrim(req.body.name);
    if (req.body.email !== undefined) updateDoc.email = safeLower(req.body.email);
    if (req.body.phone !== undefined) updateDoc.phone = safeTrim(req.body.phone);
    if (req.body.empCode !== undefined) updateDoc.empCode = req.body.empCode ? safeTrim(req.body.empCode) : null;
    if (req.body.centerId !== undefined) updateDoc.centerId = req.body.centerId ? safeTrim(req.body.centerId) : null;
    if (req.body.centerName !== undefined) updateDoc.centerName = req.body.centerName ? safeTrim(req.body.centerName) : null;
    if (req.body.roleLevel !== undefined) {
      const lvl = safeTrim(req.body.roleLevel) || 'L4';
      updateDoc.roleLevel = lvl;
      updateDoc.roleLabel = ROLE_MAP[lvl] || safeTrim(req.body.roleLabel) || ROLE_MAP.L4;
    } else if (req.body.roleLabel !== undefined) {
      updateDoc.roleLabel = safeTrim(req.body.roleLabel);
    }
    if (req.body.status !== undefined) updateDoc.status = req.body.status;
    if (req.body.password !== undefined && req.body.password !== null && req.body.password !== '') {
      updateDoc.password = await bcrypt.hash(String(req.body.password), Rounds);
    }
    if (Object.keys(updateDoc).length === 0) {
      return res.status(400).json({ status: false, message: 'No fields to update' });
    }
    const updated = await User.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true }).select('-password');
    if (!updated) return res.status(404).json({ status: false, message: 'User not found or already deleted' });
    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, message: 'User updated successfully', data: updated });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { recId } = req.body;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const deletedUser = await User.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true }).select('-password');
    if (!deletedUser) {
      return res.status(constants.HTTPS_NOT_FOUND || 404).json({ status: false, message: 'User not found or already deleted' });
    }
    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'User deleted successfully',
      data: deletedUser
    });
  } catch (err) {
    return next(err);
  }
};

const Loginuser = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: safeLower(email), isdeleted: false });
    if (!user) {
      const err = { status: constants.HTTPS_NOT_FOUND, message: 'User not found.' };
      return next(err);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const err = { status: constants.HTTPS_UNAUTHORISED, message: 'Invalid password.' };
      return next(err);
    }

    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const hashedRefresh = hashToken(refreshToken);

    await Token.create({
      userId: user.userId,
      token: hashedRefresh,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const userdata = { ...user.toJSON(), token };
    delete userdata.password;

    // keep your cookie name used by refreshToken() in your existing code :contentReference[oaicite:4]{index=4}
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' ? true : false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Login successful', data: userdata });
  } catch (err) {
    return next(err);
  }
};

const refreshToken = async (req, res, next) => {
  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) return res.status(constants.HTTPS_BAD_REQUEST).json({ message: 'Missing refresh token' });

  const hashed = hashToken(refreshToken);
  const stored = await Token.findOne({ token: hashed });
  if (!stored || stored.expiresAt < new Date()) {
    return res.status(constants.HTTPS_FORBIDDEN).json({ message: 'Invalid or expired refresh token' });
  }
  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findOne({ userId: payload.CRN, isdeleted: false });
    if (!user) {
      const err = { status: constants.HTTPS_NOT_FOUND, message: 'User not found.' };
      return next(err);
    }
    const newAccessToken = signAccessToken(user);
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, token: newAccessToken });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const rt = req.cookies.refresh_token;
    res.clearCookie('refresh_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' ? true : false, sameSite: 'Strict' });
    if (rt) {
      const hashed = hashToken(rt);
      await Token.deleteOne({ token: hashed });
    }
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'User Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) {
      return res.status(401).json({ status: false, message: 'Unauthorized – user not found in request context' });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: false, message: 'currentPassword and newPassword are required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ status: false, message: 'New password must be at least 8 characters long' });
    }
    const user = await User.findOne({ userId, isdeleted: false });
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ status: false, message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    logger?.info?.({ userId: user._id }, 'Password changed successfully');
    return res.status(200).json({ status: true, message: 'Password updated successfully' });
  } catch (err) {
    logger?.error?.({ err }, 'Error in changePassword');
    return next(err);
  }
};

// map excel feehead codes -> labels + discount rule
const FEEHEAD_META = {
  AM: { label: 'Administrative Charges', discountAllowed: false },
  AF: { label: 'Admission Fee', discountAllowed: false },
  IF: { label: 'Infra Fee', discountAllowed: false },
  TF: { label: 'Tuition Fee', discountAllowed: true },
  EF: { label: 'Exam Fee', discountAllowed: false },
  BS: { label: 'Books Fee', discountAllowed: false },
  GM: { label: 'GMP Fee', discountAllowed: false }
};

const createFeePlan = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });

    const payload = req.body || {};
    const academicYear = safeTrim(payload.academicYear);
    const programCode = safeTrim(payload.programCode);
    const feePlanName = safeTrim(payload.feePlanName);

    if (!academicYear || !programCode || !feePlanName) {
      return res.status(400).json({
        status: false,
        message: 'academicYear, programCode, feePlanName are required'
      });
    }

    const feeHeads = Array.isArray(payload.feeHeads) ? payload.feeHeads : [];
    const instalments = Array.isArray(payload.instalments) ? payload.instalments : [];

    if (!feeHeads.length) return res.status(400).json({ status: false, message: 'feeHeads is required' });
    if (!instalments.length) return res.status(400).json({ status: false, message: 'instalments is required' });

    const doc = await FeePlan.create({
      tenantId,
      academicYear,
      programCode,

      programId: payload.programId ? safeTrim(payload.programId) : null,
      programName: payload.programName ? safeTrim(payload.programName) : null,

      feePlanName,
      currency: payload.currency ? safeTrim(payload.currency) : 'INR',

      feeHeads,
      instalments,

      // schema will recalc totals, but allow passing also
      totalBaseFee: payload.totalBaseFee ?? 0,
      totalGST: payload.totalGST ?? 0,
      totalFee: payload.totalFee ?? 0,

      status: payload.status || 'Active',
      isdeleted: false
    });

    return res.status(constants.HTTPS_CREATED || 201).json({
      status: true,
      message: 'Fee plan created successfully',
      data: doc
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

// -------------------- VIEW --------------------
const viewFeePlan = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const doc = await FeePlan.findOne({ _id: recId, tenantId, isdeleted: false });
    if (!doc) return res.status(404).json({ status: false, message: 'Fee plan not found' });

    return res.status(constants.HTTPS_SUCCESS || 200).json({ status: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

// -------------------- UPDATE --------------------
const updateFeePlan = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const payload = req.body || {};
    const updateDoc = {};

    if (payload.academicYear !== undefined) updateDoc.academicYear = safeTrim(payload.academicYear);
    if (payload.programCode !== undefined) updateDoc.programCode = safeTrim(payload.programCode);

    if (payload.programId !== undefined) updateDoc.programId = payload.programId ? safeTrim(payload.programId) : null;
    if (payload.programName !== undefined) updateDoc.programName = payload.programName ? safeTrim(payload.programName) : null;

    if (payload.feePlanName !== undefined) updateDoc.feePlanName = safeTrim(payload.feePlanName);
    if (payload.currency !== undefined) updateDoc.currency = payload.currency ? safeTrim(payload.currency) : 'INR';

    if (payload.feeHeads !== undefined) updateDoc.feeHeads = Array.isArray(payload.feeHeads) ? payload.feeHeads : [];
    if (payload.instalments !== undefined) updateDoc.instalments = Array.isArray(payload.instalments) ? payload.instalments : [];
    if (payload.status !== undefined) updateDoc.status = payload.status;

    if (!Object.keys(updateDoc).length) {
      return res.status(400).json({ status: false, message: 'No fields to update' });
    }

    const updated = await FeePlan.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true, runValidators: true });

    if (!updated) return res.status(404).json({ status: false, message: 'Fee plan not found or deleted' });

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Fee plan updated successfully',
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

// -------------------- DELETE (soft) --------------------
const deleteFeePlan = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });

    const deleted = await FeePlan.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true });

    if (!deleted) return res.status(404).json({ status: false, message: 'Fee plan not found or already deleted' });

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Fee plan deleted successfully',
      data: deleted
    });
  } catch (err) {
    return next(err);
  }
};

// -------------------- ACTIVE/INACTIVE --------------------
const setFeePlanStatus = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const recId = req.body?.recId;
    const status = req.body?.status;

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ status: false, message: 'status must be Active or Inactive' });
    }

    const updated = await FeePlan.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { status } }, { new: true });

    if (!updated) return res.status(404).json({ status: false, message: 'Fee plan not found' });

    return res.status(200).json({ status: true, message: 'Status updated', data: updated });
  } catch (err) {
    return next(err);
  }
};

// -------------------- LIST (pagination) --------------------
const listFeePlans = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required in body' });
    const listType = req.query.list;
    const sort = req.query.sort || '-createdAt';
    const search = safeTrim(req.query.search);
    const academicYear = safeTrim(req.query.academicYear);
    const programCode = safeTrim(req.query.programCode);
    const programId = safeTrim(req.query.programId);
    const status = safeTrim(req.query.status);
    const query = { tenantId, isdeleted: false };
    if (academicYear) query.academicYear = academicYear;
    if (programCode) query.programCode = programCode;
    if (programId) query.programId = programId;
    if (status) query.status = status;
    if (search) {
      query.$or = [{ feePlanName: { $regex: search, $options: 'i' } }, { feePlanDisplayName: { $regex: search, $options: 'i' } }, { programName: { $regex: search, $options: 'i' } }, { programCode: { $regex: search, $options: 'i' } }];
    }
    let data;
    let count;
    let page;

    if (listType === 'full') {
      data = await FeePlan.find(query).sort('createdAt');
      count = data.length;
    } else {
      page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      count = await FeePlan.countDocuments(query);
      data = await FeePlan.find(query).sort(sort).skip(skip).limit(limit);
    }

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Fee plan list retrieved successfully',
      data,
      page,
      count
    });
  } catch (err) {
    return next(err);
  }
};

// -------------------- BULK UPSERT IMPORT (Excel rows) --------------------
// payload: { entiId, academicYear, rows:[ {feeplancode, programcode, feehead, amount, strate, insdate, ...} ] }
const bulkUpsertFeePlansFromRows = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const academicYear = safeTrim(req.body?.academicYear);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!academicYear) return res.status(400).json({ status: false, message: 'academicYear is required' });
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows must be a non-empty array' });

    // group by feePlanName (feeplancode) + programCode (programcode)
    const groups = new Map();
    for (const r of rows) {
      const feePlanName = safeTrim(r.feeplancode);
      const programCode = safeTrim(r.programcode);
      if (!feePlanName || !programCode) continue;

      const key = `${feePlanName}__${programCode}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    const processed = [];
    const skipped = [];
    const errors = [];

    for (const [key, lines] of groups.entries()) {
      try {
        const feePlanName = safeTrim(lines[0].feeplancode);
        const programCode = safeTrim(lines[0].programcode);

        // Resolve program from Program master using programCodes CSV string.
        // Your Program schema stores programCodes as CSV string now.
        // So use regex to match token boundaries.
        const codeUpper = String(programCode).trim().toUpperCase();
        const tokenRegex = new RegExp(`(^|,\\s*)${codeUpper}(\\s*,|$)`, 'i');

        const programDoc = await Program.findOne({
          tenantId,
          isdeleted: false,
          programCodes: { $regex: tokenRegex }
        }).lean();

        if (!programDoc) {
          skipped.push({ feePlanName, programCode, reason: 'Program not found for programCode in Program master' });
          continue;
        }

        // -------- feeHeads aggregation by feehead key --------
        const headAgg = new Map(); // key => {base, gst, label, discountAllowed, gstPercent}
        for (const l of lines) {
          const headKey = safeTrim(l.feehead).toUpperCase();
          if (!headKey) continue;

          const amount = toNum(l.amount); // base
          const gstPercent = toNum(l.strate); // strate = gst %
          const gstAmount = Number(((amount * gstPercent) / 100).toFixed(2));
          const totalAmount = Number((amount + gstAmount).toFixed(2));

          const meta = FEEHEAD_META[headKey] || {
            label: safeTrim(l.feefor) || headKey,
            discountAllowed: headKey === 'TF'
          };

          if (!headAgg.has(headKey)) {
            headAgg.set(headKey, {
              key: headKey,
              label: meta.label,
              discountAllowed: !!meta.discountAllowed,
              gstPercent: gstPercent || 0,
              base: 0,
              gst: 0,
              total: 0
            });
          }

          const x = headAgg.get(headKey);
          x.base += amount;
          x.gst += gstAmount;
          x.total += totalAmount;

          // if gstPercent varies, keep 0 (not critical since gstAmount is summed)
          if (Number(x.gstPercent) !== Number(gstPercent)) x.gstPercent = 0;
        }

        const feeHeads = Array.from(headAgg.values()).map((h) => ({
          key: h.key,
          label: h.label,
          amount: Number(h.base.toFixed(2)),
          gstPercent: Number(h.gstPercent || 0),
          gstAmount: Number(h.gst.toFixed(2)),
          totalAmount: Number(h.total.toFixed(2)),
          discountAllowed: !!h.discountAllowed
        }));

        // totals
        let totalBase = 0;
        let totalGst = 0;
        let totalFee = 0;
        feeHeads.forEach((h) => {
          totalBase += Number(h.amount || 0);
          totalGst += Number(h.gstAmount || 0);
          totalFee += Number(h.totalAmount || 0);
        });

        // -------- instalments: group by insdate using TOTAL AMOUNT (base+gst) --------
        // Important: model validates instalments sum == totalFee (which includes GST).
        const instMap = new Map();
        for (const l of lines) {
          const label = safeTrim(l.insdate) || 'On Admission';
          const amount = toNum(l.amount);
          const gstPercent = toNum(l.strate);
          const gstAmount = Number(((amount * gstPercent) / 100).toFixed(2));
          const totalAmount = Number((amount + gstAmount).toFixed(2));
          instMap.set(label, Number(((instMap.get(label) || 0) + totalAmount).toFixed(2)));
        }

        const instalments = Array.from(instMap.entries()).map(([label, amt], idx) => ({
          seq: idx + 1,
          label,
          amount: Number(toNum(amt).toFixed(2))
        }));

        // Upsert by tenantId + academicYear + programCode + feePlanName
        const exists = await FeePlan.findOne({
          tenantId,
          academicYear,
          programCode,
          feePlanName,
          isdeleted: false
        }).lean();

        if (exists) {
          await FeePlan.updateOne(
            { _id: exists._id },
            {
              $set: {
                programId: programDoc.programId || null,
                programName: programDoc.programName || null,
                feeHeads,
                instalments,
                totalBaseFee: Number(totalBase.toFixed(2)),
                totalGST: Number(totalGst.toFixed(2)),
                totalFee: Number(totalFee.toFixed(2)),
                status: 'Active'
              }
            }
          );
          processed.push({ feePlanName, programCode, action: 'updated' });
        } else {
          await FeePlan.create({
            tenantId,
            academicYear,
            programCode,
            programId: programDoc.programId || null,
            programName: programDoc.programName || null,
            feePlanName,
            currency: 'INR',
            feeHeads,
            instalments,
            totalBaseFee: Number(totalBase.toFixed(2)),
            totalGST: Number(totalGst.toFixed(2)),
            totalFee: Number(totalFee.toFixed(2)),
            status: 'Active',
            isdeleted: false
          });
          processed.push({ feePlanName, programCode, action: 'created' });
        }
      } catch (e) {
        errors.push({ key, error: e?.message || String(e) });
      }
    }

    return res.status(constants.HTTPS_SUCCESS || 200).json({
      status: true,
      message: 'Bulk fee plan import processed',
      data: {
        totalGroups: groups.size,
        processed,
        skipped,
        errors
      }
    });
  } catch (err) {
    return next(err);
  }
};

const createStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const staffName = safeTrim(payload.staffName);
    const staffCode = safeUpper(payload.staffCode);
    const role = safeTrim(payload.role);
    const phone = normalizePhone(payload.phone);
    const email = normalizeEmail(payload.email);
    const centerId = safeTrim(payload.centerId);
    const joiningDate = safeTrim(payload.joiningDate);
    const relievingDate = safeTrim(payload.relievingDate) || null;
    const facultyType = safeTrim(payload.facultyType) || null;
    const payroll = safeTrim(payload.payroll);
    const department = safeTrim(payload.department);
    const subject = safeTrim(payload.subject) || null;
    const weekoff = Array.isArray(payload.weekoff) ? payload.weekoff.map((x) => safeTrim(x)).filter(Boolean) : [];
    const status = safeTrim(payload.status) || 'Active';
    if (!staffName) return res.status(400).json({ status: false, message: 'staffName is required' });
    if (!staffCode) return res.status(400).json({ status: false, message: 'staffCode is required' });
    if (!role) return res.status(400).json({ status: false, message: 'role is required' });
    if (!phone) return res.status(400).json({ status: false, message: 'phone is required' });
    if (!centerId) return res.status(400).json({ status: false, message: 'centerId is required' });
    if (!joiningDate) return res.status(400).json({ status: false, message: 'joiningDate is required' });
    if (!payroll) return res.status(400).json({ status: false, message: 'payroll is required' });
    if (!department) return res.status(400).json({ status: false, message: 'department is required' });
    if (!isValidObjectId(department)) return res.status(400).json({ status: false, message: 'Invalid department id' });
    if (subject && !isValidObjectId(subject)) return res.status(400).json({ status: false, message: 'Invalid subject id' });
    const isFaculty = role === 'Faculty';
    if (isFaculty) {
      if (!facultyType) return res.status(400).json({ status: false, message: 'facultyType is required for Faculty role' });
      if (facultyType === 'TEACHING' && !subject) {
        return res.status(400).json({ status: false, message: 'subject is required for TEACHING faculty' });
      }
      if (facultyType === 'NON_TEACHING') {
      }
    }
    const deptDoc = await Department.findOne({ _id: department, tenantId, isdeleted: false }).lean();
    if (!deptDoc) return res.status(400).json({ status: false, message: 'Invalid department (not found)' });
    if (subject) {
      const subDoc = await Subject.findOne({ _id: subject, tenantId, isdeleted: false }).lean();
      if (!subDoc) return res.status(400).json({ status: false, message: 'Invalid subject (not found)' });
    }
    const doc = await Staff.create({
      tenantId,
      staffCode,
      staffName,
      role,
      phone,
      email,
      centerId,
      joiningDate,
      relievingDate,
      facultyType: isFaculty ? facultyType : null,
      subject: isFaculty && facultyType === 'TEACHING' ? subject : null,
      payroll,
      department,
      weekoff,
      status: status === 'Inactive' ? 'Inactive' : 'Active',
      isdeleted: false,
      createdBy: payload.createdBy || null,
      updatedBy: payload.updatedBy || null
    });

    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Staff created',
      data: toStaffResponse(doc)
    });
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err?.keyPattern || {})[0] || 'duplicate';
      const map = {
        staffCode: 'Staff code already exists',
        phone: 'Phone already exists',
        email: 'Email already exists'
      };
      return res.status(409).json({ status: false, message: map[key] || 'Duplicate record' });
    }
    return next(err);
  }
};

const listStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const search = safeTrim(req.query.search);
    const sort = buildSort(req.query.sort);
    const query = { tenantId, isdeleted: false };
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ staffName: rx }, { staffCode: rx }, { phone: rx }, { email: rx }, { role: rx }, { centerId: rx }];
    }
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      Staff.find(query).sort(sort).skip(skip).limit(limit).populate({ path: 'centerId', model: 'center', localField: 'centerId', foreignField: 'centerId', model: 'center', justOne: true, select: 'centerName centerCode centerId' }).lean(),
      Staff.countDocuments(query)
    ]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: (rows || []).map(toStaffResponse),
      count
    });
  } catch (err) {
    return next(err);
  }
};

const viewStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const staffId = safeTrim(req.body.staffId);
    const recId = safeTrim(req.body.recId);
    const filter = { tenantId, isdeleted: false };
    if (recId) filter._id = recId;
    else if (staffId) filter.staffId = staffId;
    else return res.status(400).json({ status: false, message: 'recId or staffId is required' });
    const doc = await Staff.findOne(filter).populate({ path: 'centerId', model: 'center', localField: 'centerId', foreignField: 'centerId', model: 'center', justOne: true, select: 'centerName centerCode centerId' }).populate('department', 'departmentName').populate('subject', 'subjectName').lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Staff not found' });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: toStaffResponse(doc)
    });
  } catch (err) {
    return next(err);
  }
};

const updateStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const recId = safeTrim(payload.recId);
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const patch = {};
    if (payload.staffName !== undefined) patch.staffName = safeTrim(payload.staffName);
    if (payload.staffCode !== undefined) patch.staffCode = safeUpper(payload.staffCode);
    if (payload.role !== undefined) patch.role = safeTrim(payload.role);
    if (payload.phone !== undefined) patch.phone = normalizePhone(payload.phone);
    if (payload.email !== undefined) patch.email = normalizeEmail(payload.email);
    if (payload.centerId !== undefined) patch.centerId = safeTrim(payload.centerId);
    if (payload.joiningDate !== undefined) patch.joiningDate = safeTrim(payload.joiningDate);
    if (payload.relievingDate !== undefined) patch.relievingDate = safeTrim(payload.relievingDate) || null;
    if (payload.facultyType !== undefined) patch.facultyType = safeTrim(payload.facultyType) || null;
    if (payload.subject !== undefined) patch.subject = safeTrim(payload.subject) || null;
    if (payload.payroll !== undefined) patch.payroll = safeTrim(payload.payroll);
    if (payload.department !== undefined) patch.department = safeTrim(payload.department);
    if (payload.weekoff !== undefined) {
      patch.weekoff = Array.isArray(payload.weekoff) ? payload.weekoff.map((x) => safeTrim(x)).filter(Boolean) : [];
    }
    if (payload.status !== undefined) patch.status = safeTrim(payload.status) === 'Inactive' ? 'Inactive' : 'Active';
    if (payload.updatedBy !== undefined) patch.updatedBy = payload.updatedBy || null;
    const existing = await Staff.findOne({ _id: recId, tenantId, isdeleted: false }).lean();
    if (!existing) return res.status(404).json({ status: false, message: 'Staff not found' });
    const nextRole = patch.role !== undefined ? patch.role : existing.role;
    const nextFacultyType = patch.facultyType !== undefined ? patch.facultyType : existing.facultyType;
    const nextSubject = patch.subject !== undefined ? patch.subject : existing.subject;
    if (patch.department !== undefined) {
      if (!isValidObjectId(patch.department)) return res.status(400).json({ status: false, message: 'Invalid department id' });
      const deptDoc = await Department.findOne({ _id: patch.department, tenantId, isdeleted: false }).lean();
      if (!deptDoc) return res.status(400).json({ status: false, message: 'Invalid department (not found)' });
    }
    if (patch.subject !== undefined && patch.subject) {
      if (!isValidObjectId(patch.subject)) return res.status(400).json({ status: false, message: 'Invalid subject id' });
      const subDoc = await Subject.findOne({ _id: patch.subject, tenantId, isdeleted: false }).lean();
      if (!subDoc) return res.status(400).json({ status: false, message: 'Invalid subject (not found)' });
    }
    const isFaculty = nextRole === 'Faculty';
    if (isFaculty) {
      if (!nextFacultyType) return res.status(400).json({ status: false, message: 'facultyType is required for Faculty role' });
      if (nextFacultyType === 'TEACHING' && !nextSubject) {
        return res.status(400).json({ status: false, message: 'subject is required for TEACHING faculty' });
      }
      if (nextFacultyType === 'NON_TEACHING') {
        patch.subject = null;
      }
    } else {
      patch.facultyType = null;
      patch.subject = null;
    }
    if (patch.staffName !== undefined && !patch.staffName) return res.status(400).json({ status: false, message: 'staffName cannot be empty' });
    if (patch.staffCode !== undefined && !patch.staffCode) return res.status(400).json({ status: false, message: 'staffCode cannot be empty' });
    if (patch.phone !== undefined && !patch.phone) return res.status(400).json({ status: false, message: 'phone cannot be empty' });
    if (patch.centerId !== undefined && !patch.centerId) return res.status(400).json({ status: false, message: 'centerId cannot be empty' });
    if (patch.joiningDate !== undefined && !patch.joiningDate) return res.status(400).json({ status: false, message: 'joiningDate cannot be empty' });
    if (patch.payroll !== undefined && !patch.payroll) return res.status(400).json({ status: false, message: 'payroll cannot be empty' });
    if (patch.department !== undefined && !patch.department) return res.status(400).json({ status: false, message: 'department cannot be empty' });
    const doc = await Staff.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: patch }, { new: true }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Staff updated',
      data: toStaffResponse(doc)
    });
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err?.keyPattern || {})[0] || 'duplicate';
      const map = {
        staffCode: 'Staff code already exists',
        phone: 'Phone already exists',
        email: 'Email already exists'
      };
      return res.status(409).json({ status: false, message: map[key] || 'Duplicate record' });
    }
    return next(err);
  }
};

const deleteStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const recId = safeTrim(req.body.recId);
    if (!recId) return res.status(400).json({ status: false, message: 'recId is required' });
    const updatedBy = req.body.updatedBy || null;
    const doc = await Staff.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true, status: 'Inactive', updatedBy } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Staff not found' });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Staff deleted',
      data: toStaffResponse(doc)
    });
  } catch (err) {
    return next(err);
  }
};

const upper = (v) => (safeTrim(v) ? safeTrim(v).toUpperCase() : '');
const lower = (v) => (safeTrim(v) ? safeTrim(v).toLowerCase() : '');
const normName = (v) => upper(v).replace(/\s+/g, ' ').trim();

const buildCenterKey = (c) => ({
  id: safeTrim(c.centerId),
  code: upper(c.centerCode),
  name: normName(c.centerName)
});
const buildDeptKey = (d) => ({
  id: String(d._id),
  code: upper(d.departmentCode || ''),
  name: normName(d.departmentName)
});
const buildSubjectKey = (s) => ({
  id: String(s._id),
  code: upper(s.subjectCode || ''),
  name: normName(s.subjectName)
});

const bulkImportStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const mode = safeTrim(req.body.mode) || 'upsert';
    if (!['insert', 'upsert'].includes(mode)) {
      return res.status(400).json({ status: false, message: 'mode must be insert or upsert' });
    }
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows must be a non-empty array' });
    const [centers, depts, subjects] = await Promise.all([
      Center.find({ tenantId, isdeleted: false }, { _id: 0, centerId: 1, centerName: 1, centerCode: 1 }).lean(),
      Department.find({ tenantId, isdeleted: false }, { _id: 1, departmentName: 1, departmentCode: 1 }).lean(),
      Subject.find({ tenantId, isdeleted: false }, { _id: 1, subjectName: 1, subjectCode: 1 }).lean()
    ]);
    const centerById = new Map();
    const centerByCode = new Map();
    const centerByName = new Map();
    (centers || []).forEach((c) => {
      const k = buildCenterKey(c);
      if (k.id) centerById.set(k.id, c);
      if (k.code) centerByCode.set(k.code, c);
      if (k.name) centerByName.set(k.name, c);
    });
    const deptById = new Map();
    const deptByCode = new Map();
    const deptByName = new Map();
    (depts || []).forEach((d) => {
      const k = buildDeptKey(d);
      if (k.id) deptById.set(k.id, d);
      if (k.code) deptByCode.set(k.code, d);
      if (k.name) deptByName.set(k.name, d);
    });
    const subById = new Map();
    const subByCode = new Map();
    const subByName = new Map();
    (subjects || []).forEach((s) => {
      const k = buildSubjectKey(s);
      if (k.id) subById.set(k.id, s);
      if (k.code) subByCode.set(k.code, s);
      if (k.name) subByName.set(k.name, s);
    });
    const normalized = rows.map((x) => {
      const role = safeTrim(x.role);
      const facultyType = safeTrim(x.facultyType) || null;
      const centerInput = safeTrim(x.center) || safeTrim(x.centerName) || safeTrim(x.centerCode) || safeTrim(x.centerId);
      const deptInput = safeTrim(x.department) || safeTrim(x.departmentName) || safeTrim(x.departmentCode);
      const subjInput = safeTrim(x.subject) || safeTrim(x.subjectName) || safeTrim(x.subjectCode);
      const cHit = centerById.get(centerInput) || centerByCode.get(upper(centerInput)) || centerByName.get(normName(centerInput));
      const dHit = deptById.get(deptInput) || deptByCode.get(upper(deptInput)) || deptByName.get(normName(deptInput));
      const sHit = subById.get(subjInput) || subByCode.get(upper(subjInput)) || subByName.get(normName(subjInput));
      return {
        staffName: safeTrim(x.staffName),
        staffCode: safeUpper(x.staffCode),
        role,
        phone: normalizePhone(x.phone),
        email: normalizeEmail(x.email),
        centerId: cHit?.centerId || null,
        joiningDate: safeTrim(x.joiningDate),
        relievingDate: safeTrim(x.relievingDate) || null,
        payroll: safeTrim(x.payroll),
        department: dHit?._id ? String(dHit._id) : null,
        facultyType: role === 'Faculty' ? facultyType : null,
        subject: role === 'Faculty' && facultyType === 'TEACHING' ? (sHit?._id ? String(sHit._id) : null) : null,
        weekoff: parseWeekoff(x.weekoff),
        status: safeTrim(x.status) === 'Inactive' ? 'Inactive' : 'Active',
        _resolved: {
          centerInput,
          deptInput,
          subjInput,
          centerName: cHit?.centerName || null,
          departmentName: dHit?.departmentName || null,
          subjectName: sHit?.subjectName || null
        }
      };
    });
    const invalidRows = [];
    normalized.forEach((r, idx) => {
      const errs = [];
      if (!r.staffName) errs.push('Staff Name required');
      if (!r.staffCode) errs.push('Staff Code required');
      if (!r.role) errs.push('Role required');
      if (r.role && !STAFF_ROLES.includes(r.role)) errs.push('Invalid role');
      if (!r.phone) errs.push('Phone required');
      if (r.email && !isValidEmail(r.email)) errs.push('Invalid email');
      if (!r.centerId) errs.push(`Center not found: ${r._resolved.centerInput || '(empty)'}`);
      if (!r.joiningDate) errs.push('Joining Date required');
      if (!r.payroll) errs.push('Payroll required');
      if (r.payroll && !PAYROLL_TYPES.includes(r.payroll)) errs.push('Invalid payroll');
      if (!r.department) errs.push(`Department not found: ${r._resolved.deptInput || '(empty)'}`);
      if (r.department && !isValidObjectId(r.department)) errs.push('Invalid department id');
      if (r.role === 'Faculty') {
        if (!r.facultyType) errs.push('Faculty Type required for Faculty');
        if (r.facultyType && !FACULTY_TYPES.includes(r.facultyType)) errs.push('Invalid facultyType');
        if (r.facultyType === 'TEACHING') {
          if (!r.subject) errs.push(`Subject not found: ${r._resolved.subjInput || '(empty)'}`);
          if (r.subject && !isValidObjectId(r.subject)) errs.push('Invalid subject id');
        }
      }
      const wk = Array.isArray(r.weekoff) ? r.weekoff : [];
      if (wk.length) {
        const bad = wk.filter((d) => !WEEKOFF_DAYS.includes(d));
        if (bad.length) errs.push(`Invalid weekoff: ${bad.join(', ')}`);
      }
      if (errs.length) invalidRows.push({ index: idx, staffCode: r.staffCode, errors: errs });
    });
    if (invalidRows.length) {
      return res.status(400).json({
        status: false,
        message: 'Import has invalid rows',
        invalidRows
      });
    }
    const docs = normalized.map((r) => ({
      tenantId,
      staffCode: r.staffCode,
      staffName: r.staffName,
      role: r.role,
      phone: r.phone,
      email: r.email,
      centerId: r.centerId,
      joiningDate: r.joiningDate,
      relievingDate: r.relievingDate,
      facultyType: r.facultyType,
      subject: r.subject,
      payroll: r.payroll,
      department: r.department,
      weekoff: r.weekoff,
      status: r.status,
      isdeleted: false,
      createdBy: req.body.userId || null,
      updatedBy: req.body.userId || null
    }));
    if (mode === 'insert') {
      const staffCodes = Array.from(new Set(docs.map((d) => d.staffCode).filter(Boolean)));
      const phones = Array.from(new Set(docs.map((d) => d.phone).filter(Boolean)));
      const emails = Array.from(new Set(docs.map((d) => d.email).filter(Boolean)));
      const existing = await Staff.find(
        {
          tenantId,
          isdeleted: false,
          $or: [{ staffCode: { $in: staffCodes } }, { phone: { $in: phones } }, ...(emails.length ? [{ email: { $in: emails } }] : [])]
        },
        { _id: 0, staffCode: 1, phone: 1, email: 1 }
      ).lean();
      const existCode = new Set((existing || []).map((e) => String(e.staffCode || '')));
      const existPhone = new Set((existing || []).map((e) => String(e.phone || '')));
      const existEmail = new Set((existing || []).map((e) => String(e.email || '')));
      const toInsert = [];
      const skipped = [];
      for (const d of docs) {
        const dup = existCode.has(d.staffCode) || existPhone.has(d.phone) || (d.email && existEmail.has(d.email));
        if (dup) {
          skipped.push({ staffCode: d.staffCode, reason: 'duplicate' });
          continue;
        }
        toInsert.push(d);
      }
      const insertedDocs = toInsert.length ? await Staff.insertMany(toInsert, { ordered: false }) : [];
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'Staff import completed',
        summary: { mode, inserted: insertedDocs.length, skipped: skipped.length },
        skipped
      });
    }
    let upserted = 0;
    let inserted = 0;
    for (const d of docs) {
      const result = await Staff.updateOne({ tenantId, staffCode: d.staffCode, isdeleted: false }, { $set: d }, { upsert: true });
      const wasUpsert = !!result?.upsertedId || (Array.isArray(result?.upserted) && result.upserted.length);
      if (wasUpsert) inserted += 1;
      else upserted += 1;
    }
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Staff import completed',
      summary: { mode, inserted, upserted }
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ status: false, message: 'Duplicate staff data found during import' });
    }
    return next(err);
  }
};

export default {
  createInstitute,
  viewInstitute,
  updateInstitute,
  createCenter,
  listCenters,
  viewCenter,
  updateCenter,
  deleteCenter,
  createUser,
  listUsers,
  viewUser,
  updateUser,
  deleteUser,
  Loginuser,
  refreshToken,
  logout,
  changePassword,
  createFeePlan,
  bulkUpsertFeePlansFromRows,
  listFeePlans,
  viewFeePlan,
  updateFeePlan,
  deleteFeePlan,
  setFeePlanStatus,
  createStaff,
  listStaff,
  updateStaff,
  deleteStaff,
  viewStaff,
  bulkImportStaff
};
