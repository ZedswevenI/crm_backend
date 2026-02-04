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
      data: [
        {
          testId: '1480',
          class: {
            _id: '693115d2f1825d21120be089',
            entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
            classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
            className: '12th',
            description: '12th',
            status: 'active',
            createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
            updatedBy: null,
            isdeleted: false,
            createdAt: '2025-12-04T05:02:10.797Z',
            updatedAt: '2025-12-04T05:02:10.797Z',
            __v: 0
          },
          subject: {
            _id: '6931161ef1825d21120be0aa',
            entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
            subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
            subjectName: 'Mathematics',
            description: '',
            status: 'active',
            createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
            updatedBy: null,
            isdeleted: false,
            createdAt: '2025-12-04T05:03:26.290Z',
            updatedAt: '2025-12-04T05:03:26.290Z',
            __v: 0
          },
          topic: {
            _id: '69536a811a14ee5991126ce6',
            entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
            classId: '693115d2f1825d21120be089',
            subjectId: '6931161ef1825d21120be0aa',
            topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
            topicName: 'Probability',
            description: '',
            status: 'active',
            createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
            updatedBy: null,
            isdeleted: false,
            createdAt: '2025-12-30T06:00:33.891Z',
            updatedAt: '2025-12-30T06:00:33.891Z',
            __v: 0
          },
          subtopic: {
            _id: '69536e321a14ee59911274e6',
            entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
            classId: '693115d2f1825d21120be089',
            subjectId: '6931161ef1825d21120be0aa',
            topicId: '69536a811a14ee5991126ce6',
            subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
            subtopicName: 'Miscellaneous Problems',
            description: '',
            status: 'active',
            createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
            updatedBy: null,
            isdeleted: false,
            createdAt: '2025-12-30T06:16:18.417Z',
            updatedAt: '2025-12-30T06:16:18.417Z',
            __v: 0
          },
          examCategory: {
            _id: '693fa5b60789982afe2fcdc5',
            entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
            categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
            categoryName: 'IITJEE\tJEEMB',
            description: '',
            status: 'active',
            createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
            updatedBy: null,
            isdeleted: false,
            createdAt: '2025-12-15T06:07:50.422Z',
            updatedAt: '2025-12-15T06:07:50.422Z',
            __v: 0
          },
          questions: [
            {
              _id: '69536ec61a14ee59911276ac',
              questionId: '94293',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: '6 ordinary dice are rolled. The probability that at least half of them will show at least 3, is :',
              questionHtml: '6 ordinary dice are rolled. The probability that at least half of them will show at least 3, is :',
              images: [],
              correctAnswer: 'A',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '41×2⁴/3⁶',
                  images: [],
                  text: '41×2⁴/3⁶',
                  isCorrect: true,
                  _id: '695f5b871a14ee5991130c1c'
                },
                {
                  key: 'B',
                  textHtml: '2⁴/3⁶',
                  images: [],
                  text: '2⁴/3⁶',
                  isCorrect: false,
                  _id: '695f5b871a14ee5991130c1d'
                },
                {
                  key: 'C',
                  textHtml: '20×2⁴/3⁶',
                  images: [],
                  text: '20×2⁴/3⁶',
                  isCorrect: false,
                  _id: '695f5b871a14ee5991130c1e'
                },
                {
                  key: 'D',
                  textHtml: 'None of these',
                  images: [],
                  text: 'None of these',
                  isCorrect: false,
                  _id: '695f5b871a14ee5991130c1f'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276b1',
              questionId: '94294',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'Consider all functions that can be defined from the set A={1,2,3} to the set B={1,2,3,4,5}. A function f( x) is selected at random from these functions. The probability that, selected function satisfies f(i)≤f(j) for i&lt;j, is equal to :',
              questionHtml: 'All functions from \n\nA={1,2,3} to B={1,2,3,4,5} are considered. A function \nf(x)is selected at random. What is the probability that selected function satisfiesf(i)≤f(j) for (i) lessthan (j)is equal to?',
              images: [],
              correctAnswer: 'B',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '6/25',
                  images: [],
                  text: '6/25',
                  isCorrect: false,
                  _id: '695f67471a14ee5991130ed9'
                },
                {
                  key: 'B',
                  textHtml: '7/25',
                  images: [],
                  text: '7/25',
                  isCorrect: true,
                  _id: '695f67471a14ee5991130eda'
                },
                {
                  key: 'C',
                  textHtml: '2/5',
                  images: [],
                  text: '2/5',
                  isCorrect: false,
                  _id: '695f67471a14ee5991130edb'
                },
                {
                  key: 'D',
                  textHtml: '12/25',
                  images: [],
                  text: '12/25',
                  isCorrect: false,
                  _id: '695f67471a14ee5991130edc'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276b6',
              questionId: '94295',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'One number is selected at random from first two hundred positive integers. The probability that it is divisible by 6 or 8, is equal to:',
              questionHtml: 'One number is selected at random from first two hundred positive integers. The probability that it is divisible by 6 or 8, is equal to:',
              images: [],
              correctAnswer: 'D',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '29/100',
                  images: [],
                  text: '29/100',
                  isCorrect: false,
                  _id: '695f5c261a14ee5991130c54'
                },
                {
                  key: 'B',
                  textHtml: '33/100',
                  images: [],
                  text: '33/100',
                  isCorrect: false,
                  _id: '695f5c261a14ee5991130c55'
                },
                {
                  key: 'C',
                  textHtml: '43/100',
                  images: [],
                  text: '43/100',
                  isCorrect: false,
                  _id: '695f5c261a14ee5991130c56'
                },
                {
                  key: 'D',
                  textHtml: '1/4',
                  images: [],
                  text: '1/4',
                  isCorrect: true,
                  _id: '695f5c261a14ee5991130c57'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276bb',
              questionId: '94296',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'A five digit number (having all different digits) is formed using the digits 1, 2, 3, 4, 5, 6, 7, 8 and 9. The probability that the formed number either begins or ends with an odd digit, is equal to :',
              questionHtml: 'A five digit number (having all different digits) is formed using the digits 1, 2, 3, 4, 5, 6, 7, 8 and 9. The probability that the formed number either begins or ends with an odd digit, is equal to :',
              images: [],
              correctAnswer: 'A',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '5/6',
                  images: [],
                  text: '5/6',
                  isCorrect: true,
                  _id: '695f5c621a14ee5991130c70'
                },
                {
                  key: 'B',
                  textHtml: '1/6',
                  images: [],
                  text: '1/6',
                  isCorrect: false,
                  _id: '695f5c621a14ee5991130c71'
                },
                {
                  key: 'C',
                  textHtml: '1/3',
                  images: [],
                  text: '1/3',
                  isCorrect: false,
                  _id: '695f5c621a14ee5991130c72'
                },
                {
                  key: 'D',
                  textHtml: '2/3',
                  images: [],
                  text: '2/3',
                  isCorrect: false,
                  _id: '695f5c621a14ee5991130c73'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276c0',
              questionId: '94297',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'A four digit number (numbered from 0000 to 9999) is said to be lucky, if sum of its first two digits is equal to sum of its last two digits. If a four digit number is picked up at random, the probability that it is lucky number is :',
              questionHtml: 'A four digit number (numbered from 0000 to 9999) is said to be lucky, if sum of its first two digits is equal to sum of its last two digits. If a four digit number is picked up at random, the probability that it is lucky number is :',
              images: [],
              correctAnswer: 'C',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '1.67',
                  images: [],
                  text: '1.67',
                  isCorrect: false,
                  _id: '69536ec61a14ee59911276c1'
                },
                {
                  key: 'B',
                  textHtml: '2.37',
                  images: [],
                  text: '2.37',
                  isCorrect: false,
                  _id: '69536ec61a14ee59911276c2'
                },
                {
                  key: 'C',
                  textHtml: '0.067',
                  images: [],
                  text: '0.067',
                  isCorrect: true,
                  _id: '69536ec61a14ee59911276c3'
                },
                {
                  key: 'D',
                  textHtml: '0.37',
                  images: [],
                  text: '0.37',
                  isCorrect: false,
                  _id: '69536ec61a14ee59911276c4'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276c5',
              questionId: '94298',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText:
                'Sixteen players P1,P2,….P16 play in a tournament. They are divided into eight pairs at random. From each pair a winner is decided on the basis of a game played between the two players of the pair. Assuming that all the players are of equal strength, the probability that exactly one of the two players P1 and P2 is among the eight winners is :',
              questionHtml:
                'Sixteen players \\(P1,P2,\\dots.P16\\) play in a tournament. They are divided into eight pairs at random. From each pair a winner is decided on the basis of a game played between the two players of the pair. Assuming that all the players are of equal strength, the probability that exactly one of the two players \\(P1\\) and \\(P2\\) is among the eight winners is :',
              images: [],
              correctAnswer: 'C',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '4/15',
                  images: [],
                  text: '415',
                  isCorrect: false,
                  _id: '695f58a11a14ee5991130c00'
                },
                {
                  key: 'B',
                  textHtml: '7/15',
                  images: [],
                  text: '715',
                  isCorrect: false,
                  _id: '695f58a11a14ee5991130c01'
                },
                {
                  key: 'C',
                  textHtml: '8/15',
                  images: [],
                  text: '815',
                  isCorrect: true,
                  _id: '695f58a11a14ee5991130c02'
                },
                {
                  key: 'D',
                  textHtml: '17/30',
                  images: [],
                  text: '1730',
                  isCorrect: false,
                  _id: '695f58a11a14ee5991130c03'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276ca',
              questionId: '94299',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'A square is inscribed in a circle. If p1 is the probability that a randomly chosen point of the circle lies within the square and p2 is the probability that the point lies outside the square, then :',
              questionHtml: 'A square is inscribed in a circle. If \\(p1\\) is the probability that a randomly chosen point of the circle lies within the square and \\(p2\\) is the probability that the point lies outside the square, then :',
              images: [],
              correctAnswer: 'C',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '\\(p1=p2\\)',
                  images: [],
                  text: 'p1=p2',
                  isCorrect: false,
                  _id: '695f5e951a14ee5991130cfa'
                },
                {
                  key: 'B',
                  textHtml: 'p1 < P2',
                  images: [],
                  text: 'p1<p2',
                  isCorrect: false,
                  _id: '695f5e951a14ee5991130cfb'
                },
                {
                  key: 'C',
                  textHtml: '\\(p1>p2\\)',
                  images: [],
                  text: 'p1&gt;p2',
                  isCorrect: true,
                  _id: '695f5e951a14ee5991130cfc'
                },
                {
                  key: 'D',
                  textHtml: 'None of these',
                  images: [],
                  text: 'None of these',
                  isCorrect: false,
                  _id: '695f5e951a14ee5991130cfd'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276cf',
              questionId: '94300',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'The probability that the length of a randomly chosen chord of a circle lies between 23 and 56 of its diameter is :',
              questionHtml: 'The probability that the length of a randomly chosen chord of a circle lies between 2/3 and 5/6 of its diameter is :',
              images: [],
              correctAnswer: 'A',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '1/4',
                  images: [],
                  text: '1/4',
                  isCorrect: true,
                  _id: '695f5f001a14ee5991130d32'
                },
                {
                  key: 'B',
                  textHtml: '5/12',
                  images: [],
                  text: '5/12',
                  isCorrect: false,
                  _id: '695f5f001a14ee5991130d33'
                },
                {
                  key: 'C',
                  textHtml: '1/16',
                  images: [],
                  text: '1/16',
                  isCorrect: false,
                  _id: '695f5f001a14ee5991130d34'
                },
                {
                  key: 'D',
                  textHtml: '5/16',
                  images: [],
                  text: '5/16',
                  isCorrect: false,
                  _id: '695f5f001a14ee5991130d35'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276d4',
              questionId: '94301',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'Two persons A and B agree to meet at a place between 11 to 12 noon. The first one to arrive waits for 20 minutes and then leave. If the time of their arrival be independent and at random, then the probability that A and B meet is :',
              questionHtml: 'Two persons A and B agree to meet at a place between 11 to 12 noon. The first one to arrive waits for 20 minutes and then leave. If the time of their arrival be independent and at random, then the probability that A and B meet is :',
              images: [],
              correctAnswer: 'D',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '1/3',
                  images: [],
                  text: '1/3',
                  isCorrect: false,
                  _id: '695f5ed01a14ee5991130d16'
                },
                {
                  key: 'B',
                  textHtml: '2/3',
                  images: [],
                  text: '2/3',
                  isCorrect: false,
                  _id: '695f5ed01a14ee5991130d17'
                },
                {
                  key: 'C',
                  textHtml: '4/9',
                  images: [],
                  text: '4/9',
                  isCorrect: false,
                  _id: '695f5ed01a14ee5991130d18'
                },
                {
                  key: 'D',
                  textHtml: '5/9',
                  images: [],
                  text: '5/9',
                  isCorrect: true,
                  _id: '695f5ed01a14ee5991130d19'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276d9',
              questionId: '94302',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'A piece of wire of length 4L is bent at random, to form a rectangle. The probability that its area is at most L24 is :',
              questionHtml: 'A piece of wire of length 4L is bent at random, to form a rectangle. The probability that its area is at most L²/4 is :',
              images: [],
              correctAnswer: 'C',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '1/4',
                  images: [],
                  text: '1/4',
                  isCorrect: false,
                  _id: '695f60f11a14ee5991130d6a'
                },
                {
                  key: 'B',
                  textHtml: '\\(√3/2\\)',
                  images: [],
                  text: '√3/2',
                  isCorrect: false,
                  _id: '695f60f11a14ee5991130d6b'
                },
                {
                  key: 'C',
                  textHtml: '\\(2−√3/2\\)',
                  images: [],
                  text: '2−√3/2',
                  isCorrect: true,
                  _id: '695f60f11a14ee5991130d6c'
                },
                {
                  key: 'D',
                  textHtml: '\\(4−√3\\)',
                  images: [],
                  text: '4−√3',
                  isCorrect: false,
                  _id: '695f60f11a14ee5991130d6d'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276de',
              questionId: '94303',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'A wire of length l is cut into three pieces. What is the probability that the three pieces form a triangle ?',
              questionHtml: 'A wire of length l is cut into three pieces. What is the probability that the three pieces form a triangle ?',
              images: [],
              correctAnswer: 'B',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '1/2',
                  images: [],
                  text: '1/2',
                  isCorrect: false,
                  _id: '695f61e01a14ee5991130da2'
                },
                {
                  key: 'B',
                  textHtml: '1/4',
                  images: [],
                  text: '1/4',
                  isCorrect: true,
                  _id: '695f61e01a14ee5991130da3'
                },
                {
                  key: 'C',
                  textHtml: '2/3',
                  images: [],
                  text: '2/3',
                  isCorrect: false,
                  _id: '695f61e01a14ee5991130da4'
                },
                {
                  key: 'D',
                  textHtml: 'None of these',
                  images: [],
                  text: 'None of these',
                  isCorrect: false,
                  _id: '695f61e01a14ee5991130da5'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276e3',
              questionId: '94304',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'If a∈[−20,0), then the probability that the graph of the function y=16x2+8(a+5)x−7a−5 is strictly above the x-axis is :',
              questionHtml: 'If \\(a∈[−20,0),\\) then the probability that the graph of the function \\(y=16x²+8(a+5)x−7a−5\\) is strictly above the x-axis is :',
              images: [],
              correctAnswer: 'C',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '1/2',
                  images: [],
                  text: '1/2',
                  isCorrect: false,
                  _id: '695f61861a14ee5991130d86'
                },
                {
                  key: 'B',
                  textHtml: '1/17',
                  images: [],
                  text: '1/17',
                  isCorrect: false,
                  _id: '695f61861a14ee5991130d87'
                },
                {
                  key: 'C',
                  textHtml: '13/20',
                  images: [],
                  text: '13/20',
                  isCorrect: true,
                  _id: '695f61861a14ee5991130d88'
                },
                {
                  key: 'D',
                  textHtml: 'None of these',
                  images: [],
                  text: 'None of these',
                  isCorrect: false,
                  _id: '695f61861a14ee5991130d89'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276e8',
              questionId: '94305',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'Three distinct numbers are chosen randomly from first 100natural numbers, then the probability that all are divisible by 2 and 3 both is –',
              questionHtml: 'Three distinct numbers are chosen randomly from first 100natural numbers, then the probability that all are divisible by 2 and 3 both is –',
              images: [],
              correctAnswer: 'D',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '4/33',
                  images: [],
                  text: '4/33',
                  isCorrect: false,
                  _id: '695f62221a14ee5991130dbe'
                },
                {
                  key: 'B',
                  textHtml: '4/35',
                  images: [],
                  text: '4/35',
                  isCorrect: false,
                  _id: '695f62221a14ee5991130dbf'
                },
                {
                  key: 'C',
                  textHtml: '4/25',
                  images: [],
                  text: '4/25',
                  isCorrect: false,
                  _id: '695f62221a14ee5991130dc0'
                },
                {
                  key: 'D',
                  textHtml: '4/1155',
                  images: [],
                  text: '4/1155',
                  isCorrect: true,
                  _id: '695f62221a14ee5991130dc1'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276ed',
              questionId: '94306',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'Given that P',
              questionHtml: 'Given that \\(P(B)=34,P(A∪B∪C̄)=13,P(Ā∩B̄∩C̄)=13\\) then find probability of \\(B∩C,\\) when \\(Ā,B̄,C̄\\) are negotiations of A, B, C respectively, is',
              images: [],
              correctAnswer: 'B',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '2/3',
                  images: [],
                  text: '2/3',
                  isCorrect: false,
                  _id: '695f636b1a14ee5991130dda'
                },
                {
                  key: 'B',
                  textHtml: '1/12',
                  images: [],
                  text: '1/12',
                  isCorrect: true,
                  _id: '695f636b1a14ee5991130ddb'
                },
                {
                  key: 'C',
                  textHtml: '1/15',
                  images: [],
                  text: '1/15',
                  isCorrect: false,
                  _id: '695f636b1a14ee5991130ddc'
                },
                {
                  key: 'D',
                  textHtml: '1/4',
                  images: [],
                  text: '1/4',
                  isCorrect: false,
                  _id: '695f636b1a14ee5991130ddd'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276f2',
              questionId: '94307',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'Two numbers are chosen one by one (with out replacement) from the set of numbers A={1,2,3,4,5,6}. The probability that minimum of two values of chosen number is less than 4 is –',
              questionHtml: 'Two numbers are chosen one by one (with out replacement) from the set of numbers \\(A={1,2,3,4,5,6}.\\) The probability that minimum of two values of chosen number is less than 4 is –',
              images: [],
              correctAnswer: 'D',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '1/15',
                  images: [],
                  text: '1/15',
                  isCorrect: false,
                  _id: '695f63c11a14ee5991130df6'
                },
                {
                  key: 'B',
                  textHtml: '14/15',
                  images: [],
                  text: '14/15',
                  isCorrect: false,
                  _id: '695f63c11a14ee5991130df7'
                },
                {
                  key: 'C',
                  textHtml: '1/5',
                  images: [],
                  text: '1/5',
                  isCorrect: false,
                  _id: '695f63c11a14ee5991130df8'
                },
                {
                  key: 'D',
                  textHtml: '4/5',
                  images: [],
                  text: '4/5',
                  isCorrect: true,
                  _id: '695f63c11a14ee5991130df9'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276f7',
              questionId: '94308',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'One Indian and four American men and their wives are to be seated randomly around a circular . Then the conditional probability that the Indian man is seated adjacent to his wife given that each American man is seated adjacent to his wife is –',
              questionHtml: 'One Indian and four American men and their wives are to be seated randomly around a circular . Then the conditional probability that the Indian man is seated adjacent to his wife given that each American man is seated adjacent to his wife is –',
              images: [],
              correctAnswer: 'D',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '1/2',
                  images: [],
                  text: '1/2',
                  isCorrect: false,
                  _id: '695f64001a14ee5991130e12'
                },
                {
                  key: 'B',
                  textHtml: '1/3',
                  images: [],
                  text: '1/3',
                  isCorrect: false,
                  _id: '695f64001a14ee5991130e13'
                },
                {
                  key: 'C',
                  textHtml: '1/4',
                  images: [],
                  text: '1/4',
                  isCorrect: false,
                  _id: '695f64001a14ee5991130e14'
                },
                {
                  key: 'D',
                  textHtml: '2/5',
                  images: [],
                  text: '2/5',
                  isCorrect: true,
                  _id: '695f64001a14ee5991130e15'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee59911276fc',
              questionId: '94309',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'short_answer',
              questionText: 'Let Ec denote the complement of an event E. Let E, F, G be pairwise independent events with P(G)&gt;0 and P(E∩F∩G)=0. Then P(Ec∩Fc∣G) equals –',
              questionHtml: 'Let \\(Ec\\) denote the complement of an event E. Let E, F, G be pairwise independent events with \\(P(G)>0\\) and \\(P(E∩F∩G)=0.\\) Then \\(P(Ec∩Fc∣G)\\) equals –',
              images: [],
              correctAnswer: 'C',
              solutionText: '(A)   P(Ec)+P(Fc)\n\n    (B)  P(Ec)−P(Fc)\n\n\n    (C)  P(Ec)−P(F)\n\n\n    (D)  P(E)−P(Fc)',
              options: [],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee5991127701',
              questionId: '94310',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'An experiment has 10 equally likely outcomes. Let A and B be two non-empty events of the experiment. If A consists of 4 outcomes, the number of outcomes that B must have so that A and B are independent, is',
              questionHtml: 'An experiment has 10 equally likely outcomes. Let A and B be two non-empty events of the experiment. If A consists of 4 outcomes, the number of outcomes that B must have so that A and B are independent, is',
              images: [],
              correctAnswer: 'D',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '2, 4 or 8',
                  images: [],
                  text: '2, 4 or 8',
                  isCorrect: false,
                  _id: '69536ec61a14ee5991127702'
                },
                {
                  key: 'B',
                  textHtml: '3, 6 or 9',
                  images: [],
                  text: '3, 6 or 9',
                  isCorrect: false,
                  _id: '69536ec61a14ee5991127703'
                },
                {
                  key: 'C',
                  textHtml: '4 or 8',
                  images: [],
                  text: '4 or 8',
                  isCorrect: false,
                  _id: '69536ec61a14ee5991127704'
                },
                {
                  key: 'D',
                  textHtml: '5 or 10',
                  images: [],
                  text: '5 or 10',
                  isCorrect: true,
                  _id: '69536ec61a14ee5991127705'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee5991127706',
              questionId: '94311',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'short_answer',
              questionText: 'There are n balls in a bag whose colours are not known. A white ball is put into this bag and thereafter a ball is drawn randomly from the bag. The probability of the drawn ball being non-white, is equal to :',
              questionHtml: 'There are n balls in a bag whose colours are not known. A white ball is put into this bag and thereafter a ball is drawn randomly from the bag. The probability of the drawn ball being non-white, is equal to :',
              images: [],
              correctAnswer: 'B',
              solutionText: '(A)   (n−1)(n+1)\n\n    (B)  n(n+1)\n\n    (C)  n+22(n+1)\n\n    (D)  n2(n+1)',
              options: [],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            },
            {
              _id: '69536ec61a14ee599112770b',
              questionId: '94312',
              classId: {
                _id: '693115d2f1825d21120be089',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classCode: '95a39a08-4233-4299-8019-664ba72f6fbd',
                className: '12th',
                description: '12th',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:02:10.797Z',
                updatedAt: '2025-12-04T05:02:10.797Z',
                __v: 0
              },
              subjectId: {
                _id: '6931161ef1825d21120be0aa',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                subjectCode: 'e7c7b495-c008-43c6-a649-7f3fdf416b8f',
                subjectName: 'Mathematics',
                description: '',
                status: 'active',
                createdBy: 'aeccae0f-6b7c-4c03-9b9c-0c6da661e6f9',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-04T05:03:26.290Z',
                updatedAt: '2025-12-04T05:03:26.290Z',
                __v: 0
              },
              topicId: {
                _id: '69536a811a14ee5991126ce6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicCode: 'e54e0cfe-c9f3-4026-a856-cfaaf44e6745',
                topicName: 'Probability',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:00:33.891Z',
                updatedAt: '2025-12-30T06:00:33.891Z',
                __v: 0
              },
              subtopicId: {
                _id: '69536e321a14ee59911274e6',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                classId: '693115d2f1825d21120be089',
                subjectId: '6931161ef1825d21120be0aa',
                topicId: '69536a811a14ee5991126ce6',
                subtopicCode: '4a0b8e65-4239-4b33-9259-28c9ccec7662',
                subtopicName: 'Miscellaneous Problems',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-30T06:16:18.417Z',
                updatedAt: '2025-12-30T06:16:18.417Z',
                __v: 0
              },
              examCategoryId: {
                _id: '693fa5b60789982afe2fcdc5',
                entiId: '11dace83-33e5-4eb2-b002-c09668c6b7e3',
                categoryCode: '67362e47-4022-4870-b141-c06b580578f7',
                categoryName: 'IITJEE\tJEEMB',
                description: '',
                status: 'active',
                createdBy: '25d8635f-d5df-488d-a479-fa8edad320a7',
                updatedBy: null,
                isdeleted: false,
                createdAt: '2025-12-15T06:07:50.422Z',
                updatedAt: '2025-12-15T06:07:50.422Z',
                __v: 0
              },
              testId: '1480',
              difficulty: 'easy',
              questionType: 'mcq_single',
              questionText: 'A coin is tossed n times. The probability of getting at least one head is greater than that of getting at least two tails by Then, n is :',
              questionHtml: 'A coin is tossed n times. The probability of getting at least one head is greater than that of getting at least two tails by 5/52Then, n is :',
              images: [],
              correctAnswer: 'A',
              solutionText: '',
              options: [
                {
                  key: 'A',
                  textHtml: '5',
                  images: [],
                  text: '5',
                  isCorrect: true,
                  _id: '695f65391a14ee5991130e6b'
                },
                {
                  key: 'B',
                  textHtml: '10',
                  images: [],
                  text: '10',
                  isCorrect: false,
                  _id: '695f65391a14ee5991130e6c'
                },
                {
                  key: 'C',
                  textHtml: '15',
                  images: [],
                  text: '15',
                  isCorrect: false,
                  _id: '695f65391a14ee5991130e6d'
                },
                {
                  key: 'D',
                  textHtml: 'None of these',
                  images: [],
                  text: 'None of these',
                  isCorrect: false,
                  _id: '695f65391a14ee5991130e6e'
                }
              ],
              status: 'active',
              createdBy: {
                _id: '69311539f1825d21120be059',
                userId: '25d8635f-d5df-488d-a479-fa8edad320a7',
                full_name: 'Shanmugapriya',
                email: 'priya@z7i.in'
              }
            }
          ]
        }
      ]
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
