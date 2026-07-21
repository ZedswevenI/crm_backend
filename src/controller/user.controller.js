import constants from '../helpers/constants.js';
import logger from '../helpers/logger.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { signAccessToken, signRefreshToken, hashToken, verifyRefreshToken } from '../helpers/auth.helper.js';
import User, { ROLE_MAP } from '../models/users.model.js';
import Center from '../models/center.model.js';
import Token from '../models/auth.model.js';
import Staff from '../models/staff.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';
import Otp from '../models/otp.model.js';
import { generateAndSaveOtp, sendOtpEmail, verifyOtp } from '../helpers/otp.helper.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const Rounds = 12;
const VALID_ROLES = Object.keys(ROLE_MAP);
const pickTenantId = (req) => (req.body?.entiId || req.body?.tenantId || '').toString().trim();
const safeLower = (v) => (v == null ? '' : String(v)).trim().toLowerCase();
const safeTrim = (v) => (v == null ? '' : String(v)).trim();

// Accepts centerIds: [] (preferred) or legacy single centerId string, resolves names, returns centers[] for the User doc.
const resolveCenters = async (tenantId, body) => {
  let ids = [];
  if (Array.isArray(body.centerIds)) ids = body.centerIds.map(safeTrim).filter(Boolean);
  else if (body.centerId) ids = [safeTrim(body.centerId)];
  ids = [...new Set(ids)];
  if (!ids.length) return [];
  const centerDocs = await Center.find({ tenantId, centerId: { $in: ids }, isdeleted: false }, { centerId: 1, centerName: 1 }).lean();
  const nameMap = new Map(centerDocs.map((c) => [c.centerId, c.centerName]));
  return ids.map((id) => ({ centerId: id, centerName: nameMap.get(id) || null }));
};

