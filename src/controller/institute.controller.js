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

dotenv.config();
const Rounds = 12;

const pickTenantId = (req) => (req.body?.entiId || req.body?.tenantId || '').toString().trim();
const safeLower = (v) => (v === null || v === undefined ? '' : String(v)).trim().toLowerCase();
const safeTrim = (v) => (v === null || v === undefined ? '' : String(v)).trim();

const ROLE_MAP = {
  L1: 'Academic Head',
  L2: 'Admission Manager',
  L3: 'Accounts Manager',
  L4: 'Academic Operations'
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
  changePassword
};
