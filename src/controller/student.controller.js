import mongoose from 'mongoose';
import path from 'path';
import crypto from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3Client from '../middlewares/s3config.js';
import constants from '../helpers/constants.js';
import StudentProfile from '../models/studentProfile.model.js';
import Admission from '../models/admission.model.js';
import Batch from '../models/batch.model.js';
import Payment from '../models/admissionpayments.model.js';
import Program from '../models/program.model.js';
import Subject from '../models/subject.model.js';
import Assignment from '../models/assignment.model.js';
import AssignmentQns from '../models/assingmentQns.model.js';
import ExamCategory from '../models/examcategory.model.js';
import ExamSubCategory from '../models/examsubcategory.model.js';
import Topic from '../models/topic.model.js';
import SubTopic from '../models/subtopic.model.js';
import BatchAssignEnable from '../models/batchenabledAssignment.model.js';
import AssignmentResult from '../models/assignmentResult.model.js';
import Phase from '../models/phaseplan.model.js';
import Staff from '../models/staff.model.js';
import TimeTable from '../models/timetable.model.js';
import Attendance from '../models/attandence.model.js';
import StudyMaterial from '../models/studymaterial.model.js';
import SchoolExam from '../models/schoolexam.model.js';
import SchoolExamResult from '../models/schoolexamresult.model.js';
import StudentRemark from '../models/studentremark.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import FeedbackForm from '../models/feedbackForm.model.js';
import FeedbackResponse from '../models/feedbackResponse.model.js';

const QUESTION_BUCKET = process.env.AWS_S3_QUESTION_BUCKET;
const REGION = process.env.AWS_REGION || 'ap-south-1';

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

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const getPreviousMonday = (dateMs) => {
  const d = new Date(dateMs);
  const utcDay = d.getUTCDay(); // 0=Sun
  const diffDays = utcDay === 0 ? -6 : 1 - utcDay;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffDays);
};

const getEffectivePeriods = (tt, dateMs) => {
  if (!tt || !Array.isArray(tt.week)) return [];
  const targetMs = Number(dateMs);
  if (isNaN(targetMs)) return [];
  const targetDate = new Date(targetMs);
  const utcDay = targetDate.getUTCDay();
  const dayStr = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][utcDay];
  const targetUTCMidnight = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
  const matchesDate = (oDateMs) => {
    const od = new Date(Number(oDateMs));
    const ovUTC = Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), od.getUTCDate());
    return ovUTC === targetUTCMidnight;
  };
  const baseDay = (tt.week || []).find((w) => String(w.day).toUpperCase() === dayStr);
  let periods = baseDay && Array.isArray(baseDay.periods) ? JSON.parse(JSON.stringify(baseDay.periods)) : [];
  const dayOvs = Array.isArray(tt.dayOverrides) ? tt.dayOverrides : [];
  for (const ov of dayOvs) {
    if (!matchesDate(ov.date)) continue;
    if (ov.action === 'CANCEL_DAY') return [];
    if (ov.action === 'REPLACE_DAY' && Array.isArray(ov.periods)) {
      periods = JSON.parse(JSON.stringify(ov.periods));
    }
  }
  const baseMap = new Map();
  periods.forEach((p) => {
    if (p.periodNo != null) baseMap.set(Number(p.periodNo), p);
  });
  const periodOvs = (Array.isArray(tt.periodOverrides) ? tt.periodOverrides : []).filter((o) => matchesDate(o.date));
  // Pass 1: CANCEL, REPLACE, ADD
  for (const ov of periodOvs) {
    const fromNo = Number(ov.periodNo);
    if (!fromNo) continue;
    if (ov.action === 'CANCEL_PERIOD') baseMap.delete(fromNo);
    if (ov.action === 'REPLACE_PERIOD' && ov.period) baseMap.set(fromNo, { ...ov.period, periodNo: fromNo });
    if (ov.action === 'ADD_PERIOD' && ov.period) baseMap.set(fromNo, { ...ov.period, periodNo: fromNo });
  }
  // Pass 2: MOVE — snapshot after pass 1, process pairs once only
  const moves = periodOvs.filter((o) => o.action === 'MOVE_PERIOD');
  if (moves.length) {
    const snapshot = new Map(baseMap);
    const appliedMoves = new Set();
    for (const ov of moves) {
      const fromNo = Number(ov.periodNo);
      const toNo = Number(ov.toPeriodNo);
      if (!fromNo || !toNo || fromNo === toNo) continue;
      const pairKey = `${Math.min(fromNo, toNo)}-${Math.max(fromNo, toNo)}`;
      if (appliedMoves.has(pairKey)) continue;
      appliedMoves.add(pairKey);
      const fromPeriod = snapshot.get(fromNo);
      const toPeriod = snapshot.get(toNo);
      const fromTime = fromPeriod?.time;
      const toTime = toPeriod?.time;
      if (fromPeriod) baseMap.set(toNo, { ...fromPeriod, periodNo: toNo, time: toTime ?? fromPeriod.time });
      else baseMap.delete(toNo);
      if (toPeriod) baseMap.set(fromNo, { ...toPeriod, periodNo: fromNo, time: fromTime ?? toPeriod.time });
      else baseMap.delete(fromNo);
    }
  }
  return Array.from(baseMap.values()).sort((a, b) => (a.periodNo || 0) - (b.periodNo || 0));
};

const listStudents = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const q = req.query || {};
    const search = safeTrim(q.search);
    const programId = safeTrim(q.programId);
    const batchId = safeTrim(q.batchId);
    const batchCode = safeTrim(q.batchCode);
    const centerId = safeTrim(q.centerId);
    const academicYear = safeTrim(q.academicYear);
    const status = safeTrim(q.status);
    const query = { tenantId, isdeleted: false };
    if (programId) query.programId = programId;
    if (batchId) query.batchId = batchId;
    if (batchCode) query.batchCode = batchCode;
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

