import { v4 as uuid } from 'uuid';
import StaffPerformance from '../models/staffperformance.model.js';
import Staff from '../models/staff.model.js';
import constants from '../helpers/constants.js';
import StudentPerformance from '../models/studentperformance.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import BatchAssignEnable from '../models/batchenabledAssignment.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};
const toRating = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : null;
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const DEFAULT_WEIGHTS = { assignment: 0.4, mockExam: 0.3, schoolExam: 0.3 };

const computeCombinedScore = (assignment, examMarks, weights = DEFAULT_WEIGHTS) => {
  const assignmentScore = assignment?.cgpa != null ? (assignment.cgpa / 10) * 100 : null;
  const mockScore = examMarks?.mock?.score != null ? toNum(examMarks.mock.score) : null;
  const schoolScore = examMarks?.school?.score != null ? toNum(examMarks.school.score) : null;
  if (assignmentScore === null || mockScore === null || schoolScore === null) return null;
  const combined = assignmentScore * weights.assignment + mockScore * weights.mockExam + schoolScore * weights.schoolExam;
  return Math.round(combined * 100) / 100;
};

const addStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const staffId = safeTrim(payload.staffId);
    const remarks = safeTrim(payload.remarks) || null;
    const addedBy = safeTrim(payload.userId) || null;
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    const rating = toRating(payload.rating);
    if (rating === null) return res.status(400).json({ status: false, message: 'rating must be a number between 1 and 5' });
    const staff = await Staff.findOne({ tenantId, staffId, isdeleted: false }, { staffCode: 1, staffName: 1, staffType: 1, employeeId: 1 }).lean();
    if (!staff) return res.status(404).json({ status: false, message: 'Staff not found' });
    const doc = await StaffPerformance.create({
      tenantId,
      performanceId: uuid(),
      staffId,
      staffCode: staff.employeeId || staff.staffCode || null,
      staffName: staff.staffName || null,
      staffType: staff.staffType || null,
      rating,
      remarks,
      addedBy,
      isdeleted: false
    });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Staff feedback added',
      data: doc
    });
  } catch (err) {
    return next(err);
  }
};

const listStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const staffId = safeTrim(req.body?.staffId);
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    const page = Math.max(toInt(req.query.page || req.body?.page, 1), 1);
    const limit = Math.min(Math.max(toInt(req.query.limit || req.body?.limit, 20), 1), 200);
    const skip = (page - 1) * limit;
    const query = { tenantId, staffId, isdeleted: false };
    const [rows, count] = await Promise.all([StaffPerformance.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), StaffPerformance.countDocuments(query)]);
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

const updateStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const performanceId = safeTrim(req.body?.performanceId);
    if (!performanceId) return res.status(400).json({ status: false, message: 'performanceId is required' });
    const patch = {};
    if (req.body?.rating !== undefined) {
      const rating = toRating(req.body.rating);
      if (rating === null) return res.status(400).json({ status: false, message: 'rating must be between 1 and 5' });
      patch.rating = rating;
    }
    if (req.body?.remarks !== undefined) patch.remarks = safeTrim(req.body.remarks) || null;
    if (!Object.keys(patch).length) {
      return res.status(400).json({ status: false, message: 'Nothing to update. Provide rating or remarks.' });
    }
    const doc = await StaffPerformance.findOneAndUpdate({ tenantId, performanceId, isdeleted: false }, { $set: patch }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Feedback record not found' });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Feedback updated', data: doc });
  } catch (err) {
    return next(err);
  }
};

const deleteStaffFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const performanceId = safeTrim(req.body?.performanceId);
    if (!performanceId) return res.status(400).json({ status: false, message: 'performanceId is required' });
    const doc = await StaffPerformance.findOneAndUpdate({ tenantId, performanceId, isdeleted: false }, { $set: { isdeleted: true } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'Feedback record not found' });
    return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'Feedback deleted' });
  } catch (err) {
    return next(err);
  }
};

