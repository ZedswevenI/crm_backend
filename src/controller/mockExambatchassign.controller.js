import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import MockExamBatchAssign from '../models/mockExambatchmapping.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import MockExam from '../models/mockExam.model.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safeTrim = (v) => (v == null ? '' : String(v)).trim();
const toNum = (v) => {
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
};
const pickTid = (req) => safeTrim(req.body?.entiId || req.body?.tenantId);
const pickUid = (req) => safeTrim(req.body?.userId || req.user?.userId);

// ─── ASSIGN TO BATCH(ES) ──────────────────────────────────────────────────────
export const assignToBatch = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);
    const batchIds = Array.isArray(req.body?.batchIds) ? req.body.batchIds.map(safeTrim).filter(Boolean) : [];
    const centerId = safeTrim(req.body?.centerId) || null;
    const classNo = req.body?.classNo ? toNum(req.body.classNo) : null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!batchIds.length) return res.status(400).json({ status: false, message: 'batchIds[] must be a non-empty array' });
    const exam = await MockExam.findOne({ tenantId, examId, isdeleted: false }, { examId: 1, status: 1 }).lean();
    if (!exam) return res.status(404).json({ status: false, message: 'Exam not found' });
    const now = Date.now();
    const ops = [];
    for (const batchId of batchIds) {
      const studsRaw = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', batchId }, { _id: 0, admissionNo: 1, studentId: 1 }).lean();
      const students = (studsRaw || [])
        .map((s) => ({
          admissionNo: safeTrim(s.admissionNo),
          studentId: safeTrim(s.studentId) || null,
          status: 'assigned',
          assignedAt: now,
          startedAt: null,
          completedAt: null,
          obtainedMarks: null,
          rank: null,
          percentile: null,
          isLate: false
        }))
        .filter((x) => !!x.admissionNo);
      ops.push({
        updateOne: {
          filter: { tenantId, examId, batchId },
          update: {
            $set: {
              tenantId,
              examId,
              batchId,
              centerId,
              classNo,
              status: 'enabled',
              enabledAt: now,
              enabledBy: userId || null,
              disabledAt: null,
              disabledBy: null,
              isdeleted: false,
              updatedBy: userId || null
            },
            $setOnInsert: { students, createdBy: userId || null }
          },
          upsert: true
        }
      });
    }
    await MockExamBatchAssign.bulkWrite(ops, { ordered: false });
    return res.status(200).json({ status: true, message: `Exam assigned to ${batchIds.length} batch(es) successfully`, batchIds });
  } catch (err) {
    if (String(err?.code) === '11000') return res.status(200).json({ status: true, message: 'Exam already assigned to batch(es)' });
    return next(err);
  }
};

// ─── DISABLE FROM BATCH(ES) ───────────────────────────────────────────────────
export const disableFromBatch = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);
    const batchIds = Array.isArray(req.body?.batchIds) ? req.body.batchIds.map(safeTrim).filter(Boolean) : [];

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!batchIds.length) return res.status(400).json({ status: false, message: 'batchIds[] must be a non-empty array' });

    const now = Date.now();
    await MockExamBatchAssign.updateMany({ tenantId, examId, batchId: { $in: batchIds }, isdeleted: false }, { $set: { status: 'disabled', disabledAt: now, disabledBy: userId || null, updatedBy: userId || null } });

    return res.status(200).json({ status: true, message: 'Exam disabled for batch(es) successfully', batchIds });
  } catch (err) {
    return next(err);
  }
};

// ─── LIST BATCHES BY EXAM ─────────────────────────────────────────────────────
export const listBatchesByExam = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });

    const query = { tenantId, examId, isdeleted: false };
    if (req.body?.status) query.status = safeTrim(req.body.status);

    const rows = await MockExamBatchAssign.find(query, {
      batchId: 1,
      centerId: 1,
      classNo: 1,
      status: 1,
      enabledAt: 1,
      enabledBy: 1,
      disabledAt: 1,
      disabledBy: 1,
      'students.admissionNo': 1,
      'students.status': 1
    })
      .sort({ enabledAt: -1 })
      .lean();

    const data = rows.map((r) => {
      const total = (r.students || []).length;
      const completed = (r.students || []).filter((s) => s.status === 'completed').length;
      const started = (r.students || []).filter((s) => s.status === 'started').length;
      const assigned = (r.students || []).filter((s) => s.status === 'assigned').length;
      return { batchId: r.batchId, centerId: r.centerId, classNo: r.classNo, status: r.status, enabledAt: r.enabledAt, enabledBy: r.enabledBy, disabledAt: r.disabledAt, studentCount: total, completedCount: completed, startedCount: started, assignedCount: assigned };
    });

    return res.status(200).json({ status: true, message: 'Batch assignments loaded', data, count: data.length });
  } catch (err) {
    return next(err);
  }
};

