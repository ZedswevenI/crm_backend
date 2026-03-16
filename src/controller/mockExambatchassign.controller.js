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
    if (exam.status === 'draft') return res.status(400).json({ status: false, message: 'Cannot assign a draft exam. Publish the exam first' });

    const now = Date.now();
    const ops = [];

    for (const batchId of batchIds) {
      // fetch students for this batch
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
export const getStudentStatus = async (req, res, next) => {
  try {
    const tenantId = pickTid(req);
    const examId = safeTrim(req.body?.examId);
    const batchId = safeTrim(req.body?.batchId);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    if (!examId) return res.status(400).json({ status: false, message: 'examId is required' });
    if (!batchId) return res.status(400).json({ status: false, message: 'batchId is required' });

    const assign = await MockExamBatchAssign.findOne({ tenantId, examId, batchId, isdeleted: false }).lean();
    if (!assign) return res.status(404).json({ status: false, message: 'Assignment not found for this exam and batch' });

    const students = assign.students || [];
    const total = students.length;
    const completed = students.filter((s) => s.status === 'completed').length;
    const started = students.filter((s) => s.status === 'started').length;
    const assigned = students.filter((s) => s.status === 'assigned').length;
    const absent = students.filter((s) => s.status === 'absent').length;

    return res.status(200).json({
      status: true,
      message: 'Student status loaded',
      summary: { total, completed, started, assigned, absent },
      data: students
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