const listAllStaffPerf = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const search = safeTrim(payload.search);
    const staffType = safeTrim(payload.staffType);
    const page = Math.max(toInt(payload.page, 1), 1);
    const limit = Math.min(Math.max(toInt(payload.limit, 20), 1), 200);
    const skip = (page - 1) * limit;
    const matchBase = { tenantId, isdeleted: false };
    if (staffType) matchBase.staffType = staffType;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      matchBase.$or = [{ staffName: rx }, { staffCode: rx }, { staffId: rx }];
    }
    const pipeline = [
      { $match: matchBase },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$staffId',
          staffId: { $first: '$staffId' },
          staffCode: { $first: '$staffCode' },
          staffName: { $first: '$staffName' },
          staffType: { $first: '$staffType' },
          avgRating: { $avg: '$rating' },
          totalCount: { $sum: 1 },
          latestEntry: { $first: '$$ROOT' }
        }
      },
      { $sort: { 'latestEntry.createdAt': -1 } },
      { $skip: skip },
      { $limit: limit }
    ];
    const countPipeline = [{ $match: matchBase }, { $group: { _id: '$staffId' } }, { $count: 'total' }];
    const [rows, countResult] = await Promise.all([StaffPerformance.aggregate(pipeline), StaffPerformance.aggregate(countPipeline)]);
    const count = countResult[0]?.total || 0;
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

const pullAssignmentData = async (tenantId, studentId, admissionNo) => {
  const results = await AssignmentResult.find({ tenantId, admissionNo, isdeleted: false, status: 'completed' }, { obtainedMarks: 1, totalMarks: 1, cgpa: 1, numberOfReattempts: 1 }).lean();
  let totalAttempts = 0;
  let totalSecured = 0;
  let totalMax = 0;
  let totalCgpa = 0;
  let recordCount = 0;
  for (const res of results || []) {
    totalAttempts += toNum(res.numberOfReattempts) || 1;
    totalSecured += toNum(res.obtainedMarks);
    totalMax += toNum(res.totalMarks);
    if (res.cgpa != null) {
      totalCgpa += toNum(res.cgpa);
      recordCount++;
    }
  }
  const avgCgpa = recordCount > 0 ? Math.round((totalCgpa / recordCount) * 100) / 100 : null;
  return {
    cgpa: avgCgpa,
    attempts: totalAttempts,
    marksSecured: recordCount > 0 ? totalSecured : null,
    marksTotal: recordCount > 0 ? totalMax : null,
    overridden: false,
    lastSyncedAt: Date.now()
  };
};

const getStudentPerformance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    if (!academicYear) return res.status(400).json({ status: false, message: 'academicYear is required' });
    const profile = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false }, { admissionNo: 1, batchId: 1, programId: 1, centerId: 1, cgpa: 1 }).lean();
    if (!profile) return res.status(404).json({ status: false, message: 'Student not found' });
    let record = await StudentPerformance.findOne({ tenantId, studentId, academicYear, isdeleted: false }).lean();
    if (!record) {
      const assignment = await pullAssignmentData(tenantId, studentId, profile.admissionNo);
      const combinedScore = computeCombinedScore(assignment, { mock: null, school: null });
      record = await StudentPerformance.create({
        tenantId,
        performanceId: uuid(),
        studentId,
        admissionNo: profile.admissionNo || null,
        batchId: profile.batchId || null,
        academicYear,
        programId: profile.programId || null,
        centerId: profile.centerId || null,
        assignment,
        examMarks: { mock: null, school: null },
        staffFeedback: [],
        combinedScore,
        isdeleted: false
      });
    }
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data: record
    });
  } catch (err) {
    return next(err);
  }
};