const studentLogin = async (req, res, next) => {
  try {
    console.log('method called');
    const regNo = safeTrim(req.body?.regNo);
    if (!regNo) {
      return res.status(constants.HTTPS_BAD_REQUEST).json({ status: false, message: 'regNo (admissionNo or registrationNumber) is required' });
    }
    const student = await StudentProfile.findOne({
      $or: [{ admissionNo: regNo }, { registrationNumber: regNo }, { portalStudentId: regNo }],
      isdeleted: false,
      status: 'ACTIVE'
    }).lean();
    if (!student) {
      return res.status(constants.HTTPS_NOT_FOUND).json({ status: false, message: 'Student not found' });
    }
    const ayHistoryList = Array.isArray(student.ayHistory) ? student.ayHistory.sort((a, b) => Number(b.changedOn) - Number(a.changedOn)) : [];
    const response = {
      tenantId: student.tenantId,
      studentId: student.studentId,
      admissionId: student.admissionId,
      admissionNo: student.admissionNo,
      registrationNumber: student.registrationNumber,
      portalStudentId: student.portalStudentId,
      name: student.student?.name,
      phone: student.student?.phone,
      email: student.student?.email,
      parentName: student.student?.parentName,
      parentPhone: student.student?.parentPhone,
      programId: student.programId,
      programName: student.programName,
      programCode: student.programCode,
      centerId: student.centerId,
      centerName: student.centerName,
      centerCode: student.centerCode,
      batchId: student.batchId,
      batchCode: student.batchCode,
      academicYear: student.academicYear,
      currentAcademicYear: student.currentAcademicYear,
      yearNo: student.yearNo,
      classNo: student.classNo,
      ayHistory: ayHistoryList,
      status: student.status
    };
    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Student login successful',
      data: response
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentSubjects = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    }
    const regNo = safeTrim(req.body?.regNo);
    if (!regNo) {
      return res.status(400).json({ status: false, message: 'regNo (admissionNo or registrationNumber) is required' });
    }

    const student = await StudentProfile.findOne({
      tenantId,
      isdeleted: false,
      status: 'ACTIVE',
      $or: [{ admissionNo: regNo }, { registrationNumber: regNo }, { portalStudentId: regNo }]
    }).lean();
    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });

    const programId = student.programId;
    if (!programId) return res.status(400).json({ status: false, message: 'Student program not found' });

    const program = await Program.findOne({ tenantId, programId, isdeleted: false }).lean();
    if (!program) return res.status(404).json({ status: false, message: 'Program not found' });

    // ── Extract unique subjectIds from examMappings ────────────────────────
    const examMappings = Array.isArray(program.examMappings) ? program.examMappings : [];

    // Collect all subjectIds across all mapping entries, deduplicate by string key
    const subjectIdMap = new Map(); // key: string(_id) → ObjectId
    for (const mapping of examMappings) {
      const subIds = Array.isArray(mapping.subjectIds) ? mapping.subjectIds : [];
      for (const sid of subIds) {
        const key = String(sid);
        if (!subjectIdMap.has(key)) {
          subjectIdMap.set(key, sid);
        }
      }
    }

    // If no examMappings have subjectIds at all, fall back to program.subjects
    // so the API doesn't silently return empty
    let subjectObjectIds;
    if (subjectIdMap.size > 0) {
      subjectObjectIds = Array.from(subjectIdMap.values());
    } else {
      // fallback — some programs may not have subjectIds scoped on examMappings
      subjectObjectIds = Array.isArray(program.subjects) ? program.subjects : [];
    }

    if (!subjectObjectIds.length) {
      return res.status(constants.HTTPS_SUCCESS).json({
        status: true,
        message: 'No subjects configured for this program',
        data: {
          student: {
            studentId: student.studentId,
            name: student.student.name,
            classNo: student.classNo,
            currentAcademicYear: student.currentAcademicYear
          },
          program: {
            programId: program.programId,
            programName: program.programName
          },
          subjects: []
        }
      });
    }

    // ── Fetch subject documents ───────────────────────────────────────────
    const subjects = await Subject.find({
      tenantId,
      _id: { $in: subjectObjectIds },
      isdeleted: false
    }).lean();

    // ── Enrich with classNo from student ─────────────────────────────────
    const enriched = subjects.map((sub) => ({
      subjectId: sub._id,
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode || null,
      classNo: student.classNo,
      sortOrder: sub.sortOrder || 0
    }));

    enriched.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));

    return res.status(constants.HTTPS_SUCCESS).json({
      status: true,
      message: 'Subjects loaded successfully',
      data: {
        student: {
          studentId: student.studentId,
          name: student.student.name,
          classNo: student.classNo,
          currentAcademicYear: student.currentAcademicYear
        },
        program: {
          programId: program.programId,
          programName: program.programName
        },
        subjects: enriched
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getAllClassSubjectTopics = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId);
    const regNo = safeTrim(req.body?.regNo);
    const classNo = toNum(req.body?.classNo);
    const subjectRaw = safeTrim(req.body?.subjectId);
    if (!tenantId || !regNo || !classNo || !subjectRaw) {
      return res.status(400).json({
        status: false,
        message: 'entiId, regNo, classNo and subjectId are required'
      });
    }
    // ── Resolve subject ───────────────────────────────────────────────────────
    const subQ = { tenantId, isdeleted: false, $or: [] };
    if (mongoose.Types.ObjectId.isValid(subjectRaw)) subQ.$or.push({ _id: new mongoose.Types.ObjectId(subjectRaw) });
    subQ.$or.push({ subjectId: subjectRaw });
    subQ.$or.push({ subjectName: subjectRaw });
    const subjectDoc = await Subject.findOne(subQ, {
      _id: 1,
      subjectId: 1,
      subjectName: 1
    }).lean();
    if (!subjectDoc) return res.status(404).json({ status: false, message: 'Subject not found' });
    const subjectIdStr = safeTrim(subjectDoc.subjectId || String(subjectDoc._id));
    const subjectObjectId = mongoose.Types.ObjectId.isValid(String(subjectDoc._id)) ? new mongoose.Types.ObjectId(String(subjectDoc._id)) : null;
    // ── Resolve student ───────────────────────────────────────────────────────
    const student = await StudentProfile.findOne({
      tenantId,
      isdeleted: false,
      status: 'ACTIVE',
      $or: [{ admissionNo: regNo }, { registrationNumber: regNo }, { portalStudentId: regNo }]
    }).lean();
    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });
    // const programId = safeTrim(student.programId);
    // if (!programId) return res.status(400).json({ status: false, message: 'Student program not found' });
    const ayEntry = (Array.isArray(student.ayHistory) ? student.ayHistory : []).find((h) => Number(h?.classNo) === Number(classNo));
    const programId = safeTrim(ayEntry?.programId || student.programId);
    if (!programId) return res.status(400).json({ status: false, message: 'Student program not found' });
    // ── Resolve program ───────────────────────────────────────────────────────
    const program = await Program.findOne({ tenantId, programId, isdeleted: false }).lean();
    if (!program) return res.status(404).json({ status: false, message: 'Program not found' });
    const batchId = safeTrim(req.body?.batchId) || safeTrim(student?.batchId);
    const admissionNo = safeTrim(student.admissionNo || regNo);
    const studentId = safeTrim(student.studentId || String(student._id));
    // ── Filter examMappings by subjectId ──────────────────────────────────────
    const examMappings = (Array.isArray(program.examMappings) ? program.examMappings : [])
      .filter((m) => {
        if (!Array.isArray(m?.subjectIds) || !m.subjectIds.length) return true;
        return m.subjectIds.some((x) => String(x) === subjectIdStr || String(x) === String(subjectDoc._id));
      })
      .map((m) => ({
        categoryId: safeTrim(m?.categoryId),
        subCategoryId: safeTrim(m?.subCategoryId),
        sortOrder: Number.isFinite(Number(m?.sortOrder)) ? Number(m.sortOrder) : 0
      }))
      .filter((m) => m.categoryId && m.subCategoryId)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    // ── Early return if no mappings ───────────────────────────────────────────
    if (!examMappings.length) {
      return res.json({
        status: true,
        message: 'No exam mappings configured for this program/subject',
        data: {
          student: {
            regNo,
            classNo,
            studentName: student?.student?.name || null,
            batchId: batchId || null
          },
          subjectId: subjectIdStr,
          subjectName: subjectDoc.subjectName || subjectRaw,
          program: {
            programId: program.programId,
            programName: program.programName
          },
          subtopicsByTopics: {}
        }
      });
    }
    // ── Fetch exam category / sub-category labels ─────────────────────────────
    const categoryIds = Array.from(new Set(examMappings.map((x) => x.categoryId)));
    const subCategoryIds = Array.from(new Set(examMappings.map((x) => x.subCategoryId)));
    const [categories, subCategories] = await Promise.all([ExamCategory.find({ tenantId, categoryId: { $in: categoryIds }, isdeleted: false }).lean(), ExamSubCategory.find({ tenantId, subCategoryId: { $in: subCategoryIds }, isdeleted: false }).lean()]);
    const catNameById = new Map((categories || []).map((c) => [safeTrim(c.categoryId), c.categoryName || c.name || safeTrim(c.categoryId)]));
    const subCatNameById = new Map((subCategories || []).map((s) => [safeTrim(s.subCategoryId), s.subCategoryName || s.name || safeTrim(s.subCategoryId)]));
    // ── Fetch topics, phases, subtopics in parallel ───────────────────────────
    const [topics, phases, subtopics] = await Promise.all([
      Topic.find({ tenantId, classNo, subjectId: subjectIdStr, isdeleted: false }).sort({ sortOrder: 1 }).lean(),
      Phase.find({ tenantId, classNo, subjectId: subjectIdStr, isdeleted: false }).lean(),
      SubTopic.find({ tenantId, classNo, subjectId: subjectIdStr, isdeleted: false }).sort({ sortOrder: 1 }).lean()
    ]);
    const topicIds = topics.map((t) => safeTrim(t.topicId || t._id)).filter(Boolean);
    const subTopicIds = subtopics.map((st) => safeTrim(st.subTopicId || st._id)).filter(Boolean);
    // ── Phase lookup by topicId ───────────────────────────────────────────────
    const phaseByTopicId = new Map();
    for (const ph of phases) {
      for (const pt of ph.topics || []) {
        phaseByTopicId.set(safeTrim(pt.topicId), {
          phaseId: ph.phaseId,
          phaseName: ph.phaseName,
          phaseSortOrder: ph.sortOrder,
          estHours: pt.estHours || null
        });
      }
    }
    // ── Fetch assignments ─────────────────────────────────────────────────────
    const assignments = await Assignment.find({
      tenantId,
      classNo,
      subjectId: subjectIdStr,
      isdeleted: false,
      status: { $in: ['active', 'ACTIVE'] },
      categoryId: { $in: categoryIds },
      subCategoryId: { $in: subCategoryIds },
      topicId: { $in: topicIds },
      subTopicId: { $in: subTopicIds }
    })
      .sort({ createdAt: 1 })
      .lean();
    // key: categoryId||subCategoryId||subTopicId → assignments[]
    const assignsByKey = new Map();
    for (const a of assignments) {
      const key = `${safeTrim(a.categoryId)}||${safeTrim(a.subCategoryId)}||${safeTrim(a.subTopicId)}`;
      const arr = assignsByKey.get(key) || [];
      arr.push({
        assignmentId: a._id,
        testId: safeTrim(a.testId || ''),
        testNo: a.testNo ?? null,
        testCode: a.testCode || null,
        numberOfQuestions: a.numberOfQuestions ?? null,
        status: a.status || null
      });
      assignsByKey.set(key, arr);
    }
    // ── Enabled test map ──────────────────────────────────────────────────────
    const enabledTestMap = new Map();

    if (batchId) {
      const enabledRows = await BatchAssignEnable.find(
        {
          tenantId,
          batchId,
          subjectId: subjectIdStr,
          isdeleted: false,
          status: 'enabled'
        },
        {
          testId: 1,
          testNo: 1,
          enabledAt: 1,
          students: { $elemMatch: { admissionNo } }
        }
      ).lean();

      const now = Date.now();
      const cgpaFromProfile = student?.cgpa === null || student?.cgpa === undefined ? null : toNum(student.cgpa);
      const backfillOps = [];

      for (const r of enabledRows || []) {
        const tid = safeTrim(r?.testId);
        if (!tid) continue;

        const stuLog = Array.isArray(r?.students) && r.students.length ? r.students[0] : null;

        if (!stuLog) {
          backfillOps.push({
            updateOne: {
              filter: {
                tenantId,
                batchId,
                subjectId: subjectIdStr,
                testId: tid,
                isdeleted: false,
                status: 'enabled',
                students: { $not: { $elemMatch: { admissionNo } } }
              },
              update: {
                $push: {
                  students: {
                    studentId: studentId || null,
                    admissionNo,
                    cgpa: cgpaFromProfile,
                    status: 'ASSIGNED',
                    assignedAt: now,
                    startedAt: null,
                    completedAt: null,
                    attempts: 0
                  }
                }
              }
            }
          });
          enabledTestMap.set(tid, {
            testId: tid,
            testNo: r?.testNo ?? null,
            studentStatus: 'ASSIGNED',
            studentCgpa: null
          });
        } else {
          const st = safeTrim(stuLog?.status) || 'ASSIGNED';
          enabledTestMap.set(tid, {
            testId: tid,
            testNo: r?.testNo ?? null,
            studentStatus: st,
            studentCgpa: st === 'COMPLETED' ? (stuLog?.cgpa === null || stuLog?.cgpa === undefined ? null : toNum(stuLog.cgpa)) : null
          });
        }
      }

      if (backfillOps.length) {
        try {
          await BatchAssignEnable.bulkWrite(backfillOps, { ordered: false });
        } catch (e) {
          console.error('[getAllClassSubjectTopics] backfill bulkWrite failed:', e?.message);
        }
      }
    }

    // ── Completed tests ───────────────────────────────────────────────────────
    const completedTestSet = new Set();
    if (batchId) {
      const doneRows = await AssignmentResult.find(
        {
          tenantId,
          isdeleted: false,
          admissionNo,
          batchId,
          classNo,
          subjectId: subjectObjectId || subjectIdStr
        },
        { testId: 1 }
      )
        .lean()
        .catch((e) => {
          console.error('[getAllClassSubjectTopics] AssignmentResult query failed:', e?.message);
          return [];
        });

      for (const d of doneRows || []) {
        const tid = safeTrim(d?.testId);
        if (tid) completedTestSet.add(tid);
      }
    }

    // ── Build subtopicsByTopics — object keyed by topicName ───────────────────
    // ✅ matches exact response format: { "TopicName": [ ...flat subtopic rows ] }
    const subtopicsByTopics = {};

    for (const t of topics) {
      const tId = safeTrim(t.topicId || t._id);
      const topicName = t.topicName || t.name || 'TOPIC';
      const topicSortOrder = t.sortOrder ?? 0;
      const assignedPhase = phaseByTopicId.get(tId) || null;

      const sts = subtopics.filter((st) => safeTrim(st.topicId) === tId).sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0));

      if (!sts.length) continue;

      // ✅ key by topicName exactly as original — but use topicId as tiebreaker
      //    to handle duplicate names safely
      const topicKey =
        subtopicsByTopics[topicName] !== undefined
          ? `${topicName}_${tId}` // collision fallback
          : topicName;

      if (!subtopicsByTopics[topicKey]) subtopicsByTopics[topicKey] = [];

      for (const st of sts) {
        const stId = safeTrim(st.subTopicId || st._id);
        const stName = st.subTopicName;
        const stSortOrder = st.sortOrder ?? 0;
        const test = [];

        for (const mapRow of examMappings) {
          const { categoryId: catId, subCategoryId: subCatId } = mapRow;
          const examCategory = catNameById.get(catId) || catId;
          const examSubCategory = subCatNameById.get(subCatId) || subCatId;
          const key = `${catId}||${subCatId}||${stId}`;
          const assigns = assignsByKey.get(key) || [];

          if (!assigns.length) {
            test.push({
              examCategory,
              examSubCategory,
              testNo: null,
              testId: null,
              isEnabled: false,
              status: 'NOT_ASSIGNED',
              cgpa: null,
              sortOrder: mapRow.sortOrder
            });
            continue;
          }

          for (const a of assigns) {
            const rawTestId = safeTrim(a.testId || '');
            let isEnabled = false;
            let status = 'NOT_ASSIGNED';
            let cgpa = null;

            if (rawTestId && enabledTestMap.has(rawTestId)) {
              isEnabled = true;
              if (completedTestSet.has(rawTestId)) {
                status = 'COMPLETED';
                cgpa = enabledTestMap.get(rawTestId)?.studentCgpa ?? null;
              } else {
                status = 'ASSIGNED';
              }
            }

            test.push({
              examCategory,
              examSubCategory,
              testNo: isEnabled ? (a.testNo ?? null) : null,
              testId: isEnabled ? a.testId || null : null,
              isEnabled,
              status,
              cgpa,
              sortOrder: mapRow.sortOrder
            });
          }
        }

        test.sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));

        // ✅ flat object per subtopic — matches original response shape exactly
        subtopicsByTopics[topicKey].push({
          topicId: tId,
          topicName,
          topicSortOrder,
          subtopicId: stId,
          subtopicName: stName,
          subtopicSortOrder: stSortOrder,
          phases: assignedPhase ? assignedPhase.phaseName : null,
          test
        });
      }

      subtopicsByTopics[topicKey].sort((a, b) => Number(a.subtopicSortOrder) - Number(b.subtopicSortOrder));
    }

    return res.json({
      status: true,
      message: 'Class-subject topics loaded',
      data: {
        student: {
          regNo,
          classNo,
          studentName: student?.student?.name || null,
          batchId: batchId || null
        },
        subjectId: subjectIdStr,
        subjectName: subjectDoc.subjectName || subjectRaw,
        program: {
          programId: program.programId,
          programName: program.programName
        },
        subtopicsByTopics
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentTopicsTests = async (req, res, next) => {
  try {
    console.log('download method');
    const tenantId = String(req.body?.entiId || '').trim();
    const regNo = String(req.body?.regNo || '').trim();
    const subjectRaw = String(req.body?.subjectId || '').trim();
    const subject = subjectRaw.toUpperCase();
    const classNo = Number(req.body?.classNo || 0);
    const testIdRaw = String(req.body?.testId || '').trim();
    const testNoRaw = String(req.body?.testNo || '').trim();
    if (!tenantId || !regNo || !subject || !classNo) {
      return res.status(400).json({
        status: false,
        message: 'entiId, regNo, subjectId, classNo required'
      });
    }
    if (!testIdRaw && !testNoRaw) {
      return res.status(400).json({
        status: false,
        message: 'testId or testNo required'
      });
    }
    const subjectDoc = await Subject.findOne({ subjectName: subject }, { _id: 1, subjectId: 1, subjectName: 1 }).lean();
    if (!subjectDoc) {
      return res.status(404).json({ status: false, message: 'Subject not found' });
    }
    const asgQ = {
      tenantId,
      isdeleted: false,
      status: { $in: ['active', 'ACTIVE'] },
      classNo,
      subjectId: subjectDoc._id,
      $or: []
    };
    if (testIdRaw) asgQ.$or.push({ testId: testIdRaw });
    if (testNoRaw) asgQ.$or.push({ testNo: testNoRaw });
    const assignment = await Assignment.findOne(asgQ, {
      _id: 1,
      testId: 1,
      testNo: 1
    }).lean();
    if (!assignment) {
      return res.status(404).json({
        status: false,
        message: 'Assignment not found for given testId/testNo'
      });
    }
    const testId = String(assignment.testId || '').trim();
    const testNo = assignment.testNo ?? null;
    if (!testId) {
      return res.status(400).json({
        status: false,
        message: 'Assignment testId missing'
      });
    }
    const qDocs = await AssignmentQns.find(
      {
        tenantId,
        isdeleted: false,
        testId: testId
      },
      {}
    )
      .sort({ sortOrder: 1 })
      .lean();
    return res.status(200).json({
      status: true,
      data: {
        testId,
        testNo,
        questions: qDocs
      }
    });
  } catch (err) {
    next(err);
  }
};

const getStudentTimetable = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
    const now = new Date();
    const targetDateMs = req.body?.date !== undefined && req.body?.date !== null && Number.isFinite(Number(req.body.date)) ? Number(req.body.date) : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (!tenantId || !identifier) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }
    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
    }).lean();

    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }
    const mondayMs = getPreviousMonday(targetDateMs);
    const timetableDoc = await TimeTable.findOne({
      tenantId,
      batchCode: student.batchCode,
      isdeleted: false,
      status: 'Active',
      wkStartOn: { $lte: mondayMs }
    })
      .sort({ wkStartOn: -1 })
      .lean();
    if (!timetableDoc) {
      return res.status(200).json({
        status: true,
        message: 'No timetable found for this week',
        data: { date: targetDateMs, batchCode: student.batchCode, wkStartOn: mondayMs, periods: [] }
      });
    }
    const todaysPeriods = getEffectivePeriods(timetableDoc, targetDateMs);
    const facultyIds = [...new Set(todaysPeriods.map((p) => safeTrim(p.replacementFacultyId || p.facultyId)).filter(Boolean))];
    const staffList = facultyIds.length ? await Staff.find({ tenantId, staffId: { $in: facultyIds }, isdeleted: false }, { staffId: 1, staffName: 1, staffCode: 1 }).lean() : [];
    const staffById = Object.fromEntries(staffList.map((s) => [s.staffId, s]));
    const enrichedPeriods = todaysPeriods.map((p) => {
      const activeFacultyId = safeTrim(p.replacementFacultyId || p.facultyId);
      const staff = staffById[activeFacultyId] || null;
      return {
        ...p,
        staffCode: staff?.staffCode || null,
        facultyName: staff?.staffName || p.facultyName || null
      };
    });
    return res.status(200).json({
      status: true,
      message: 'Timetable retrieved successfully',
      data: {
        date: targetDateMs,
        batchCode: student.batchCode,
        timetableId: timetableDoc._id,
        timetableStatus: timetableDoc.status,
        wkStartOn: mondayMs,
        periods: enrichedPeriods
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
    const now = new Date();
    const targetDate = req.body?.date ? toInt(req.body.date, 0) : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (!tenantId || !identifier || !req.body?.date) {
      return res.status(400).json({
        status: false,
        message: 'tenantId, studentNo/studentId, and date are required'
      });
    }
    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
    }).lean();
    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }
    const attendanceRecords = await Attendance.find({
      tenantId,
      batchCode: student.batchCode,
      date: targetDate,
      isdeleted: false
    }).lean();
    const facultyIds = [...new Set(attendanceRecords.map((r) => r.facultyId).filter(Boolean))];
    const staffList = facultyIds.length ? await Staff.find({ tenantId, staffId: { $in: facultyIds }, isdeleted: false }, { staffId: 1, staffName: 1, staffCode: 1, facultyType: 1 }).lean() : [];
    const staffById = Object.fromEntries(staffList.map((s) => [s.staffId, s]));
    const mondayMs = getPreviousMonday(targetDate);
    const tt = await TimeTable.findOne({
      tenantId,
      batchCode: student.batchCode,
      isdeleted: false,
      $or: [{ wkStartOn: mondayMs }, { status: 'Active', wkStartOn: { $lte: mondayMs } }]
    })
      .sort({ wkStartOn: -1 })
      .lean();
    const scheduledPeriods = tt ? getEffectivePeriods(tt, targetDate) : [];
    const attendanceByPeriod = Object.fromEntries(attendanceRecords.map((r) => [toInt(r.periodNo), r]));
    const studentAttendance = scheduledPeriods.map((period) => {
      const record = attendanceByPeriod[toInt(period.periodNo)];
      const studentData = record?.students?.find((s) => s.studentId === student.studentId);
      let status = 'NO_RECORD';
      if (record && studentData) status = studentData.status;
      else if (record && !studentData) status = 'NOT_MARKED';
      return {
        periodNo: period.periodNo,
        time: period.time || null,
        subjectId: record?.subjectId || period.subjectId || null,
        subjectName: period.subjectName || null,
        subjectCode: period.subjectCode || null,
        periodType: period.periodType || null,
        mode: period.mode || null,
        faculty: staffById[record?.facultyId] || staffById[period.facultyId] || null,
        updatedBy: record?.updatedBy || null,
        topicTaught: record?.topicTaught || null,
        status,
        remarks: studentData?.remarks || null,
        feedback: record?.feedback || null
      };
    });
    const scheduledPeriodNos = new Set(scheduledPeriods.map((p) => toInt(p.periodNo)));
    for (const record of attendanceRecords) {
      const pNo = toInt(record.periodNo);
      if (scheduledPeriodNos.has(pNo)) continue;
      const studentData = record.students?.find((s) => s.studentId === student.studentId);
      studentAttendance.push({
        periodNo: pNo,
        time: null,
        subjectId: record.subjectId || null,
        subjectName: null,
        subjectCode: null,
        periodType: null,
        mode: null,
        faculty: staffById[record.facultyId] || null,
        updatedBy: record.updatedBy || null,
        topicTaught: record.topicTaught || null,
        status: studentData ? studentData.status : 'NOT_MARKED',
        remarks: studentData?.remarks || null,
        feedback: record?.feedback || null
      });
    }
    studentAttendance.sort((a, b) => (a.periodNo || 0) - (b.periodNo || 0));
    return res.status(200).json({
      status: true,
      message: 'Attendance retrieved successfully',
      data: {
        date: targetDate,
        studentId: student.studentId,
        admissionNo: student.admissionNo,
        batchCode: student.batchCode,
        attendance: studentAttendance
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentProfileView = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
    if (!tenantId || !identifier) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }

    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
    }).lean();

    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }

    // Check if any active feedback form is assigned to this student's batch
    const batchCode = student.batchCode || null;
    let feedbackEnabled = false;
    let feedbackFormCount = 0;

    if (batchCode) {
      const now = Date.now();
      // Auto-update statuses before checking
      await Promise.all([FeedbackForm.updateMany({ tenantId, isdeleted: false, status: 'DRAFT', startDate: { $lte: now } }, { $set: { status: 'ACTIVE' } }), FeedbackForm.updateMany({ tenantId, isdeleted: false, status: 'ACTIVE', endDate: { $lt: now } }, { $set: { status: 'CLOSED' } })]);

      // Fetch all active forms for this batch
      const activeForms = await FeedbackForm.find(
        {
          tenantId,
          isdeleted: false,
          status: 'ACTIVE',
          assignedBatches: batchCode
        },
        { _id: 1, staffAssignments: 1 }
      ).lean();

      feedbackFormCount = activeForms.length;

      if (feedbackFormCount > 0) {
        const studentId = student.studentId;

        // Fetch all responses this student has already submitted
        const formIds = activeForms.map((f) => f._id);
        const submitted = await FeedbackResponse.find({ tenantId, formId: { $in: formIds }, studentId, isdeleted: false }, { formId: 1, staffId: 1 }).lean();

        // Group by formId -> set of rated staffIds
        const submittedMap = new Map();
        submitted.forEach((r) => {
          const fid = r.formId.toString();
          if (!submittedMap.has(fid)) submittedMap.set(fid, new Set());
          if (r.staffId) submittedMap.get(fid).add(r.staffId);
        });

        // feedbackEnabled = true only if at least one form has pending staff
        feedbackEnabled = activeForms.some((form) => {
          const staffList = form.staffAssignments || [];
          const ratedStaff = submittedMap.get(form._id.toString()) || new Set();
          // If no staff assignments, check if student submitted at all
          if (!staffList.length) return !submittedMap.has(form._id.toString());
          // Has pending staff not yet rated
          return staffList.some((s) => !ratedStaff.has(s.staffId));
        });
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Student profile retrieved successfully',
      data: {
        ...student,
        feedbackEnabled,
        feedbackFormCount
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentMaterialSubjects = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
    if (!tenantId || !identifier) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }
    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
    }).lean();
    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }
    const batchCode = safeTrim(student.batchCode);
    const batchId = safeTrim(student.batchId);
    const studentId = safeTrim(student.studentId);
    const now = Date.now();
    const materialQuery = {
      tenantId,
      status: 'Active',
      isdeleted: false,
      $and: [{ $or: [{ availableFrom: null }, { availableFrom: { $lte: now } }] }, { $or: [{ availableUntil: null }, { availableUntil: { $gte: now } }] }],
      $or: [{ batchIds: batchCode }, { studentIds: studentId }]
    };
    const materials = await StudyMaterial.find(materialQuery, { subjectId: 1 }).populate('subjectId', 'subjectName subjectCode').lean();
    const subjectMap = new Map();
    for (const mat of materials) {
      if (!mat.subjectId) continue;
      const subIdStr = String(mat.subjectId._id);
      if (!subjectMap.has(subIdStr)) {
        subjectMap.set(subIdStr, {
          subjectId: subIdStr,
          subjectName: mat.subjectId.subjectName,
          subjectCode: mat.subjectId.subjectCode,
          materialCount: 0
        });
      }
      subjectMap.get(subIdStr).materialCount++;
    }
    const subjects = Array.from(subjectMap.values());
    return res.status(200).json({
      status: true,
      message: 'Subjects with study materials retrieved successfully',
      data: {
        studentId: student.studentId,
        subjectsCount: subjects.length,
        subjects: subjects
      }
    });
  } catch (err) {
    console.log('err ', err);
    return next(err);
  }
};

