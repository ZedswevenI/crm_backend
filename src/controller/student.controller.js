import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import StudentProfile from '../models/studentProfile.model.js';
import Admission from '../models/admission.model.js';
import Batch from '../models/batch.model.js';
import Payment from '../models/admissionpayments.model.js';
import Program from '../models/program.model.js';
import Subject from '../models/subject.model.js';

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

export const getAllClassSubjectTopics = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.entiId);
    const regNo = safeTrim(req.body?.regNo);
    const classNo = toNum(req.body?.classNo);
    const subjectId = safeTrim(req.body?.subjectId);
    if (!tenantId || !regNo || !classNo || !subjectId) {
      return res.status(400).json({
        status: false,
        message: 'entiId, regNo, classNo and subjectId are required'
      });
    }
    const categories = ['CATEGORY A', 'CATEGORY B', 'CATEGORY C'];
    const subtopicsByTopics = {};
    let topicCounter = 1;
    for (const category of categories) {
      subtopicsByTopics[category] = [];
      for (let t = 1; t <= 3; t++) {
        const topicName = `${subjectId} TOPIC ${topicCounter}`;
        for (let st = 1; st <= 3; st++) {
          subtopicsByTopics[category].push({
            subtopicId: randomId(),
            subtopicName: `${topicName} - SUBTOPIC ${st}`,
            phases: 'VI',
            test: generateDummyTests()
          });
        }
        topicCounter++;
      }
    }
    return res.json({
      status: true,
      message: 'Dummy class-subject topics loaded',
      data: {
        student: {
          regNo,
          classNo,
          studentName: 'Test Student'
        },
        subjectId,
        subjectName: subjectId,
        subtopicsByTopics
      }
    });
  } catch (err) {
    next(err);
  }
};

function randomId() {
  return 'ID-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateDummyTests() {
  const testConfigs = [
    ['Board', 'Beginner'],
    ['Board', 'Scholar'],
    ['JEE Mains', 'Beginner'],
    ['JEE Mains', 'Scholar'],
    ['JEE Advanced', 'Beginner'],
    ['JEE Advanced', 'Scholar']
  ];

  return testConfigs.map((c, idx) => ({
    examCategory: c[0],
    examSubCategory: c[1],
    testId: 'TST-' + randomId(),
    sortOrder: idx + 1
  }));
}

const MARKING_RULES = {
  MATHS: { positive: 4, negative: 1 },
  PHYSICS: { positive: 3, negative: 1 },
  CHEMISTRY: { positive: 4, negative: 1 }
};

// dummy solution image
const sampleSolutionImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...';

function buildOptions(opts) {
  return opts.map((o, i) => ({
    label: String.fromCharCode(97 + i),
    text: o,
    html: o.startsWith('$') ? `<span class='latex'>${o}</span>` : o
  }));
}

function generateMatrixMatch() {
  return {
    left: ['P', 'Q', 'R'],
    right: ['1', '2', '3'],
    correctMap: { P: '2', Q: '3', R: '1' }
  };
}