const createUser = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const name = safeTrim(req.body.name);
    const email = safeLower(req.body.email);
    const phone = safeTrim(req.body.phone);
    const password = safeTrim(req.body.password);
    const roleLevel = VALID_ROLES.includes(safeTrim(req.body.roleLevel)) ? safeTrim(req.body.roleLevel) : 'L4';
    const roleLabel = ROLE_MAP[roleLevel];
    const empCode = req.body.empCode ? safeTrim(req.body.empCode) : null;
    if (!name || !email || !phone || !password) return res.status(400).json({ status: false, message: 'name, email, phone and password are required' });
    const centers = await resolveCenters(tenantId, req.body);
    let mappedStaffId = null;
    if (empCode) {
      const escaped = empCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const staffMatch = await Staff.findOne({
        tenantId,
        employeeId: new RegExp(`^${escaped}$`, 'i'),
        isdeleted: false
      }).lean();
      if (!staffMatch) return res.status(400).json({ status: false, message: `No staff record found for empCode: ${empCode}` });
      if (staffMatch.userId) {
        const linked = await User.findOne({ tenantId, userId: staffMatch.userId, isdeleted: false }, { email: 1 }).lean();
        if (linked)
          return res.status(409).json({
            status: false,
            message: `Staff ${empCode} is already linked to user: ${linked.email}`
          });
      }
      mappedStaffId = staffMatch.staffId;
    }
    const hashedPassword = await bcrypt.hash(password, Rounds);
    const newUserId = uuid();
    const doc = await User.create({
      tenantId,
      userId: newUserId,
      staffId: mappedStaffId,
      name,
      email,
      phone,
      password: hashedPassword,
      empCode,
      roleLevel,
      roleLabel,
      centers,
      status: req.body.status || 'Active',
      isdeleted: false
    });
    if (mappedStaffId) await Staff.updateOne({ tenantId, staffId: mappedStaffId, isdeleted: false }, { $set: { userId: newUserId } });
    const out = doc.toObject();
    delete out.password;
    return res.status(201).json({ status: true, message: 'User created successfully', data: out });
  } catch (err) {
    if (err?.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'field';
      const map = {
        email: 'Email already exists',
        phone: 'Phone number already exists',
        empCode: 'Employee code already linked to another user'
      };
      return res.status(409).json({ status: false, message: map[dupField] || `Duplicate ${dupField}` });
    }
    return next(err);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const listType = req.query.list;
    const sort = req.query.sort || '-createdAt';
    const search = safeTrim(req.query.search);
    const roleLevel = safeTrim(req.query.roleLevel);
    const status = safeTrim(req.query.status);
    const centerId = safeTrim(req.query.centerId || req.body?.centerId);
    const query = { tenantId, isdeleted: false };
    if (roleLevel) query.roleLevel = roleLevel;
    if (status) query.status = status;
    if (centerId) query['centers.centerId'] = centerId;
    if (search) {
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }, { userId: { $regex: search, $options: 'i' } }];
    }
    let data, count, page;
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
    return res.status(200).json({ status: true, message: 'User list retrieved successfully', data, page, count });
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
    return res.status(200).json({ status: true, data: user });
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
    const existingUser = await User.findOne({ _id: recId, tenantId, isdeleted: false }).lean();
    if (!existingUser) return res.status(404).json({ status: false, message: 'User not found or already deleted' });
    const incomingEmpCode = req.body.empCode !== undefined ? safeTrim(req.body.empCode) : undefined;
    const existingEmpCode = safeTrim(existingUser.empCode || '');
    if (incomingEmpCode !== undefined && incomingEmpCode !== '' && incomingEmpCode.toLowerCase() !== existingEmpCode.toLowerCase()) {
      return res.status(400).json({
        status: false,
        message: 'empCode cannot be changed after creation. Use the Sync with Staff feature to re-link.'
      });
    }
    const updateDoc = {};
    if (req.body.name !== undefined) updateDoc.name = safeTrim(req.body.name);
    if (req.body.email !== undefined) updateDoc.email = safeLower(req.body.email);
    if (req.body.phone !== undefined) updateDoc.phone = safeTrim(req.body.phone);
    if (req.body.centerIds !== undefined || req.body.centerId !== undefined) {
      updateDoc.centers = await resolveCenters(tenantId, req.body);
    }
    if (req.body.status !== undefined) updateDoc.status = req.body.status;
    if (req.body.roleLevel !== undefined) {
      const lvl = VALID_ROLES.includes(safeTrim(req.body.roleLevel)) ? safeTrim(req.body.roleLevel) : existingUser.roleLevel;
      updateDoc.roleLevel = lvl;
      updateDoc.roleLabel = ROLE_MAP[lvl];
    }
    if (req.body.password) {
      updateDoc.password = await bcrypt.hash(String(req.body.password), Rounds);
    }
    if (Object.keys(updateDoc).length === 0) return res.status(400).json({ status: false, message: 'No fields to update' });
    const updated = await User.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: updateDoc }, { new: true }).select('-password');
    if (!updated) return res.status(404).json({ status: false, message: 'User not found or already deleted' });
    return res.status(200).json({ status: true, message: 'User updated successfully', data: updated });
  } catch (err) {
    if (err?.code === 11000) {
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
    const target = await User.findOne({ _id: recId, tenantId, isdeleted: false }).lean();
    if (!target) return res.status(404).json({ status: false, message: 'User not found or already deleted' });
    if (target.roleLevel === 'L1') return res.status(403).json({ status: false, message: 'Super Admin (L1) users cannot be deleted.' });
    const deletedUser = await User.findOneAndUpdate({ _id: recId, tenantId, isdeleted: false }, { $set: { isdeleted: true, status: 'Inactive' } }, { new: true }).select('-password');
    if (!deletedUser) return res.status(404).json({ status: false, message: 'User not found or already deleted' });
    await Token.deleteMany({ userId: deletedUser.userId });
    if (deletedUser.staffId) await Staff.updateOne({ tenantId, staffId: deletedUser.staffId, isdeleted: false }, { $set: { userId: null } });
    return res.status(200).json({ status: true, message: 'User deleted successfully', data: deletedUser });
  } catch (err) {
    return next(err);
  }
};

const Loginuser = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: safeLower(email), isdeleted: false });
    if (!user) return next({ status: constants.HTTPS_NOT_FOUND, message: 'User not found.' });
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return next({ status: constants.HTTPS_UNAUTHORISED, message: 'Invalid password.' });
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const hashedRefresh = hashToken(refreshToken);
    await Token.deleteMany({ userId: user.userId, expiresAt: { $lt: new Date() } });
    await Token.create({
      userId: user.userId,
      token: hashedRefresh,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    const userdata = { ...user.toJSON(), token };
    delete userdata.password;
    if (user.roleLevel === 'L4' && user.staffId) {
      const staffDoc = await Staff.findOne({ tenantId: user.tenantId, staffId: user.staffId, isdeleted: false }, { staffId: 1, subject: 1, facultyType: 1 }).lean();
      if (staffDoc) {
        userdata.subjectId = staffDoc.subject ? String(staffDoc.subject) : null;
        userdata.facultyType = staffDoc.facultyType || null;
      }
    }
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Login successful', data: userdata });
  } catch (err) {
    return next(err);
  }
};

