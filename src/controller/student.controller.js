import mongoose from 'mongoose';
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

// 9051642680002

const studentLogin = async (req, res, next) => {
  try {
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
    if (!student) {
      return res.status(404).json({ status: false, message: 'Student not found' });
    }
    const programId = student.programId;
    if (!programId) {
      return res.status(400).json({ status: false, message: 'Student program not found' });
    }
    const program = await Program.findOne({
      tenantId,
      programId,
      isdeleted: false
    }).lean();
    if (!program) {
      return res.status(404).json({ status: false, message: 'Program not found' });
    }
    const subjectIds = (program.subjects || []).map((s) => s);
    const subjects = await Subject.find({
      tenantId,
      _id: { $in: subjectIds },
      isdeleted: false
    }).lean();
    const enriched = subjects.map((sub) => {
      const mapping = program.subjects.find((s) => String(s.subjectId) === String(sub._id));
      return {
        subjectId: sub._id,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode || null,
        classNo: mapping?.classNo || student.classNo,
        sortOrder: mapping?.sortOrder || 0
      };
    });
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
        message: 'entiId, regNo, classNo and subject are required'
      });
    }
    let subjectId = null;
    const subQ = { tenantId, isdeleted: false, $or: [] };
    if (mongoose?.Types?.ObjectId?.isValid(subjectRaw)) subQ.$or.push({ _id: new mongoose.Types.ObjectId(subjectRaw) });
    subQ.$or.push({ subjectId: subjectRaw });
    subQ.$or.push({ subjectName: subjectRaw });
    const subjectDoc = await Subject.findOne(subQ, { _id: 1, subjectId: 1, subjectName: 1 }).lean();
    if (!subjectDoc) {
      return res.status(404).json({ status: false, message: 'Subject not found' });
    }
    subjectId = safeTrim(subjectDoc.subjectId || subjectDoc._id);
    const student = await StudentProfile.findOne({
      tenantId,
      isdeleted: false,
      status: 'ACTIVE',
      $or: [{ admissionNo: regNo }, { registrationNumber: regNo }, { portalStudentId: regNo }]
    }).lean();
    if (!student) return res.status(404).json({ status: false, message: 'Student not found' });
    const programId = safeTrim(student.programId);
    if (!programId) return res.status(400).json({ status: false, message: 'Student program not found' });
    const program = await Program.findOne({ tenantId, programId, isdeleted: false }).lean();
    if (!program) return res.status(404).json({ status: false, message: 'Program not found' });
    const examMappings = (Array.isArray(program.examMappings) ? program.examMappings : [])
      .map((m) => ({
        categoryId: safeTrim(m?.categoryId),
        subCategoryId: safeTrim(m?.subCategoryId),
        sortOrder: Number.isFinite(Number(m?.sortOrder)) ? Number(m.sortOrder) : 0
      }))
      .filter((m) => m.categoryId && m.subCategoryId)
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    if (!examMappings.length) {
      return res.json({
        status: true,
        message: 'No exam mappings configured for this program',
        data: {
          student: { regNo, classNo, studentName: student?.student?.name || null },
          subjectId,
          subjectName: subjectDoc.subjectName || subjectRaw,
          program: { programId: program.programId, programName: program.programName },
          subtopicsByTopics: {}
        }
      });
    }
    const categoryIds = Array.from(new Set(examMappings.map((x) => x.categoryId)));
    const subCategoryIds = Array.from(new Set(examMappings.map((x) => x.subCategoryId)));
    const categories = await ExamCategory.find({ tenantId, categoryId: { $in: categoryIds }, isdeleted: false }).lean();
    const subCategories = await ExamSubCategory.find({
      tenantId,
      subCategoryId: { $in: subCategoryIds },
      isdeleted: false
    }).lean();
    const catNameById = new Map((categories || []).map((c) => [safeTrim(c.categoryId), c.categoryName || c.name || safeTrim(c.categoryId)]));
    const subCatNameById = new Map((subCategories || []).map((s) => [safeTrim(s.subCategoryId), s.subCategoryName || s.name || safeTrim(s.subCategoryId)]));
    const topics = await Topic.find({ tenantId, classNo, subjectId, isdeleted: false }).sort({ sortOrder: 1 }).lean();
    const topicIds = topics.map((t) => safeTrim(t.topicId || t._id)).filter(Boolean);
    const subtopics = await SubTopic.find({
      tenantId,
      classNo,
      subjectId,
      isdeleted: false,
      topicId: { $in: topicIds }
    })
      .sort({ sortOrder: 1 })
      .lean();
    const subTopicIds = subtopics.map((st) => safeTrim(st.subTopicId)).filter(Boolean);
    const assignments = await Assignment.find({
      tenantId,
      classNo,
      subjectId,
      isdeleted: false,
      status: { $in: ['active', 'ACTIVE'] },
      categoryId: { $in: categoryIds },
      subCategoryId: { $in: subCategoryIds },
      topicId: { $in: topicIds },
      subTopicId: { $in: subTopicIds }
    })
      .sort({ createdAt: 1 })
      .lean();
    const assignsByKey = new Map();
    for (const a of assignments) {
      const catId = safeTrim(a.categoryId);
      const subCatId = safeTrim(a.subCategoryId);
      const stId = safeTrim(a.subTopicId);
      const key = `${catId}||${subCatId}||${stId}`;
      const arr = assignsByKey.get(key) || [];
      arr.push({
        assignmentId: a._id,
        testId: a.testId || null,
        testNo: a.testNo ?? null,
        testCode: a.testCode || null,
        numberOfQuestions: a.numberOfQuestions ?? null,
        status: a.status || null
      });
      assignsByKey.set(key, arr);
    }
    const subtopicsByTopics = {};
    for (const t of topics) {
      const tId = safeTrim(t.topicId || t._id);
      const topicName = t.topicName || t.name || 'TOPIC';
      const topicSortOrder = t.sortOrder ?? 0;
      const sts = subtopics.filter((st) => safeTrim(st.topicId) === tId).sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0));
      if (!sts.length) continue;
      subtopicsByTopics[topicName] = [];
      for (const st of sts) {
        const stId = safeTrim(st.subTopicId || st._id);
        const stName = st.subTopicName;
        const stSortOrder = st.sortOrder ?? 0;
        const test = [];
        for (const mapRow of examMappings) {
          const catId = mapRow.categoryId;
          const subCatId = mapRow.subCategoryId;
          const examCategory = catNameById.get(catId) || catId;
          const examSubCategory = subCatNameById.get(subCatId) || subCatId;
          const key = `${catId}||${subCatId}||${stId}`;
          const assigns = assignsByKey.get(key) || [];
          const a0 = assigns[0];
          test.push({
            examCategory,
            examSubCategory,
            testNo: a0?.testNo || null,
            testId: a0?.testId || null,
            sortOrder: mapRow.sortOrder
          });
        }
        test.sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
        subtopicsByTopics[topicName].push({
          topicId: tId,
          topicName,
          topicSortOrder,
          subtopicId: stId,
          subtopicName: stName,
          subtopicSortOrder: stSortOrder,
          phases: st.phases || null,
          test
        });
      }
      subtopicsByTopics[topicName].sort((a, b) => Number(a.subtopicSortOrder) - Number(b.subtopicSortOrder));
    }
    return res.json({
      status: true,
      message: 'Class-subject topics loaded',
      data: {
        student: {
          regNo,
          classNo,
          studentName: student?.student?.name || null
        },
        subjectId,
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
      .sort({ sortOrder: 1, createdAt: 1 })
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

export default {
  listStudents,
  viewProfile,
  viewFinancials,
  viewAcademicSummary,
  studentLogin,
  getStudentSubjects,
  getAllClassSubjectTopics,
  getStudentTopicsTests
};
