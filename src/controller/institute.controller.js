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
import Token from '../models/auth.model.js';

dotenv.config();
const Rounds = 12;

const createTenant = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const entityCreate = new Tenant({
      tenantName: req.body.tenantName,
      tenantId: uuid(),
      email: req.body.email,
      phone: req.body.phone,
      cntatName: req.body.contactName,
      entAddress1: req.body.Address1 || null,
      entAddress2: req.body.Address2 || null,
      entArea: req.body.Area || null,
      entCity: req.body.City || null,
      entState: req.body.State || null,
      entCountry: req.body.Country || null,
      entZip: req.body.entZip || null,
      entWebsite: req.body.Website || null,
      hasGST: false,
      GSTN: req.body.gstn || null,
      istermAccepted: req.body.terms_verified,
      isdeleted: false
    });
    await entityCreate.save({ session });
    const hashedPassword = await bcrypt.hash(req.body.password, Rounds);
    // Create Admin User
    const createAdminUsr = new User({
      tenantId: entityCreate.tenantId,
      userId: uuid(),
      full_name: entityCreate.cntatName,
      email: entityCreate.email,
      phone: entityCreate.phone,
      password: hashedPassword,
      permissions: 'admin',
      isAdmin: true,
      isdeleted: false
    });
    await createAdminUsr.save({ session });
    await session.commitTransaction();
    const response = createAdminUsr.toObject();
    delete response.password;
    delete response.isActive;
    delete response.isdeleted;
    return res.status(constants.HTTPS_CREATED).json({ status: true, message: 'Registration SUccessful!!', data: response });
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

const Loginuser = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email, isdeleted: false });
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
    const userdata = { ...user.toJSON(), token: token };
    delete userdata.password;
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
    const refreshToken = req.cookies.refreshToken;
    res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'Strict', path: '/wms/api/custo/refresh' });

    if (refreshToken) {
      await Token.deleteOne({ token: refreshToken });
    }
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'User Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { entiId, full_name, email, phone, password, permissions, isAdmin } = req.body;
    const tenantId = (entiId || '').toString().trim();
    if (!tenantId || !full_name || !email || !password) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).send({
        status: false,
        message: 'tenantId, full_name, email and password are required'
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuid();
    const newUser = await User.create({
      tenantId,
      userId,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || null,
      password: hashedPassword,
      permissions: permissions || null,
      isAdmin: !!isAdmin,
      createdBy: req.body.userId || null,
      updatedBy: null
    });
    const userObj = newUser.toObject();
    delete userObj.password;
    return res.status(constants.HTTPS_CREATED || 201).send({
      status: true,
      message: 'User created successfully',
      data: userObj
    });
  } catch (err) {
    return next(err);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const listType = req.query.list;
    const sort = req.query.sort || '-createdAt';
    const search = (req.query.search || '').trim();
    const permissions = (req.query.permissions || '').trim();
    const isAdminFlag = req.query.isAdmin;
    const tenantId = (req.body.entiId || req.body.tenantId || '').toString().trim();
    if (!tenantId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).send({ status: false, message: 'tenantId (entiId) is required' });
    }
    let userList;
    let count;
    let page;
    const searchFields = ['full_name', 'email', 'phone', 'userId'];
    const query = {
      tenantId,
      isdeleted: false
    };
    if (permissions) {
      query.permissions = permissions;
    }
    if (typeof isAdminFlag !== 'undefined') {
      query.isAdmin = isAdminFlag === true || isAdminFlag === 'true' || isAdminFlag === '1';
    }
    if (search) {
      query.$or = searchFields.map((field) => ({
        [field]: { $regex: search, $options: 'i' }
      }));
    }
    if (listType === 'full') {
      userList = await User.find(query).sort('createdAt').select('-password');
      count = userList.length;
    } else {
      page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;
      count = await User.countDocuments(query);
      userList = await User.find(query).sort(sort).skip(skip).limit(limit).select('-password').populate({
        path: 'createdBy',
        model: 'user',
        localField: 'createdBy',
        foreignField: 'userId',
        justOne: true,
        select: '_id userId full_name email'
      });
    }
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      data: userList,
      page: page,
      count: count,
      message: 'User list retrieved successfully'
    });
  } catch (err) {
    console.log('err ', err);
    return next(err);
  }
};