const refreshToken = async (req, res, next) => {
  const rt = req.cookies.refresh_token;
  if (!rt) return res.status(400).json({ message: 'Missing refresh token' });
  const hashed = hashToken(rt);
  const stored = await Token.findOne({ token: hashed });
  if (!stored || stored.expiresAt < new Date()) return res.status(403).json({ message: 'Invalid or expired refresh token' });
  try {
    const payload = verifyRefreshToken(rt);
    const user = await User.findOne({ userId: payload.CRN, isdeleted: false });
    if (!user) return next({ status: constants.HTTPS_NOT_FOUND, message: 'User not found.' });
    const newAccessToken = signAccessToken(user);
    return res.status(200).json({ status: true, token: newAccessToken });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return res.status(403).json({ message: 'Invalid or expired refresh token' });
    return next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const rt = req.cookies.refresh_token;
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict'
    });
    if (rt) await Token.deleteOne({ token: hashToken(rt) });
    const fcmToken = safeTrim(req.body?.fcmToken);
    if (fcmToken && req.body?.userId) {
      const userId = safeTrim(req.body?.userId);
      await User.updateOne({ userId }, { $pull: { fcmTokens: { token: fcmToken } } });
    }
    return res.status(200).json({ status: true, message: 'User Logged out successfully' });
  } catch (err) {
    return next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ status: false, message: 'Unauthorized – user not found in request context' });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ status: false, message: 'currentPassword and newPassword are required' });
    if (String(newPassword).length < 8) return res.status(400).json({ status: false, message: 'New password must be at least 8 characters long' });
    const user = await User.findOne({ userId, isdeleted: false });
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ status: false, message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, Rounds);
    await user.save();
    await Token.deleteMany({ userId });
    logger?.info?.({ userId: user._id }, 'Password changed successfully');
    return res.status(200).json({ status: true, message: 'Password updated successfully' });
  } catch (err) {
    logger?.error?.({ err }, 'Error in changePassword');
    return next(err);
  }
};

const syncExistingUsersAndStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const unlinkedUsers = await User.find({ tenantId, staffId: null, isdeleted: false }).lean();
    if (!unlinkedUsers.length) {
      return res.status(200).json({ status: true, message: 'All users are already linked to staff profiles.', linked: 0 });
    }
    const allStaff = await Staff.find({ tenantId, isdeleted: false }).lean();
    const staffByEmpCode = new Map();
    const staffByPhone = new Map();
    const staffByEmail = new Map();
    for (const s of allStaff) {
      if (s.employeeId) staffByEmpCode.set(String(s.employeeId).toLowerCase().trim(), s);
      if (s.phone) staffByPhone.set(String(s.phone).trim(), s);
      if (s.email) staffByEmail.set(String(s.email).toLowerCase().trim(), s);
    }
    let linkCount = 0;
    const errors = [];
    const linked = [];
    for (const user of unlinkedUsers) {
      let match = null;
      if (user.empCode) {
        match = staffByEmpCode.get(String(user.empCode).toLowerCase().trim()) || null;
      }
      if (!match && user.phone) {
        match = staffByPhone.get(String(user.phone).trim()) || null;
      }
      if (!match && user.email) {
        match = staffByEmail.get(String(user.email).toLowerCase().trim()) || null;
      }
      if (!match) continue;
      if (match.userId === user.userId) continue;
      try {
        const userUpdate = { staffId: match.staffId };
        if (!user.empCode && match.employeeId) {
          userUpdate.empCode = safeTrim(match.employeeId);
        }
        await User.updateOne({ _id: user._id, tenantId }, { $set: userUpdate });
        await Staff.updateOne({ _id: match._id, tenantId }, { $set: { userId: user.userId } });
        linkCount++;
        linked.push({
          user: user.email,
          staff: match.staffName || match.employeeId,
          empCode: userUpdate.empCode || user.empCode || null,
          backfilled: !!userUpdate.empCode
        });
      } catch (e) {
        errors.push(`Failed to link ${user.email} ↔ ${match.staffName || match.employeeId}: ${e.message}`);
      }
    }
    const linkedUsersWithoutEmpCode = await User.find({
      tenantId,
      staffId: { $ne: null },
      $or: [{ empCode: null }, { empCode: '' }, { empCode: { $exists: false } }],
      isdeleted: false
    }).lean();
    let backfillCount = 0;
    if (linkedUsersWithoutEmpCode.length) {
      const staffIdList = linkedUsersWithoutEmpCode.map((u) => u.staffId).filter(Boolean);
      const staffForBackfill = await Staff.find({ tenantId, staffId: { $in: staffIdList }, isdeleted: false }, { staffId: 1, employeeId: 1 }).lean();
      const staffEmpMap = new Map(staffForBackfill.map((s) => [s.staffId, s.employeeId]));
      for (const user of linkedUsersWithoutEmpCode) {
        const empCode = staffEmpMap.get(user.staffId);
        if (!empCode) continue;
        try {
          await User.updateOne({ _id: user._id, tenantId }, { $set: { empCode: safeTrim(empCode) } });
          backfillCount++;
        } catch (e) {
          errors.push(`Failed to backfill empCode for ${user.email}: ${e.message}`);
        }
      }
    }
    return res.status(200).json({
      status: true,
      message: linkCount > 0 || backfillCount > 0 ? `Linked: ${linkCount} user(s), empCode backfilled: ${backfillCount} user(s).` : 'No matching staff records found for unlinked users.',
      linked: linkCount,
      backfilled: backfillCount,
      details: linked,
      errors: errors.length ? errors : undefined
    });
  } catch (err) {
    return next(err);
  }
};