// ─── LIST EXAMS BY BATCH ──────────────────────────────────────────────────────
export const listExamsByBatch = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const batchId = safeTrim(req.body?.batchId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });

    const query = { tenantId, batchId, isdeleted: false };
    if (req.body?.status) query.status = safeTrim(req.body.status);

    const assigns = await MockExamBatchAssign.find(query, { examId: 1, status: 1, enabledAt: 1 }).sort({ enabledAt: -1 }).lean();
    if (!assigns.length) return res.status(200).json({ status: true, message: 'No exams assigned to this batch', data: [], count: 0 });

    const examIds = assigns.map((a) => a.examId);
    const exams = await MockExam.find({ tenantId, examId: { $in: examIds }, isdeleted: false }, { password: 0 }).lean();
    const examMap = new Map(exams.map((e) => [e.examId, e]));

    const now = Date.now();
    const data = assigns.map((a) => {
      const exam = examMap.get(a.examId) || {};
      return {
        ...exam,
        assignStatus: a.status,
        enabledAt: a.enabledAt,
        isLive: !!(exam.startTime && exam.endTime && now >= exam.startTime && now <= exam.endTime)
      };
    });

    return res.status(200).json({ status: true, message: 'Exams for batch loaded', data, count: data.length });
  } catch (err) {
    return next(err);
  }
};

// ─── GET STUDENT STATUS ───────────────────────────────────────────────────────
// const getStudentStatus = async (req, res, next) => {
//   try {
//     const tenantId = pickTid(req);
//     const examId = safeTrim(req.body?.examId);
//     const batchId = safeTrim(req.body?.batchId);

//     if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
//     if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
//     if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });

//     const assign = await MockExamBatchAssign.findOne({ tenantId, examId, batchId, isdeleted: false }).lean();
//     if (!assign) return res.status(404).json({ status: false, message: 'Assignment not found for this exam and batch' });

//     const students = assign.students || [];
//     const total = students.length;
//     const completed = students.filter((s) => s.status === 'completed').length;
//     const started = students.filter((s) => s.status === 'started').length;
//     const assigned = students.filter((s) => s.status === 'assigned').length;
//     const absent = students.filter((s) => s.status === 'absent').length;

//     return res.status(200).json({
//       status: true,
//       message: 'Student status loaded',
//       summary: { total, completed, started, assigned, absent },
//       data: students
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

