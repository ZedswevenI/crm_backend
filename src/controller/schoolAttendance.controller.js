import mongoose from 'mongoose';
import SchoolAttendance from '../models/schoolAttendance.model.js';
import Batch from '../models/batch.model.js';
import StudentProfile from '../models/studentProfile.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

// ── API 1: List batches for school attendance ─────────────────────────────────
// L1/L3 → all active batches
// Class teacher (L4 with staffId) → only batches where classTeacherId === staffId
const listBatchesForSchoolAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const roleLevel = safeTrim(req.body?.roleLevel || req.body?.role);
    const staffId = safeTrim(req.body?.staffId);

    const query = { tenantId, isdeleted: false, status: 'ACTIVE' };

    // Class teacher — only their batches
    if (roleLevel === 'L4' || roleLevel === 'L5') {
      if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required for teacher role' });
      query.classTeacherId = staffId;
    }
    // L1/L3 — all batches, no extra filter

    const batches = await Batch.find(query, {
      batchId: 1,
      batchCode: 1,
      batchName: 1,
      section: 1,
      classNo: 1,
      yearNo: 1,
      academicYear: 1,
      centerName: 1,
      programName: 1,
      classTeacherId: 1,
      classTeacherName: 1,
      studentCount: 1,
      status: 1
    })
      .sort({ batchName: 1 })
      .lean();

    return res.status(200).json({ status: true, data: batches, count: batches.length });
  } catch (err) {
    return next(err);
  }
};

// ── API 2: Get students for a batch+date (pre-fill if already marked) ─────────
const getSchoolAttendanceStudents = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const date = toInt(req.body?.date);

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!batchCode) return res.status(400).json({ status: false, message: 'batchCode is required' });
    if (!date) return res.status(400).json({ status: false, message: 'date is required' });

    // Fetch batch
    const batch = await Batch.findOne({ tenantId, batchCode, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1, section: 1, classNo: 1, studentCount: 1 }).lean();
    if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });

    // Fetch active students in batch
    const students = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', batchId: batch.batchId }, { studentId: 1, admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).lean();

    // Check if attendance already marked for this date
    const existing = await SchoolAttendance.findOne({ tenantId, batchCode, date, isdeleted: false }).lean();

    const existingMap = new Map((existing?.students || []).map((s) => [s.studentId, s]));

    const studentList = students.map((s) => {
      const ex = existingMap.get(safeTrim(s.studentId));
      return {
        studentId: safeTrim(s.studentId),
        admissionNo: safeTrim(s.admissionNo),
        name: safeTrim(s.student?.name || ''),
        status: ex ? ex.status : 'NOT_MARKED',
        remarks: ex ? ex.remarks || null : null
      };
    });

    return res.status(200).json({
      status: true,
      isEditMode: !!existing,
      attendanceId: existing?.attendanceId || null,
      existingRemarks: existing?.remarks || '',
      data: studentList
    });
  } catch (err) {
    return next(err);
  }
};

// ── API 3: Mark / update school attendance ────────────────────────────────────
const markSchoolAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const date = toInt(req.body?.date);
    const markedBy = safeTrim(req.body?.markedBy || req.body?.userId);
    const markedByName = safeTrim(req.body?.markedByName || '');
    const markedByRole = safeTrim(req.body?.markedByRole || '');
    const remarks = safeTrim(req.body?.remarks || '');
    const studentsRaw = Array.isArray(req.body?.students) ? req.body.students : [];

    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!batchCode) return res.status(400).json({ status: false, message: 'batchCode is required' });
    if (!date) return res.status(400).json({ status: false, message: 'date is required' });
    if (!studentsRaw.length) return res.status(400).json({ status: false, message: 'students array is required' });

    // Validate all students are marked
    const unmarked = studentsRaw.filter((s) => !['PRESENT', 'ABSENT', 'LATE'].includes(safeTrim(s.status)));
    if (unmarked.length) {
      return res.status(400).json({
        status: false,
        message: `${unmarked.length} student(s) not marked. All students must have a status.`
      });
    }

    const batch = await Batch.findOne({ tenantId, batchCode, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1, section: 1, classNo: 1, academicYear: 1 }).lean();
    if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });

    const students = studentsRaw
      .map((s) => ({
        studentId: safeTrim(s.studentId),
        admissionNo: safeTrim(s.admissionNo),
        status: safeTrim(s.status),
        remarks: safeTrim(s.remarks || '') || null
      }))
      .filter((s) => s.studentId && s.admissionNo);

    const now = Date.now();

    const doc = await SchoolAttendance.findOneAndUpdate(
      { tenantId, batchCode, date, isdeleted: false },
      {
        $set: {
          batchId: batch.batchId,
          batchName: batch.batchName || null,
          section: batch.section || null,
          academicYear: batch.academicYear || null,
          classNo: batch.classNo || null,
          markedBy: markedBy || null,
          markedByName: markedByName || null,
          markedByRole: markedByRole || null,
          remarks: remarks || null,
          students,
          updatedBy: markedBy || null
        },
        $setOnInsert: {
          tenantId,
          batchCode,
          date,
          isdeleted: false,
          createdBy: markedBy || null
        }
      },
      { upsert: true, new: true }
    ).lean();

    const presentCount = students.filter((s) => s.status === 'PRESENT').length;
    const absentCount = students.filter((s) => s.status === 'ABSENT').length;
    const lateCount = students.filter((s) => s.status === 'LATE').length;

    return res.status(200).json({
      status: true,
      message: 'School attendance marked successfully',
      data: {
        attendanceId: doc.attendanceId,
        batchCode,
        date,
        totalStudents: students.length,
        presentCount,
        absentCount,
        lateCount
      }
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ status: false, message: 'Attendance already marked for this batch and date' });
    }
    return next(err);
  }
};