const importUsers = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const mode = safeTrim(req.body.mode) === 'insert' ? 'insert' : 'upsert';
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ status: false, message: 'rows is required' });
    const empCodesFromUpload = [...new Set(rows.map((r) => (r.empCode ? safeTrim(r.empCode) : null)).filter(Boolean))];
    let staffMappingDict = {};
    if (empCodesFromUpload.length) {
      const matchedStaff = await Staff.find(
        {
          tenantId,
          employeeId: {
            $in: empCodesFromUpload.map((c) => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))
          },
          isdeleted: false
        },
        { staffId: 1, userId: 1, employeeId: 1 }
      ).lean();

      staffMappingDict = matchedStaff.reduce((acc, s) => {
        if (s.employeeId) acc[String(s.employeeId).toLowerCase()] = { staffId: s.staffId, userId: s.userId || null };
        return acc;
      }, {});
    }
    const uniquePasswords = [...new Set(rows.map((r) => safeTrim(r?.password) || 'Welcome@123'))];
    const passwordMap = new Map();
    await Promise.all(
      uniquePasswords.map(async (pw) => {
        passwordMap.set(pw, await bcrypt.hash(pw, Rounds));
      })
    );
    const staffWithExistingUser = Object.values(staffMappingDict)
      .filter((s) => s.userId)
      .map((s) => s.userId);
    const activeLinkedUsers = staffWithExistingUser.length ? await User.find({ tenantId, userId: { $in: staffWithExistingUser }, isdeleted: false }, { userId: 1, email: 1 }).lean() : [];
    const activeLinkedUserIdSet = new Set(activeLinkedUsers.map((u) => u.userId));
    const ops = [];
    const skippedRows = [];
    const validEmailsForPostSync = [];
    for (const r0 of rows) {
      const r = r0 || {};
      const name = safeTrim(r.name);
      const email = safeLower(r.email);
      const phone = safeTrim(r.phone);
      const rawRole = safeTrim(r.roleLevel).toUpperCase();
      const empCode = r.empCode ? safeTrim(r.empCode) : null;
      const centerId = r.centerId ? safeTrim(r.centerId) : null;
      const centerName = r.centerName ? safeTrim(r.centerName) : null;
      // Bulk import stays single-center-per-row for now; wrapped to match the centers[] schema shape.
      const centers = centerId ? [{ centerId, centerName }] : [];
      const rawPw = safeTrim(r.password) || 'Welcome@123';
      const rowErrors = [];
      if (!name) rowErrors.push('name required');
      if (!email) rowErrors.push('email required');
      if (!phone) rowErrors.push('phone required');
      if (!VALID_ROLES.includes(rawRole)) rowErrors.push(`invalid roleLevel "${rawRole}" — must be one of ${VALID_ROLES.join(', ')}`);
      if (rowErrors.length) {
        skippedRows.push({ email: email || '(empty)', reason: rowErrors.join(', ') });
        continue;
      }
      const roleLevel = rawRole;
      const roleLabel = ROLE_MAP[roleLevel];
      const hashedPassword = passwordMap.get(rawPw);
      const empCodeKey = empCode ? empCode.toLowerCase() : null;
      const staffEntry = empCodeKey ? staffMappingDict[empCodeKey] : null;
      let mappedStaffId = staffEntry?.staffId || null;
      if (staffEntry?.userId && activeLinkedUserIdSet.has(staffEntry.userId)) {
        const linkedUser = activeLinkedUsers.find((u) => u.userId === staffEntry.userId);
        if (linkedUser && linkedUser.email !== email) {
          skippedRows.push({ email, reason: `empCode ${empCode} already linked to user: ${linkedUser.email}` });
          mappedStaffId = null;
        }
      }
      const filter = { tenantId, email, isdeleted: false };
      if (mappedStaffId) validEmailsForPostSync.push(email);
      const setOnInsertBase = { tenantId, userId: uuid(), email, password: hashedPassword, isdeleted: false };
      if (mode === 'insert') {
        ops.push({
          updateOne: {
            filter,
            update: {
              $set: { ...(empCode !== null ? { empCode } : {}), ...(mappedStaffId ? { staffId: mappedStaffId } : {}) },
              $setOnInsert: { ...setOnInsertBase, name, phone, roleLevel, roleLabel, centers, status: 'Active' }
            },
            upsert: true
          }
        });
      } else {
        ops.push({
          updateOne: {
            filter,
            update: {
              $set: { name, phone, empCode, staffId: mappedStaffId, roleLevel, roleLabel, centers, status: 'Active' },
              $setOnInsert: setOnInsertBase
            },
            upsert: true
          }
        });
      }
    }
    if (!ops.length) {
      return res.status(200).json({
        status: true,
        message: 'No valid rows to import',
        data: { mode, inserted: 0, updated: 0, skipped: skippedRows.length, skippedRows }
      });
    }
    const bulkRes = await User.bulkWrite(ops, { ordered: false });
    const inserted = bulkRes?.upsertedCount || 0;
    const updated = bulkRes?.modifiedCount || 0;
    if (validEmailsForPostSync.length) {
      const importedUsers = await User.find({ tenantId, email: { $in: validEmailsForPostSync }, isdeleted: false }, { userId: 1, staffId: 1, email: 1 }).lean();
      const staffOps = importedUsers
        .filter((u) => u.staffId && u.userId)
        .map((u) => ({
          updateOne: {
            filter: { tenantId, staffId: u.staffId, isdeleted: false },
            update: { $set: { userId: u.userId } }
          }
        }));

      if (staffOps.length) await Staff.bulkWrite(staffOps, { ordered: false });
    }
    return res.status(200).json({
      status: true,
      message: 'User import completed',
      data: { mode, inserted, updated, skipped: skippedRows.length, skippedRows }
    });
  } catch (err) {
    if (err?.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0] || 'unique field';
      return res.status(409).json({ status: false, message: `Duplicate ${dupField}.` });
    }
    return next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const email = safeLower(req.body.email);
    if (!email) return res.status(400).json({ status: false, message: 'email is required' });
    const user = await User.findOne({ email, isdeleted: false }).lean();
    if (!user) return res.status(200).json({ status: true, message: 'If this email exists, an OTP has been sent.' });
    const otp = await generateAndSaveOtp(user.userId, user.tenantId, 'FORGOT_PASSWORD');
    await sendOtpEmail(email, user.name, otp, 'Password Reset');
    return res.status(200).json({ status: true, message: 'If this email exists, an OTP has been sent.' });
  } catch (err) {
    logger.error(`Error in forgotPassword: ${err.message}`);
    return next(err);
  }
};