const getStudentMaterials = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
    const subjectId = safeTrim(req.body?.subjectId);
    if (!tenantId || !identifier) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }
    if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ status: false, message: 'A valid subjectId is required' });
    }
    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
    }).lean();
    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }
    let batchCode = safeTrim(student.batchCode);
    let batchId = safeTrim(student.batchId);
    const studentId = safeTrim(student.studentId);
    const now = Date.now();
    const materialQuery = {
      tenantId,
      status: 'Active',
      isdeleted: false,
      subjectId: new mongoose.Types.ObjectId(subjectId),
      $and: [{ $or: [{ availableFrom: null }, { availableFrom: { $lte: now } }] }, { $or: [{ availableUntil: null }, { availableUntil: { $gte: now } }] }],
      $or: [{ batchIds: batchCode }, { studentIds: studentId }]
    };
    const materials = await StudyMaterial.find(materialQuery).sort({ createdAt: -1 }).populate('subjectId', 'subjectName subjectCode').lean();
    return res.status(200).json({
      status: true,
      message: 'Study materials retrieved successfully',
      data: {
        studentId: student.studentId,
        subjectId: subjectId,
        materialsCount: materials.length,
        materials: materials
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentAttendanceReport = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
    const fromDate = toInt(req.body?.fromDate, 0);
    const toDate = toInt(req.body?.toDate, Date.now());
    if (!tenantId || !identifier) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }
    if (fromDate && toDate && fromDate > toDate) {
      return res.status(400).json({ status: false, message: 'fromDate must be before or equal to toDate' });
    }
    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
    }).lean();
    if (!student) {
      return res.status(404).json({ status: false, message: 'Student profile not found' });
    }
    const matchQuery = {
      tenantId,
      batchCode: student.batchCode,
      isdeleted: false
    };
    if (fromDate || toDate) {
      matchQuery.date = {};
      if (fromDate) matchQuery.date.$gte = fromDate;
      if (toDate) matchQuery.date.$lte = toDate;
    }
    const pipeline = [
      { $match: matchQuery },

      { $unwind: '$students' },

      { $match: { 'students.studentId': student.studentId } },

      // ✅ FIX: convert string → ObjectId
      {
        $addFields: {
          subjectId: {
            $cond: [{ $eq: [{ $type: '$subjectId' }, 'string'] }, { $toObjectId: '$subjectId' }, '$subjectId']
          }
        }
      },

      // ✅ Lookup
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: '_id',
          as: 'subject'
        }
      },

      {
        $unwind: {
          path: '$subject',
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $project: {
          _id: 0,
          attendanceId: 1,
          date: 1,
          periodNo: 1,
          facultyId: 1,
          subjectId: 1,

          // ✅ Now works
          subjectName: '$subject.subjectName',
          subjectCode: '$subject.subjectCode',

          topicTaught: 1,
          status: '$students.status',
          remarks: '$students.remarks'
        }
      },

      { $sort: { date: -1, periodNo: 1 } }
    ];
    const detailedRecords = await Attendance.aggregate(pipeline);
    let totalPeriods = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    detailedRecords.forEach((record) => {
      totalPeriods++;
      if (record.status === 'PRESENT') presentCount++;
      else if (record.status === 'ABSENT') absentCount++;
      else if (record.status === 'LATE') lateCount++;
    });
    const attended = presentCount + lateCount;
    const attendancePercentage = totalPeriods > 0 ? Math.round((attended / totalPeriods) * 100 * 100) / 100 : 0;
    return res.status(200).json({
      status: true,
      message: 'Student attendance report generated successfully',
      data: {
        student: {
          studentId: student.studentId,
          admissionNo: student.admissionNo,
          name: student.student?.name,
          batchCode: student.batchCode
        },
        summary: {
          totalPeriods,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          attendancePercentage
        },
        details: detailedRecords
      }
    });
  } catch (err) {
    return next(err);
  }
};

