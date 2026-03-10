import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import Staff from '../models/staff.model.js';
import User from '../models/users.model.js';
import Batch from '../models/batch.model.js';
import BatchAssignEnable from '../models/batchenabledAssignment.model.js';
import StudyMaterial from '../models/studymaterial.model.js';
import StudentPerformance from '../models/studentperformance.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

// API 1: List Teaching Staff
const listTeachingStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const search = safeTrim(req.query.search || req.body.search);
    const centerId = safeTrim(req.query.centerId || req.body.centerId);

    const page = Math.max(toInt(req.query.page || req.body.page, 1), 1);
    const limit = Math.min(Math.max(toInt(req.query.limit || req.body.limit, 20), 1), 200);
    const skip = (page - 1) * limit;

    // Filter strictly by TEACHING faculty type
    const query = { tenantId, isdeleted: false, facultyType: 'TEACHING' };

    if (centerId) query.centerId = centerId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ staffName: rx }, { staffCode: rx }, { phone: rx }, { email: rx }];
    }

    const [rows, count] = await Promise.all([Staff.find(query).populate('subject', 'subjectName').populate('department', 'departmentName').sort({ staffName: 1 }).skip(skip).limit(limit).lean(), Staff.countDocuments(query)]);

    return res.status(200).json({
      status: true,
      message: 'Teaching staff list loaded',
      data: rows,
      count,
      page,
      limit
    });
  } catch (err) {
    return next(err);
  }
};

// API 2: View Teaching Staff Comprehensive Details
const viewTeachingStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const staffId = safeTrim(req.body?.staffId || req.query?.staffId);

    if (!tenantId || !staffId) {
      return res.status(400).json({ status: false, message: 'tenantId and staffId are required' });
    }
    const staff = await Staff.findOne({ tenantId, staffId, isdeleted: false }).populate('subject', 'subjectName').populate('department', 'departmentName').lean();
    if (!staff) {
      return res.status(404).json({ status: false, message: 'Staff profile not found' });
    }
    const user = await User.findOne({ tenantId, staffId, isdeleted: false }, { userId: 1 }).lean();
    const resolvedUserId = user ? user.userId : null;
    const authorIds = [staffId];
    if (resolvedUserId) authorIds.push(resolvedUserId);
    const assignedBatches = await Batch.find(
      {
        tenantId,
        isdeleted: false,
        status: 'ACTIVE',
        'staffMap.staffId': staffId
      },
      { batchId: 1, batchName: 1, batchCode: 1, programName: 1, centerName: 1, staffMap: 1 }
    ).lean();
    const formattedBatches = assignedBatches.map((b) => ({
      batchId: b.batchId,
      batchName: b.batchName,
      batchCode: b.batchCode,
      programName: b.programName,
      centerName: b.centerName,
      subjectsAssigned: b.staffMap.filter((s) => s.staffId === staffId).map((s) => s.subjectName)
    }));
    const enabledAssignments = await BatchAssignEnable.find(
      {
        tenantId,
        isdeleted: false,
        enabledBy: { $in: authorIds }
      },
      { testId: 1, testNo: 1, batchId: 1, subjectId: 1, status: 1, enabledAt: 1 }
    ).lean();
    const uploadedMaterials = await StudyMaterial.find(
      {
        tenantId,
        isdeleted: false,
        createdBy: { $in: authorIds }
      },
      { materialId: 1, title: 1, classNo: 1, status: 1, createdAt: 1 }
    ).lean();
    const studentFeedbacks = await StudentPerformance.aggregate([
      { $match: { tenantId, isdeleted: false, 'staffFeedback.staffId': staffId } },
      { $unwind: '$staffFeedback' },
      { $match: { 'staffFeedback.staffId': staffId } },
      {
        $project: {
          _id: 0,
          studentId: 1,
          admissionNo: 1,
          academicYear: 1,
          feedbackId: '$staffFeedback.feedbackId',
          remarks: '$staffFeedback.remarks',
          addedAt: '$staffFeedback.addedAt'
        }
      },
      { $sort: { addedAt: -1 } }
    ]);
    return res.status(200).json({
      status: true,
      message: 'Staff details retrieved successfully',
      data: {
        basicInfo: staff,
        assignedBatches: formattedBatches,
        stats: {
          activeBatchesCount: formattedBatches.length,
          assignmentsEnabledCount: enabledAssignments.length,
          materialsUploadedCount: uploadedMaterials.length,
          feedbacksGivenCount: studentFeedbacks.length
        },
        enabledAssignments,
        uploadedMaterials,
        studentFeedbacks
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  listTeachingStaff,
  viewTeachingStaff
};