function generateQuestions(subject, indexOffset = 0) {
  const mark = MARKING_RULES[subject] || { positive: 4, negative: 1 };
  const templates = [
    // 1. MCQ
    {
      qtype: 'mcq',
      questionText: 'Compute $3^2 + 4^2$.',
      options: ['12', '25', '7', '5'],
      answer: 'b'
    },
    // 2. Image-based MCQ
    {
      qtype: 'mcq',
      questionHtml: "Identify the triangle.<br/><img src='" + sampleSolutionImage + "' width='100%'/>",
      options: ['Scalene', 'Isosceles', 'Right', 'Equilateral'],
      answer: 'c'
    },
    // 3. INTEGER
    {
      qtype: 'integer',
      questionText: 'Solve: $2x - 6 = 18$',
      answer: '12'
    },
    // 4. MATRIX MATCH
    {
      qtype: 'matrix',
      questionText: 'Match the following:',
      matrix: generateMatrixMatch(),
      answer: { P: '2', Q: '3', R: '1' }
    },
    // 5. LATEX MCQ
    {
      qtype: 'mcq',
      questionText: 'Derivative of $\\sin x$ is:',
      options: ['$\\cos x$', '$\\sin x$', '$-\\cos x$', '$-\\sin x$'],
      answer: 'a'
    },
    // 6. Image + INTEGER
    {
      qtype: 'integer',
      questionHtml: "Observe the figure.<br/><img src='" + sampleSolutionImage + "' width='100%'/> <br/>Find the missing length.",
      answer: '10'
    },
    // 7. Passage MCQ
    {
      qtype: 'mcq',
      questionHtml: '<b>Passage:</b> A particle moves with constant acceleration...<br/><br/>The velocity after 5 sec is?',
      options: ['5 m/s', '10 m/s', '25 m/s', '50 m/s'],
      answer: 'c'
    },
    // 8. MATRIX MATCH 2
    {
      qtype: 'matrix',
      questionText: 'Match oxidation states:',
      matrix: generateMatrixMatch(),
      answer: { P: '2', Q: '3', R: '1' }
    },
    // 9. MCQ advanced
    {
      qtype: 'mcq',
      questionText: 'Which is an aromatic compound?',
      options: ['Ethane', 'Benzene', 'Methanol', 'Ethanol'],
      answer: 'b'
    },
    {
      qtype: 'integer',
      questionText: 'If $f(x)=2x+1$, compute $f(11)$.',
      answer: '23'
    }
  ];
  return templates.map((t, i) => ({
    id: i + 1 + indexOffset,
    ...t,
    options: t.options ? buildOptions(t.options) : [],
    positiveMarks: mark.positive,
    negativeMarks: mark.negative,
    sortid: String(i + 1),
    solutionHtml: "<b>Explanation:</b> Basic concept used.<br/><span class='latex'>$Steps...$</span>",
    solutionImage: sampleSolutionImage
  }));
}

function buildDummyData(subject, classNo) {
  const topicNames = ['Foundations of ' + subject, subject + ' Advanced Concepts', subject + ' Applications'];
  const subNames = ['Basics', 'Intermediate', 'Advanced'];
  const phaseMap = ['VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const topicsByCategory = {};
  topicNames.forEach((topic) => {
    const tests = [
      { testId: 'T-' + Math.random().toString(36).slice(2, 8), sortOrder: 1 },
      { testId: 'T-' + Math.random().toString(36).slice(2, 8), sortOrder: 2 },
      { testId: 'T-' + Math.random().toString(36).slice(2, 8), sortOrder: 3 }
    ];
    tests.forEach((t, i) => {
      t.questions = generateQuestions(subject, i * 10);
    });
    const subtopics = subNames.map((st) => {
      return {
        subtopicId: 'ST-' + Math.random().toString(36).slice(2, 8),
        subtopicName: st,
        phases: phaseMap[classNo % 6],
        tests
      };
    });
    topicsByCategory[topic] = subtopics;
  });

  return topicsByCategory;
}

const getStudentTopicsTests = async (req, res) => {
  try {
    const tenantId = String(req.body?.entiId || '').trim();
    const admissionNo = String(req.body?.regNo || '').trim();
    const subject = String(req.body?.subjectId || '')
      .trim()
      .toUpperCase();
    const classNo = Number(req.body?.classNo || 0);

    if (!tenantId || !admissionNo || !subject || !classNo) {
      return res.status(400).json({
        status: false,
        message: 'tenantId, admissionNo, subject, classNo required'
      });
    }
    const data = {
      classNo,
      subject,
      topicsByCategory: buildDummyData(subject, classNo)
    };
    return res.status(200).json({
      status: true,
      message: 'Success',
      data
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message || 'Internal error'
    });
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