const getSchoolAttendanceSummary = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const fromDate = toInt(req.body?.fromDate);
    const toDate = toInt(req.body?.toDate);

    if (!tenantId || !batchCode || !fromDate || !toDate) {
      return res.status(400).json({ status: false, message: 'tenantId, batchCode, fromDate, toDate are required' });
    }

    const records = await SchoolAttendance.find({ tenantId, batchCode, date: { $gte: fromDate, $lte: toDate }, isdeleted: false })
      .sort({ date: 1 })
      .lean();

    return res.status(200).json({ status: true, data: records, count: records.length });
  } catch (err) {
    return next(err);
  }
};

const getMonthlyAttendanceReport = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const month = toInt(req.body?.month);
    const year = toInt(req.body?.year);

    if (!tenantId || !batchCode || !month || !year) {
      return res.status(400).json({
        status: false,
        message: 'tenantId, batchCode, month, year are required'
      });
    }
    const fromDate = Date.UTC(year, month - 1, 1);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const toDate = Date.UTC(year, month - 1, lastDay);
    const batch = await Batch.findOne({ tenantId, batchCode, isdeleted: false }, { batchId: 1, batchName: 1, section: 1, classNo: 1 }).lean();
    if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    const studentProfiles = await StudentProfile.find({ tenantId, isdeleted: false, batchId: batch.batchId }, { studentId: 1, admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).lean();
    const records = await SchoolAttendance.find({ tenantId, batchCode, date: { $gte: fromDate, $lte: toDate }, isdeleted: false })
      .sort({ date: 1 })
      .lean();
    const dateAttMap = new Map();
    for (const rec of records) {
      const stuMap = new Map();
      for (const s of rec.students || []) {
        stuMap.set(safeTrim(s.studentId), s.status);
      }
      dateAttMap.set(rec.date, stuMap);
    }
    const days = Array.from({ length: lastDay }, (_, i) => i + 1);
    const rows = studentProfiles.map((stu) => {
      const studentId = safeTrim(stu.studentId);
      let presentCount = 0;
      let workingDays = 0;
      let lateCount = 0;
      const attendance = days.map((day) => {
        const dateMs = Date.UTC(year, month - 1, day);
        const stuMap = dateAttMap.get(dateMs);
        if (!stuMap) return '';
        workingDays++;
        const status = stuMap.get(studentId) || '';
        if (status === 'PRESENT') {
          presentCount++;
          return 'P';
        }
        if (status === 'LATE') {
          presentCount++;
          lateCount++;
          return 'L';
        }
        if (status === 'ABSENT') return 'A';
        return '';
      });

      const pct = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 0;

      return {
        studentId,
        admissionNo: safeTrim(stu.admissionNo),
        name: safeTrim(stu.student?.name || stu.admissionNo),
        attendance,
        presentCount,
        workingDays,
        lateCount,
        absentCount: workingDays - presentCount,
        percentage: pct
      };
    });

    return res.status(200).json({
      status: true,
      data: {
        batchCode,
        month,
        year,
        lastDay,
        days,
        workingDays: records.length,
        rows
      }
    });
  } catch (err) {
    return next(err);
  }
};

// API 5: Quick check which batches have attendance marked for a date range
const checkMarkedBatches = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const fromDate = toInt(req.body?.fromDate);
    const toDate = toInt(req.body?.toDate || req.body?.fromDate);
    const batchCodes = Array.isArray(req.body?.batchCodes) ? req.body.batchCodes.map(safeTrim).filter(Boolean) : [];

    if (!tenantId || !fromDate || !batchCodes.length) {
      return res.status(400).json({
        status: false,
        message: 'tenantId, fromDate, batchCodes are required'
      });
    }

    const records = await SchoolAttendance.find(
      {
        tenantId,
        batchCode: { $in: batchCodes },
        date: { $gte: fromDate, $lte: toDate },
        isdeleted: false
      },
      { batchCode: 1 }
    ).lean();

    const markedBatchCodes = [...new Set(records.map((r) => r.batchCode))];

    return res.status(200).json({ status: true, markedBatchCodes });
  } catch (err) {
    return next(err);
  }
};

export default {
  listBatchesForSchoolAttendance,
  getSchoolAttendanceStudents,
  markSchoolAttendance,
  getSchoolAttendanceSummary,
  getMonthlyAttendanceReport,
  checkMarkedBatches
};