const verifyForgotOtp = async (req, res, next) => {
  try {
    const email = safeLower(req.body.email);
    const { otp } = req.body;
    if (!email || !otp) return res.status(400).json({ status: false, message: 'email and otp are required' });
    const user = await User.findOne({ email, isdeleted: false }).lean();
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    const result = await verifyOtp(user.userId, 'FORGOT_PASSWORD', otp);
    if (!result.valid) return res.status(400).json({ status: false, message: result.message });
    const resetToken = jwt.sign({ userId: user.userId, purpose: 'RESET_PASSWORD' }, process.env.JWT_SECRET || 'admin@123', { expiresIn: '15m' });
    return res.status(200).json({ status: true, message: 'OTP verified', resetToken });
  } catch (err) {
    logger.error(`Error in verifyForgotOtp: ${err.message}`);
    return next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ status: false, message: 'resetToken and newPassword are required' });
    if (String(newPassword).length < 8) return res.status(400).json({ status: false, message: 'New password must be at least 8 characters' });
    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET || 'admin@123');
    } catch (e) {
      return res.status(400).json({ status: false, message: 'Reset token is invalid or expired' });
    }
    if (payload.purpose !== 'RESET_PASSWORD') return res.status(400).json({ status: false, message: 'Invalid token purpose' });
    const user = await User.findOne({ userId: payload.userId, isdeleted: false });
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    user.password = await bcrypt.hash(newPassword, Rounds);
    await user.save();
    await Token.deleteMany({ userId: user.userId });
    logger.info(`Password reset successful for userId: ${user.userId}`);
    return res.status(200).json({ status: true, message: 'Password reset successful. Please login with your new password.' });
  } catch (err) {
    logger.error(`Error in resetPassword: ${err.message}`);
    return next(err);
  }
};

const registerFcmToken = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    const token = safeTrim(req.body?.token);
    const device = safeTrim(req.body?.device) || null;
    if (!tenantId || !userId || !token) {
      return res.status(400).json({ status: false, message: 'tenantId, userId and token are required' });
    }
    const user = await User.findOne({ tenantId, userId, isdeleted: false, roleLevel: { $in: ['L1', 'L4'] } }).lean();
    if (!user) return res.status(403).json({ status: false, message: 'Not authorized to register FCM token' });

    // Remove existing entry for same token, then push fresh
    await User.updateOne({ tenantId, userId }, { $pull: { fcmTokens: { token } } });
    await User.updateOne({ tenantId, userId }, { $push: { fcmTokens: { token, device, updatedAt: Date.now() } } });
    return res.status(200).json({ status: true, message: 'FCM token registered' });
  } catch (err) {
    return next(err);
  }
};

const removeFcmToken = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId || req.user?.userId);
    const token = safeTrim(req.body?.token);
    if (!tenantId || !userId || !token) {
      return res.status(400).json({ status: false, message: 'tenantId, userId and token are required' });
    }
    await User.updateOne({ tenantId, userId }, { $pull: { fcmTokens: { token } } });
    return res.status(200).json({ status: true, message: 'FCM token removed' });
  } catch (err) {
    return next(err);
  }
};

const testFcmNotification = async (req, res, next) => {
  try {
    const token = safeTrim(req.body?.token);
    const title = safeTrim(req.body?.title) || 'Test Notification';
    const body = safeTrim(req.body?.body) || 'This is a test push notification from Z7I';
    if (!token) return res.status(400).json({ status: false, message: 'token is required' });

    const { sendPushToUsers } = await import('../helpers/firebase.helper.js');

    // Temporarily inject token directly
    const admin = (await import('firebase-admin')).default;
    const message = {
      notification: { title, body },
      data: { type: 'TEST' },
      android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      token
    };
    const result = await admin.messaging().send(message);
    return res.status(200).json({ status: true, message: 'Notification sent', messageId: result });
  } catch (err) {
    return res.status(500).json({ status: false, message: err?.message || 'Failed to send notification' });
  }
};

export default {
  createUser,
  listUsers,
  viewUser,
  updateUser,
  deleteUser,
  Loginuser,
  refreshToken,
  logout,
  changePassword,
  syncExistingUsersAndStaff,
  importUsers,
  forgotPassword,
  verifyForgotOtp,
  resetPassword,
  registerFcmToken,
  removeFcmToken,
  testFcmNotification
};