const updateBasicDetails = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);

    if (!tenantId || !studentId) {
      return res.status(400).json({ status: false, message: 'tenantId and studentId are required' });
    }

    const profile = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false });
    if (!profile) return res.status(404).json({ status: false, message: 'Student profile not found' });

    const admissionId = profile.admissionId;

    // Update Student Profile Details
    const profileUpdate = {};
    if (req.body.name) profileUpdate['student.name'] = safeTrim(req.body.name);
    if (req.body.phone) profileUpdate['student.phone'] = safeTrim(req.body.phone);
    if (req.body.email) profileUpdate['student.email'] = safeTrim(req.body.email);
    if (req.body.parentName) profileUpdate['student.parentName'] = safeTrim(req.body.parentName);
    if (req.body.parentMobile) profileUpdate['student.parentPhone'] = safeTrim(req.body.parentMobile);

    if (Object.keys(profileUpdate).length > 0) {
      await StudentProfile.updateOne({ tenantId, studentId }, { $set: profileUpdate });
    }

    // Update Admission Collection Details (Address, DOB, Gender, etc.)
    const admissionUpdate = {};
    if (req.body.addressLine1) admissionUpdate['student.address'] = safeTrim(req.body.addressLine1);
    if (req.body.city) admissionUpdate['student.city'] = safeTrim(req.body.city);
    if (req.body.gender) admissionUpdate['student.gender'] = safeTrim(req.body.gender);
    if (req.body.dob) admissionUpdate['student.dateOfBirth'] = toNum(req.body.dob);

    if (Object.keys(admissionUpdate).length > 0) {
      await Admission.updateOne({ tenantId, admissionId }, { $set: admissionUpdate });
    }

    return res.status(200).json({ status: true, message: 'Student basic details updated successfully' });
  } catch (err) {
    return next(err);
  }
};