// ─── GET STUDENT STATUS ───────────────────────────────────────────────────────
const getStudentStatus = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = safeTrim(req.body?.batchId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });
    const assign = await MockExamBatchAssign.findOne({ tenantId, examId, batchId, isdeleted: false }).lean();
    if (!assign) return res.status(404).json({ status: false, message: 'Assignment not found for this exam and batch' });
    const assignedStudents = assign.students || [];
    if (!assignedStudents.length) {
      return res.status(200).json({
        status: true,
        message: 'No students assigned',
        summary: { total: 0, completed: 0, started: 0, notStarted: 0, absent: 0 },
        completed: [],
        started: [],
        notStarted: []
      });
    }
    const admissionNos = assignedStudents.map((s) => safeTrim(s.admissionNo)).filter(Boolean);
    const profiles = await StudentProfile.find({ tenantId, admissionNo: { $in: admissionNos }, isdeleted: false }, { admissionNo: 1, studentId: 1, 'student.name': 1, 'student.phone': 1 }).lean();
    const profileMap = new Map(profiles.map((p) => [safeTrim(p.admissionNo), p]));
    const results = await MockExamResult.find(
      { tenantId, examId, admissionNo: { $in: admissionNos }, isdeleted: false },
      {
        admissionNo: 1,
        status: 1,
        obtainedMarks: 1,
        totalMarks: 1,
        rank: 1,
        percentile: 1,
        timeTaken: 1,
        isLate: 1,
        startedAt: 1,
        completedAt: 1,
        sectionResults: 1,
        correctCount: 1,
        wrongCount: 1,
        skippedCount: 1
      }
    ).lean();
    const resultMap = new Map(results.map((r) => [safeTrim(r.admissionNo), r]));
    const completed = [];
    const started = [];
    const notStarted = [];
    let absentCount = 0;
    for (const s of assignedStudents) {
      const admNo = safeTrim(s.admissionNo);
      const profile = profileMap.get(admNo) || null;
      const result = resultMap.get(admNo) || null;
      const row = {
        admissionNo: admNo,
        studentId: s.studentId || null,
        studentName: profile?.student?.name || null,
        studentPhone: profile?.student?.phone || null,
        assignedAt: s.assignedAt || null,
        status: result?.status || s.status,
        startedAt: result?.startedAt || s.startedAt || null,
        completedAt: result?.completedAt || s.completedAt || null,
        obtainedMarks: result?.obtainedMarks ?? s.obtainedMarks ?? null,
        totalMarks: result?.totalMarks ?? null,
        rank: result?.rank ?? s.rank ?? null,
        percentile: result?.percentile ?? s.percentile ?? null,
        timeTaken: result?.timeTaken ?? null,
        isLate: result?.isLate ?? s.isLate ?? false,
        correctCount: result?.correctCount ?? null,
        wrongCount: result?.wrongCount ?? null,
        skippedCount: result?.skippedCount ?? null,
        sectionResults: result?.sectionResults || []
      };
      if (s.status === 'absent') {
        absentCount++;
        notStarted.push(row);
      } else if (result?.status === 'completed' || s.status === 'completed') {
        completed.push(row);
      } else if (result?.startedAt || s.status === 'started') {
        started.push(row);
      } else {
        notStarted.push(row);
      }
    }
    completed.sort((a, b) => (a.rank ?? 99999) - (b.rank ?? 99999));
    return res.status(200).json({
      status: true,
      message: 'Student status loaded',
      summary: {
        total: assignedStudents.length,
        completed: completed.length,
        started: started.length,
        notStarted: notStarted.length,
        absent: absentCount
      },
      completed,
      started,
      notStarted
    });
  } catch (err) {
    return next(err);
  }
};

// ─── SYNC STUDENTS ────────────────────────────────────────────────────────────
export const syncStudents = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const userId = pickUid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = safeTrim(req.body?.batchId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });

    const assign = await MockExamBatchAssign.findOne({ tenantId, examId, batchId, isdeleted: false });
    if (!assign) return res.status(404).json({ status: false, message: 'Assignment not found' });

    const existingNos = new Set((assign.students || []).map((s) => safeTrim(s.admissionNo)));

    const studsRaw = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', batchId }, { _id: 0, admissionNo: 1, studentId: 1 }).lean();

    const now = Date.now();
    const newStuds = (studsRaw || [])
      .filter((s) => safeTrim(s.admissionNo) && !existingNos.has(safeTrim(s.admissionNo)))
      .map((s) => ({
        admissionNo: safeTrim(s.admissionNo),
        studentId: safeTrim(s.studentId) || null,
        status: 'assigned',
        assignedAt: now,
        startedAt: null,
        completedAt: null,
        obtainedMarks: null,
        rank: null,
        percentile: null,
        isLate: false
      }));

    if (!newStuds.length) return res.status(200).json({ status: true, message: 'No new students to sync', addedCount: 0 });

    await MockExamBatchAssign.updateOne({ tenantId, examId, batchId, isdeleted: false }, { $push: { students: { $each: newStuds } }, $set: { updatedBy: userId || null } });

    return res.status(200).json({ status: true, message: 'Students synced successfully', addedCount: newStuds.length });
  } catch (err) {
    return next(err);
  }
};

export default { assignToBatch, disableFromBatch, listBatchesByExam, listExamsByBatch, getStudentStatus, syncStudents };
