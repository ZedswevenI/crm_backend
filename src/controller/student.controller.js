import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import StudentProfile from '../models/studentProfile.model.js';
import Admission from '../models/admission.model.js';
import Batch from '../models/batch.model.js';
import Payment from '../models/admissionpayments.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toNum = (v) => {
  const n = Number(
    String(v || '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
};

const listStudents = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const q = req.query || {};
    const search = safeTrim(q.search);
    const programId = safeTrim(q.programId);
    const batchId = safeTrim(q.batchId);
    const centerId = safeTrim(q.centerId);
    const academicYear = safeTrim(q.academicYear);
    const status = safeTrim(q.status);
    const query = { tenantId, isdeleted: false };
    if (programId) query.programId = programId;
    if (batchId) query.batchId = batchId;
    if (centerId) query.centerId = centerId;
    if (academicYear) query.academicYear = academicYear;
    if (status && status !== 'ALL') query.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ 'student.name': rx }, { admissionNo: rx }, { registrationNumber: rx }, { 'student.phone': rx }, { 'student.parentPhone': rx }];
    }
    const isFullList = safeTrim(q.list).toLowerCase() === 'full';
    if (isFullList) {
      const rows = await StudentProfile.find(query).sort({ createdAt: -1 }).lean();
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'Student list fetched (full)',
        data: rows,
        count: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1
      });
    }
    const page = Math.max(parseInt(q.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(q.limit || '20', 10), 1), 200);
    const skip = (page - 1) * limit;
    const [rows, count] = await Promise.all([StudentProfile.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), StudentProfile.countDocuments(query)]);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Student list fetched',
      data: rows,
      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit) || 0
    });
  } catch (err) {
    return next(err);
  }
};

const viewProfile = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    const profile = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false }).lean();
    if (!profile) return res.status(404).json({ status: false, message: 'Student profile not found' });
    const admission = await Admission.findOne({ tenantId, admissionId: profile.admissionId, isdeleted: false }, { 'student.address': 1, 'student.city': 1, 'student.state': 1, 'student.pincode': 1, 'student.dateOfBirth': 1, 'student.gender': 1 }).lean();
    let mentorName = null;
    let joiningDate = profile.createdAt;
    if (profile.batchId) {
      const batch = await Batch.findOne({ tenantId, batchId: profile.batchId, isdeleted: false }).lean();
      if (batch) {
        if (batch.staffMap && batch.staffMap.length > 0) {
          mentorName = batch.staffMap[0].staffName;
        }
        if (batch.startDate) joiningDate = batch.startDate;
      }
    }
    const data = {
      basic: {
        studentId: profile.studentId,
        admissionNo: profile.admissionNo,
        name: profile.student.name,
        status: profile.status,
        mobile: profile.student.phone,
        email: profile.student.email,
        parentName: profile.student.parentName,
        parentMobile: profile.student.parentPhone,
        addressLine1: admission?.student?.address || '',
        city: admission?.student?.city || '',
        gender: admission?.student?.gender || '',
        dob: admission?.student?.dateOfBirth || null
      },
      program: {
        programName: profile.programName,
        programCode: profile.programCode,
        batchName: profile.batchCode || 'Unassigned',
        centerName: profile.centerName,
        academicYear: profile.academicYear,
        joiningDate: joiningDate,
        mentorName: mentorName || 'Not Assigned'
      }
    };
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, data });
  } catch (err) {
    return next(err);
  }
};

// const viewFinancials = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const studentId = safeTrim(req.body?.studentId);
//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
//     if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
//     const profile = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false }).lean();
//     if (!profile) return res.status(404).json({ status: false, message: 'Student profile not found' });
//     const admission = await Admission.findOne({ tenantId, admissionId: profile.admissionId, isdeleted: false }).lean();
//     const totalAmount = toNum(admission?.fee?.finalFee);
//     const payments = await Payment.find({ tenantId, admissionId: profile.admissionId, isdeleted: false, status: { $ne: 'CANCELLED' } })
//       .sort({ createdAt: -1 })
//       .lean();
//     let paidAmount = 0;
//     const receipts = payments.map((p) => {
//       const isCleared = p.status === 'CLEARED';
//       if (isCleared) paidAmount += toNum(p.amount);
//       return {
//         receiptNo: p.paymentId,
//         date: p.clearedOn || p.depositedOn || p.submittedOn || p.createdAt,
//         mode: p.paymentType,
//         amount: p.amount,
//         status: p.status,
//         remarks: p.remarks
//       };
//     });
//     const outstandingAmount = Math.max(0, totalAmount - paidAmount);
//     return res.status(constants.HTTPS_SUCCESS).json({
//       status: true,
//       data: {
//         totalAmount,
//         paidAmount,
//         outstandingAmount,
//         receipts
//       }
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const viewFinancials = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    const profile = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false }).lean();
    if (!profile) return res.status(404).json({ status: false, message: 'Student profile not found' });
    const admission = await Admission.findOne({ tenantId, admissionId: profile.admissionId, isdeleted: false }).lean();
    const totalAmount = toNum(admission?.fee?.finalFee);
    const payments = await Payment.find({ tenantId, admissionId: profile.admissionId, isdeleted: false, status: { $ne: 'CANCELLED' } })
      .sort({ createdAt: -1 })
      .lean();
    let paidAmount = 0;
    const receipts = payments.map((p) => {
      const isCollected = ['SUBMITTED', 'DEPOSITED', 'CLEARED'].includes(p.status);
      if (isCollected) {
        paidAmount += toNum(p.amount);
      }
      return {
        receiptNo: p.paymentId,
        date: p.clearedOn || p.depositedOn || p.submittedOn || p.createdAt,
        mode: p.paymentType,
        amount: p.amount,
        status: p.status,
        remarks: p.remarks
      };
    });
    const outstandingAmount = Math.max(0, totalAmount - paidAmount);
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      data: {
        totalAmount,
        paidAmount,
        outstandingAmount,
        receipts
      }
    });
  } catch (err) {
    return next(err);
  }
};

const viewAcademicSummary = async (req, res, next) => {
  try {
    const data = {
      attendance: {
        overallPct: 0,
        lastSessions: []
      },
      assignments: {
        completed: 0,
        total: 0,
        items: []
      },
      exams: {
        averageScore: 0,
        items: []
      }
    };
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, data });
  } catch (err) {
    return next(err);
  }
};

export default {
  listStudents,
  viewProfile,
  viewFinancials,
  viewAcademicSummary
};
