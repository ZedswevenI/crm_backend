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
    const staffId = safeTrim(req.body?.staffId || req.query?.staffId || req.body?.facultyId);

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

const getTeacherBatches = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const staffId = safeTrim(req.body?.staffId || req.body?.facultyId);
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    // ── Fetch staff ───────────────────────────────────────────────────────────
    const staffDoc = await Staff.findOne({ tenantId, staffId, isdeleted: false }, { staffId: 1, staffName: 1, staffCode: 1, subject: 1, facultyType: 1 }).lean();
    if (!staffDoc) return res.status(404).json({ status: false, message: 'Staff not found' });
    // ── Find ACTIVE batches where this staff is in staffMap ───────────────────
    const batches = await Batch.find(
      {
        tenantId,
        isdeleted: false,
        status: 'ACTIVE',
        staffMap: { $elemMatch: { staffId } }
      },
      {
        batchId: 1,
        batchCode: 1,
        batchName: 1,
        classNo: 1,
        yearNo: 1,
        academicYear: 1,
        programId: 1,
        programName: 1,
        centerId: 1,
        centerName: 1,
        studentCount: 1,
        startDate: 1,
        endDate: 1,
        status: 1,
        staffMap: 1
      }
    )
      .sort({ classNo: 1, batchName: 1 })
      .lean();

    // ── Early return ──────────────────────────────────────────────────────────
    if (!batches.length) {
      return res.json({
        status: true,
        message: 'No active batches assigned to this teacher',
        data: {
          staffId,
          staffName: staffDoc.staffName || null,
          staffCode: staffDoc.staffCode || null,
          batches: [],
          subjects: [],
          classes: []
        }
      });
    }

    // ── Build batches array ───────────────────────────────────────────────────
    // Each entry is one batch — includes the subjects this teacher
    // handles in that specific batch (from staffMap rows matching staffId)
    const batchList = batches.map((b) => {
      const myStaffMapRows = (Array.isArray(b.staffMap) ? b.staffMap : []).filter((row) => safeTrim(row?.staffId) === staffId);

      const batchSubjects = myStaffMapRows
        .map((row) => ({
          subjectId: safeTrim(row?.subjectId || ''),
          subjectName: safeTrim(row?.subjectName || '')
        }))
        .filter((s) => s.subjectId);

      return {
        batchId: b.batchId,
        batchCode: b.batchCode,
        batchName: b.batchName,
        classNo: b.classNo ?? null,
        yearNo: b.yearNo ?? null,
        academicYear: b.academicYear || null,
        programId: b.programId || null,
        programName: b.programName || null,
        centerId: b.centerId || null,
        centerName: b.centerName || null,
        studentCount: b.studentCount ?? 0,
        startDate: b.startDate ?? null,
        endDate: b.endDate ?? null,
        status: b.status || null,
        subjects: batchSubjects // subjects teacher handles in THIS batch
      };
    });

    // ── Build subjects array — unique across all batches ──────────────────────
    const subjectMap = new Map();
    for (const b of batches) {
      const myRows = (Array.isArray(b.staffMap) ? b.staffMap : []).filter((row) => safeTrim(row?.staffId) === staffId);
      for (const row of myRows) {
        const sid = safeTrim(row?.subjectId || '');
        if (sid && !subjectMap.has(sid)) {
          subjectMap.set(sid, {
            subjectId: sid,
            subjectName: safeTrim(row?.subjectName || '')
          });
        }
      }
    }
    const subjects = Array.from(subjectMap.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    // ── Build classes array — unique classNo across all batches ───────────────
    const classMap = new Map();
    for (const b of batches) {
      const cn = b.classNo ?? null;
      if (cn !== null && !classMap.has(cn)) {
        classMap.set(cn, {
          classNo: cn,
          academicYear: b.academicYear || null // AY for this class level
        });
      }
    }
    const classes = Array.from(classMap.values()).sort((a, b) => Number(a.classNo) - Number(b.classNo));

    return res.json({
      status: true,
      message: 'Teacher batches loaded',
      data: {
        staffId,
        staffName: staffDoc.staffName || null,
        staffCode: staffDoc.staffCode || null,
        batches: batchList,
        subjects,
        classes
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  listTeachingStaff,
  viewTeachingStaff,
  getTeacherBatches
};