const viewUser = async (req, res, next) => {
  try {
    const { recId } = req.body;
    const tenantId = (req.body.entiId || req.body.tenantId || '').toString().trim();
    if (!recId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).send({ status: false, message: 'recId is required' });
    }
    const query = { _id: recId, isdeleted: false };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const user = await User.findOne(query).select('-password');
    if (!user) {
      return res.status(constants.HTTPS_NOT_FOUND || 404).send({ status: false, message: 'User not found' });
    }
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      message: 'User details retrieved successfully',
      data: user
    });
  } catch (err) {
    return next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { recId } = req.body;
    const tenantId = (req.body.entiId || req.body.tenantId || '').toString().trim();
    const { full_name, email, phone, password, permissions, isAdmin } = req.body;
    if (!recId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).send({ status: false, message: 'recId is required' });
    }
    const query = { _id: recId, isdeleted: false };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const updateDoc = {};
    if (full_name !== undefined) updateDoc.full_name = full_name.trim();
    if (email !== undefined) updateDoc.email = email.trim().toLowerCase();
    if (phone !== undefined) updateDoc.phone = phone;
    if (permissions !== undefined) updateDoc.permissions = permissions || null;
    if (isAdmin !== undefined) updateDoc.isAdmin = !!isAdmin;
    updateDoc.updatedBy = req.body.userId;
    if (password !== undefined && password !== null && password !== '') {
      updateDoc.password = password;
    }
    if (Object.keys(updateDoc).length === 0) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).send({ status: false, message: 'No fields to update' });
    }
    const updatedUser = await User.findOneAndUpdate(query, { $set: updateDoc }, { new: true }).select('-password');
    if (!updatedUser) {
      return res.status(constants.HTTPS_NOT_FOUND || 404).send({ status: false, message: 'User not found or already deleted' });
    }
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (err) {
    return next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { recId, updatedBy } = req.body;
    const tenantId = (req.body.entiId || req.body.tenantId || '').toString().trim();
    if (!recId) {
      return res.status(constants.HTTPS_BAD_REQUEST || 400).send({ status: false, message: 'recId is required' });
    }
    const query = { _id: recId, isdeleted: false };
    if (tenantId) {
      query.tenantId = tenantId;
    }
    const deletedUser = await User.findOneAndUpdate(
      query,
      {
        $set: {
          isdeleted: true,
          updatedBy: updatedBy || null
        }
      },
      { new: true }
    ).select('-password');
    if (!deletedUser) {
      return res.status(constants.HTTPS_NOT_FOUND || 404).send({ status: false, message: 'User not found or already deleted' });
    }
    return res.status(constants.HTTPS_SUCCESS).send({
      status: true,
      message: 'User deleted successfully',
      data: deletedUser
    });
  } catch (err) {
    return next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) {
      return res.status(401).json({
        status: false,
        message: 'Unauthorized – user not found in request context'
      });
    }
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: false,
        message: 'currentPassword and newPassword are required'
      });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({
        status: false,
        message: 'New password must be at least 8 characters long'
      });
    }
    const user = await User.findOne({ userId: userId, isdeleted: false });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: 'Current password is incorrect'
      });
    }
    const saltRounds = 10;
    const newHash = await bcrypt.hash(newPassword, saltRounds);
    user.password = newHash;
    await user.save();
    logger?.info?.({ userId: user._id }, 'Password changed successfully');
    return res.status(200).json({
      status: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    logger?.error?.({ err }, 'Error in changePassword');
    return next(err);
  }
};

export default {
  createTenant: createTenant,
  Loginuser: Loginuser,
  refreshToken: refreshToken,
  logout: logout,
  createUser: createUser,
  listUsers: listUsers,
  viewUser: viewUser,
  updateUser: updateUser,
  deleteUser: deleteUser,
  changePassword: changePassword
};