const recalcStudentPerformance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    if (!academicYear) return res.status(400).json({ status: false, message: 'academicYear is required' });
    const profile = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false }, { admissionNo: 1 }).lean();
    if (!profile) return res.status(404).json({ status: false, message: 'Student not found' });
    const existing = await StudentPerformance.findOne({ tenantId, studentId, academicYear, isdeleted: false }).lean();
    if (!existing) return res.status(404).json({ status: false, message: 'Performance record not found. Call getStudentPerformance first.' });
    if (existing.assignment?.overridden) {
      return res.status(200).json({
        status: true,
        message: 'Assignment data was manually overridden. Recalc skipped for assignment. Use overrideAssignmentPerf to update.',
        data: existing
      });
    }
    const assignment = await pullAssignmentData(tenantId, studentId, profile.admissionNo);
    const combinedScore = computeCombinedScore(assignment, existing.examMarks);
    const updated = await StudentPerformance.findOneAndUpdate({ tenantId, studentId, academicYear, isdeleted: false }, { $set: { assignment, combinedScore } }, { new: true }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Performance recalculated from source data',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const overrideAssignmentPerf = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const studentId = safeTrim(req.body?.studentId);
    const academicYear = safeTrim(req.body?.academicYear);
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    if (!academicYear) return res.status(400).json({ status: false, message: 'academicYear is required' });
    const existing = await StudentPerformance.findOne({ tenantId, studentId, academicYear, isdeleted: false }).lean();
    if (!existing) return res.status(404).json({ status: false, message: 'Performance record not found. Call getStudentPerformance first.' });
    const payload = req.body || {};
    const assignment = {
      cgpa: payload.cgpa !== undefined ? toNum(payload.cgpa) : existing.assignment?.cgpa,
      attempts: payload.attempts !== undefined ? toNum(payload.attempts) : existing.assignment?.attempts,
      marksSecured: payload.marksSecured !== undefined ? toNum(payload.marksSecured) : existing.assignment?.marksSecured,
      marksTotal: payload.marksTotal !== undefined ? toNum(payload.marksTotal) : existing.assignment?.marksTotal,
      overridden: true,
      lastSyncedAt: existing.assignment?.lastSyncedAt || null
    };
    const combinedScore = computeCombinedScore(assignment, existing.examMarks);
    const updated = await StudentPerformance.findOneAndUpdate({ tenantId, studentId, academicYear, isdeleted: false }, { $set: { assignment, combinedScore } }, { new: true }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Assignment performance overridden',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const addStudentFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const studentId = safeTrim(payload.studentId);
    const academicYear = safeTrim(payload.academicYear);
    const staffId = safeTrim(payload.staffId);
    const remarks = safeTrim(payload.remarks) || null;
    if (!studentId) return res.status(400).json({ status: false, message: 'studentId is required' });
    if (!academicYear) return res.status(400).json({ status: false, message: 'academicYear is required' });
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    if (!remarks) return res.status(400).json({ status: false, message: 'remarks is required' });
    const existing = await StudentPerformance.findOne({ tenantId, studentId, academicYear, isdeleted: false }).lean();
    if (!existing) return res.status(404).json({ status: false, message: 'Performance record not found. Call getStudentPerformance first.' });
    const staff = await Staff.findOne({ tenantId, staffId, isdeleted: false }, { staffName: 1 }).lean();
    const entry = {
      feedbackId: uuid(),
      staffId,
      staffName: staff?.staffName || null,
      remarks,
      addedAt: Date.now()
    };
    const updated = await StudentPerformance.findOneAndUpdate({ tenantId, studentId, academicYear, isdeleted: false }, { $push: { staffFeedback: entry } }, { new: true }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Student feedback added',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const deleteStudentFeedback = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const performanceId = safeTrim(req.body?.performanceId);
    const feedbackId = safeTrim(req.body?.feedbackId);
    if (!performanceId) return res.status(400).json({ status: false, message: 'performanceId is required' });
    if (!feedbackId) return res.status(400).json({ status: false, message: 'feedbackId is required' });
    const updated = await StudentPerformance.findOneAndUpdate({ tenantId, performanceId, isdeleted: false }, { $pull: { staffFeedback: { feedbackId } } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Performance record not found' });
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Feedback entry removed',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

const getBatchPerformance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const payload = req.body || {};
    const batchId = safeTrim(payload.batchId);
    const academicYear = safeTrim(payload.academicYear);
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    if (!academicYear) return res.status(400).json({ status: false, message: 'academicYear is required' });
    const page = Math.max(toInt(payload.page, 1), 1);
    const limit = Math.min(Math.max(toInt(payload.limit, 20), 1), 200);
    const skip = (page - 1) * limit;
    const [students, count] = await Promise.all([
      StudentProfile.find({ tenantId, batchId, isdeleted: false, status: 'ACTIVE' }, { studentId: 1, admissionNo: 1, cgpa: 1, 'student.name': 1 }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      StudentProfile.countDocuments({ tenantId, batchId, isdeleted: false, status: 'ACTIVE' })
    ]);
    if (!students.length) {
      return res.status(constants.HTTPS_SUCCESS).json({ status: true, message: 'No students in batch', data: [], count: 0 });
    }
    const studentIds = students.map((s) => s.studentId);
    const perfRecords = await StudentPerformance.find({ tenantId, studentId: { $in: studentIds }, academicYear, isdeleted: false }).lean();
    const perfMap = new Map((perfRecords || []).map((p) => [p.studentId, p]));
    const data = students.map((s) => ({
      studentId: s.studentId,
      admissionNo: s.admissionNo,
      studentName: s.student?.name || null,
      performance: perfMap.get(s.studentId) || null
    }));
    const withRecords = perfRecords.filter((p) => p.assignment?.cgpa != null);
    const avgCgpa = withRecords.length ? withRecords.reduce((sum, p) => sum + (p.assignment?.cgpa || 0), 0) / withRecords.length : null;
    const avgCombined = perfRecords.filter((p) => p.combinedScore != null);
    const avgCombinedScore = avgCombined.length ? avgCombined.reduce((sum, p) => sum + (p.combinedScore || 0), 0) / avgCombined.length : null;
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Request success',
      data,
      count,
      batchSummary: {
        batchId,
        academicYear,
        totalStudents: count,
        studentsWithPerf: perfRecords.length,
        avgCgpa: avgCgpa !== null ? Math.round(avgCgpa * 100) / 100 : null,
        avgCombinedScore: avgCombinedScore !== null ? Math.round(avgCombinedScore * 100) / 100 : null
      }
    });
  } catch (err) {
    return next(err);
  }
};

const updateExamMarks = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const { studentId, academicYear, mockMarks, schoolMarks } = req.body;
    if (!studentId || !academicYear) {
      return res.status(400).json({ status: false, message: 'studentId and academicYear are required' });
    }
    const existing = await StudentPerformance.findOne({ tenantId, studentId, academicYear, isdeleted: false }).lean();
    if (!existing) {
      return res.status(404).json({ status: false, message: 'Performance record not found. Call getStudentPerformance first.' });
    }
    const examMarks = {
      mock: mockMarks !== undefined ? mockMarks : existing.examMarks?.mock,
      school: schoolMarks !== undefined ? schoolMarks : existing.examMarks?.school
    };
    const combinedScore = computeCombinedScore(existing.assignment, examMarks);
    const updated = await StudentPerformance.findOneAndUpdate({ tenantId, studentId, academicYear, isdeleted: false }, { $set: { examMarks, combinedScore } }, { new: true }).lean();
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Exam marks updated successfully',
      data: updated
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  addStaffFeedback,
  listStaffFeedback,
  updateStaffFeedback,
  deleteStaffFeedback,
  listAllStaffPerf,
  getStudentPerformance,
  recalcStudentPerformance,
  overrideAssignmentPerf,
  addStudentFeedback,
  deleteStudentFeedback,
  getBatchPerformance
};