const toggleTabletAccess = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const isTabletBlocked = req.body?.isTabletBlocked === true;
    if (!tenantId || !studentId) {
      return res.status(400).json({ status: false, message: 'tenantId and studentId are required' });
    }
    const updated = await StudentProfile.findOneAndUpdate({ tenantId, studentId, isdeleted: false }, { $set: { isTabletBlocked } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Student not found' });
    return res.status(200).json({
      status: true,
      message: `Tablet access ${isTabletBlocked ? 'blocked' : 'unblocked'} successfully`,
      isTabletBlocked: updated.isTabletBlocked
    });
  } catch (err) {
    return next(err);
  }
};

const addSchoolExamMarks = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { examId, studentId, subjects, remarks } = req.body;
    if (!tenantId || !examId || !studentId || !Array.isArray(subjects)) {
      return res.status(400).json({ status: false, message: 'tenantId, examId, studentId, and subjects array are required' });
    }
    const student = await StudentProfile.findOne({ tenantId, studentId, isdeleted: false }, { admissionNo: 1 }).lean();
    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });
    let totalMaxMarks = 0;
    let totalObtainedMarks = 0;
    const formattedSubjects = subjects.map((s) => {
      const max = toNum(s.maxMarks);
      const obtained = toNum(s.obtainedMarks);
      totalMaxMarks += max;
      totalObtainedMarks += obtained;
      return {
        subjectName: safeTrim(s.subjectName),
        maxMarks: max,
        obtainedMarks: obtained,
        grade: safeTrim(s.grade)
      };
    });
    const percentage = totalMaxMarks > 0 ? Math.round((totalObtainedMarks / totalMaxMarks) * 100 * 100) / 100 : 0;
    const result = await SchoolExamResult.findOneAndUpdate(
      { tenantId, examId, studentId, isdeleted: false },
      {
        $set: {
          admissionNo: student.admissionNo,
          subjects: formattedSubjects,
          totalMaxMarks,
          totalObtainedMarks,
          percentage,
          remarks: safeTrim(remarks),
          updatedBy: req.body?.userId || null
        },
        $setOnInsert: { createdBy: req.body?.userId || null }
      },
      { new: true, upsert: true }
    );
    return res.status(200).json({ status: true, message: 'School exam marks recorded successfully', data: result });
  } catch (err) {
    return next(err);
  }
};

const addStudentRemark = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { admissionNo, type, dateOfIncident, remark, reportedByParent } = req.body;
    if (!tenantId || !admissionNo || !type || !dateOfIncident || !remark) {
      return res.status(400).json({ status: false, message: 'tenantId, admissionNo, type, dateOfIncident, and remark are required' });
    }
    const student = await StudentProfile.findOne({ tenantId, admissionNo, isdeleted: false }, { studentId: 1 }).lean();
    if (!student) return res.status(404).json({ status: false, message: 'Student not found with this admission number' });
    const newRemark = await StudentRemark.create({
      tenantId,
      admissionNo: safeTrim(admissionNo),
      studentId: student.studentId,
      type: safeTrim(type),
      dateOfIncident: toNum(dateOfIncident),
      remark: safeTrim(remark),
      reportedByParent: reportedByParent !== undefined ? reportedByParent : true,
      createdBy: req.body?.userId || null
    });
    return res.status(201).json({ status: true, message: 'Remark recorded successfully', data: newRemark });
  } catch (err) {
    return next(err);
  }
};

const getStudentRemarks = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const admissionNo = safeTrim(req.body?.admissionNo || req.query?.admissionNo);

    if (!tenantId || !admissionNo) {
      return res.status(400).json({ status: false, message: 'tenantId and admissionNo are required' });
    }
    const remarks = await StudentRemark.find({ tenantId, admissionNo, isdeleted: false }).sort({ dateOfIncident: -1 }).lean();
    return res.status(200).json({ status: true, data: remarks, count: remarks.length });
  } catch (err) {
    return next(err);
  }
};

const bulkUpdateStudents = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const students = Array.isArray(req.body?.students) ? req.body.students : [];
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!students.length) return res.status(400).json({ status: false, message: 'students array is required' });

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const s of students) {
      const admissionNo = safeTrim(s['Enrolment Number'] || s['Admission No'] || s.admissionNo || '');
      if (!admissionNo) {
        failedCount++;
        errors.push({ admissionNo: '-', reason: 'Missing admissionNo' });
        continue;
      }

      const profileUpdate = {};
      if (safeTrim(s['Full Name'] || s.fullName)) profileUpdate['student.name'] = safeTrim(s['Full Name'] || s.fullName);
      if (safeTrim(s['Mobile'] || s.mobile)) profileUpdate['student.phone'] = safeTrim(s['Mobile'] || s.mobile);
      if (safeTrim(s['Email'] || s.email)) profileUpdate['student.email'] = safeTrim(s['Email'] || s.email);
      if (safeTrim(s['Parent Name'] || s.parentName)) profileUpdate['student.parentName'] = safeTrim(s['Parent Name'] || s.parentName);
      if (safeTrim(s['Parent Mobile'] || s.parentMobile)) profileUpdate['student.parentPhone'] = safeTrim(s['Parent Mobile'] || s.parentMobile);

      if (!Object.keys(profileUpdate).length) {
        failedCount++;
        errors.push({ admissionNo, reason: 'No fields to update' });
        continue;
      }

      const result = await StudentProfile.updateOne({ tenantId, admissionNo, isdeleted: false }, { $set: { ...profileUpdate, updatedBy: safeTrim(req.body?.userId || '') } });

      if (result.matchedCount === 0) {
        failedCount++;
        errors.push({ admissionNo, reason: 'Student not found' });
      } else {
        successCount++;
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Bulk update completed',
      data: { successCount, failedCount, errors }
    });
  } catch (err) {
    return next(err);
  }
};

const bulkUploadPhotos = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!req.files || !req.files.length) return res.status(400).json({ status: false, message: 'No files uploaded' });
    if (!QUESTION_BUCKET) return res.status(500).json({ status: false, message: 'S3 bucket not configured' });

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const file of req.files) {
      // filename without extension = admissionNo
      const admissionNo = path.basename(file.originalname, path.extname(file.originalname)).trim();
      if (!admissionNo) {
        failedCount++;
        errors.push({ file: file.originalname, reason: 'Cannot determine admissionNo from filename' });
        continue;
      }

      try {
        // Build S3 key under students/ prefix
        const ext = path.extname(file.originalname) || '.jpg';
        const random = crypto.randomBytes(6).toString('hex');
        const key = `students/${admissionNo}-${Date.now()}-${random}${ext}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: QUESTION_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype
          })
        );

        const photoUrl = `https://${QUESTION_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

        const result = await StudentProfile.updateOne({ tenantId, admissionNo, isdeleted: false }, { $set: { photoUrl, updatedBy: safeTrim(req.body?.userId || '') } });

        if (result.matchedCount === 0) {
          failedCount++;
          errors.push({ admissionNo, file: file.originalname, reason: 'Student not found' });
        } else {
          successCount++;
        }
      } catch (uploadErr) {
        failedCount++;
        errors.push({ admissionNo, file: file.originalname, reason: uploadErr.message || 'Upload failed' });
      }
    }

    return res.status(200).json({
      status: true,
      message: 'Bulk photo upload completed',
      data: { successCount, failedCount, errors }
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentLateEntries = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const identifier = safeTrim(req.body?.studentNo || req.body?.studentId);
    if (!tenantId || !identifier) {
      return res.status(400).json({ status: false, message: 'tenantId and studentNo are required' });
    }

    // Resolve studentId from profile
    const student = await StudentProfile.findOne(
      {
        tenantId,
        isdeleted: false,
        $or: [{ studentId: identifier }, { admissionNo: identifier }, { registrationNumber: identifier }]
      },
      { studentId: 1, admissionNo: 1 }
    ).lean();

    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });

    const page = Math.max(1, toInt(req.query?.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query?.limit, 20)));
    const skip = (page - 1) * limit;

    const query = {
      tenantId,
      type: 'STUDENT',
      personId: student.studentId,
      isdeleted: false
    };

    const [rows, count] = await Promise.all([LateEntryLog.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(), LateEntryLog.countDocuments(query)]);

    return res.status(200).json({
      status: true,
      data: rows,
      count,
      page,
      limit
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  listStudents,
  viewProfile,
  viewFinancials,
  viewAcademicSummary,
  studentLogin,
  getStudentSubjects,
  getAllClassSubjectTopics,
  getStudentTopicsTests,
  getStudentTimetable,
  getStudentAttendance,
  getStudentProfileView,
  getStudentMaterialSubjects,
  getStudentMaterials,
  getStudentAttendanceReport,
  updateBasicDetails,
  toggleTabletAccess,
  addSchoolExamMarks,
  addStudentRemark,
  getStudentRemarks,
  bulkUpdateStudents,
  bulkUploadPhotos,
  getStudentLateEntries
};
