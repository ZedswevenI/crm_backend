import SchoolAttendance from '../models/schoolAttendance.model.js';
import Batch from '../models/batch.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const HOLIDAY_TYPES = ['HOLIDAY', 'WEEK_OFF', 'LEAVE'];

const listBatchesForSchoolAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    const roleLevel = safeTrim(req.body?.roleLevel || req.body?.role);
    const staffId = safeTrim(req.body?.staffId);
    const query = { tenantId, isdeleted: false, status: 'ACTIVE' };
    if (roleLevel === 'L4' || roleLevel === 'L5') {
      if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required for teacher role' });
      query.classTeacherId = staffId;
    }
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

const getSchoolAttendanceStudents = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const date = toInt(req.body?.date);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!batchCode) return res.status(400).json({ status: false, message: 'batchCode is required' });
    if (!date) return res.status(400).json({ status: false, message: 'date is required' });
    const batch = await Batch.findOne({ tenantId, batchCode, isdeleted: false }, { batchId: 1, batchCode: 1, batchName: 1, section: 1, classNo: 1, studentCount: 1 }).lean();
    if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    const existing = await SchoolAttendance.findOne({ tenantId, batchCode, date, isdeleted: false }).lean();
    if (existing && HOLIDAY_TYPES.includes(existing.type)) {
      return res.status(200).json({
        status: true,
        isHoliday: true,
        holidayType: existing.type,
        holidayName: existing.holidayName || existing.type,
        data: []
      });
    }
    const students = await StudentProfile.find({ tenantId, isdeleted: false, status: 'ACTIVE', batchId: batch.batchId }, { studentId: 1, admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).lean();
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
      isHoliday: false,
      isEditMode: !!existing,
      attendanceId: existing?.attendanceId || null,
      existingRemarks: existing?.remarks || '',
      data: studentList
    });
  } catch (err) {
    return next(err);
  }
};

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
    const existing = await SchoolAttendance.findOne({ tenantId, batchCode, date, isdeleted: false }).lean();
    if (existing && HOLIDAY_TYPES.includes(existing.type)) {
      return res.status(400).json({
        status: false,
        message: `Cannot mark attendance — this day is declared as ${existing.holidayName || existing.type}`
      });
    }
    const unmarked = studentsRaw.filter((s) => !['PRESENT', 'ABSENT', 'LATE'].includes(safeTrim(s.status)));
    if (unmarked.length) {
      return res.status(400).json({ status: false, message: `${unmarked.length} student(s) not marked` });
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
    const doc = await SchoolAttendance.findOneAndUpdate(
      { tenantId, batchCode, date, isdeleted: false },
      {
        $set: {
          type: 'ATTENDANCE',
          holidayName: null,
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
    const absentStudents = students.filter((s) => s.status === 'ABSENT');
    if (absentStudents.length > 0) {
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      for (const s of absentStudents) {
        triggerCommunicationEventSafe({
          tenantId,
          eventCode: 'DAILY_ABSENCE_ALERT',
          admissionNo: s.admissionNo,
          sourceModule: 'ATTENDANCE',
          sourceRefId: doc.attendanceId,
          userId: markedBy || null,
          extraData: {
            admissionNo: s.admissionNo,
            attendanceDate: formattedDate,
            batchCode: batch.batchCode,
            batchName: batch.batchName || '',
            centerName: safeTrim(batch.centerName || ''),
            academicYear: safeTrim(batch.academicYear || '')
          }
        });
      }
    }
    return res.status(200).json({
      status: true,
      message: 'School attendance marked successfully',
      data: {
        attendanceId: doc.attendanceId,
        batchCode,
        date,
        totalStudents: students.length,
        presentCount: students.filter((s) => s.status === 'PRESENT').length,
        absentCount: students.filter((s) => s.status === 'ABSENT').length,
        lateCount: students.filter((s) => s.status === 'LATE').length
      }
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'Attendance already exists for this batch and date' });
    return next(err);
  }
};

const declareHoliday = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const batchCode = safeTrim(req.body?.batchCode);
    const date = toInt(req.body?.date);
    const holidayName = safeTrim(req.body?.holidayName || req.body?.name);
    const type = safeTrim(req.body?.type) || 'HOLIDAY';
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!batchCode) return res.status(400).json({ status: false, message: 'batchCode is required' });
    if (!date) return res.status(400).json({ status: false, message: 'date is required' });
    if (!holidayName) return res.status(400).json({ status: false, message: 'holidayName is required' });
    if (!HOLIDAY_TYPES.includes(type)) {
      return res.status(400).json({ status: false, message: `type must be one of: ${HOLIDAY_TYPES.join(', ')}` });
    }
    const existing = await SchoolAttendance.findOne({ tenantId, batchCode, date, isdeleted: false }).lean();
    if (existing && existing.type === 'ATTENDANCE' && existing.students?.length) {
      return res.status(400).json({
        status: false,
        message: 'Attendance is already marked for this date. Remove it before declaring a holiday.'
      });
    }
    const batch = await Batch.findOne({ tenantId, batchCode, isdeleted: false }, { batchId: 1, batchName: 1, section: 1, classNo: 1, academicYear: 1 }).lean();
    if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    const doc = await SchoolAttendance.findOneAndUpdate(
      { tenantId, batchCode, date, isdeleted: false },
      {
        $set: {
          type: type,
          holidayName: holidayName,
          batchId: batch.batchId,
          batchName: batch.batchName || null,
          section: batch.section || null,
          academicYear: batch.academicYear || null,
          classNo: batch.classNo || null,
          students: [],
          markedBy: null,
          markedByName: null,
          markedByRole: null,
          remarks: null,
          updatedBy: userId || null
        },
        $setOnInsert: {
          tenantId,
          batchCode,
          date,
          isdeleted: false,
          createdBy: userId || null
        }
      },
      { upsert: true, new: true }
    ).lean();
    return res.status(201).json({ status: true, message: `${type} declared for ${batchCode}`, data: doc });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ status: false, message: 'A record already exists for this date and batch' });
    return next(err);
  }
};

const declareHolidayForAllBatches = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const date = toInt(req.body?.date);
    const holidayName = safeTrim(req.body?.holidayName || req.body?.name);
    const type = safeTrim(req.body?.type) || 'HOLIDAY';
    const academicYear = safeTrim(req.body?.academicYear) || null;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!date) return res.status(400).json({ status: false, message: 'date is required' });
    if (!holidayName) return res.status(400).json({ status: false, message: 'holidayName is required' });
    if (!HOLIDAY_TYPES.includes(type)) {
      return res.status(400).json({ status: false, message: `type must be one of: ${HOLIDAY_TYPES.join(', ')}` });
    }
    const batchQuery = { tenantId, isdeleted: false, status: 'ACTIVE' };
    if (academicYear) batchQuery.academicYear = academicYear;
    const batches = await Batch.find(batchQuery, {
      batchId: 1,
      batchCode: 1,
      batchName: 1,
      section: 1,
      classNo: 1,
      academicYear: 1
    }).lean();
    if (!batches.length) {
      return res.status(404).json({ status: false, message: 'No active batches found' });
    }
    const ops = batches.map((batch) => ({
      updateOne: {
        filter: { tenantId, batchCode: batch.batchCode, date, isdeleted: false },
        update: {
          $set: {
            type: type,
            holidayName,
            batchId: batch.batchId,
            batchName: batch.batchName || null,
            section: batch.section || null,
            academicYear: batch.academicYear || null,
            classNo: batch.classNo || null,
            students: [],
            markedBy: null,
            markedByName: null,
            markedByRole: null,
            remarks: null,
            updatedBy: userId || null
          },
          $setOnInsert: {
            tenantId,
            batchCode: batch.batchCode,
            date,
            isdeleted: false,
            createdBy: userId || null
          }
        },
        upsert: true
      }
    }));
    const result = await SchoolAttendance.bulkWrite(ops, { ordered: false });
    return res.status(200).json({
      status: true,
      message: `${type} declared for ${batches.length} batches`,
      data: {
        totalBatches: batches.length,
        declared: result.upsertedCount,
        updated: result.modifiedCount
      }
    });
  } catch (err) {
    return next(err);
  }
};

const removeHoliday = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const date = toInt(req.body?.date);
    const userId = safeTrim(req.body?.userId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!batchCode) return res.status(400).json({ status: false, message: 'batchCode is required' });
    if (!date) return res.status(400).json({ status: false, message: 'date is required' });
    const doc = await SchoolAttendance.findOne({ tenantId, batchCode, date, isdeleted: false }).lean();
    if (!doc) return res.status(404).json({ status: false, message: 'No record found for this date' });
    if (!HOLIDAY_TYPES.includes(doc.type)) {
      return res.status(400).json({ status: false, message: 'This date is not a holiday — it has attendance marked' });
    }
    await SchoolAttendance.findOneAndUpdate({ tenantId, batchCode, date, isdeleted: false }, { $set: { isdeleted: true, updatedBy: userId || null } });
    return res.status(200).json({ status: true, message: 'Holiday removed — day is now unmarked' });
  } catch (err) {
    return next(err);
  }
};

const listHolidays = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const batchCode = safeTrim(req.body?.batchCode);
    const month = toInt(req.body?.month);
    const year = toInt(req.body?.year);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!batchCode) return res.status(400).json({ status: false, message: 'batchCode is required' });
    const query = { tenantId, batchCode, isdeleted: false, type: { $in: HOLIDAY_TYPES } };
    if (month && year) {
      query.date = {
        $gte: Date.UTC(year, month - 1, 1),
        $lte: Date.UTC(year, month - 1, new Date(Date.UTC(year, month, 0)).getUTCDate())
      };
    } else if (req.body?.fromDate || req.body?.toDate) {
      query.date = {};
      if (req.body?.fromDate) query.date.$gte = toInt(req.body.fromDate);
      if (req.body?.toDate) query.date.$lte = toInt(req.body.toDate);
    }
    const holidays = await SchoolAttendance.find(query, { date: 1, type: 1, holidayName: 1, batchCode: 1, attendanceId: 1 }).sort({ date: 1 }).lean();
    return res.status(200).json({ status: true, data: holidays, count: holidays.length });
  } catch (err) {
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

const checkMarkedBatches = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const fromDate = toInt(req.body?.fromDate);
    const toDate = toInt(req.body?.toDate || req.body?.fromDate);
    const batchCodes = Array.isArray(req.body?.batchCodes) ? req.body.batchCodes.map(safeTrim).filter(Boolean) : [];
    if (!tenantId || !fromDate || !batchCodes.length) {
      return res.status(400).json({ status: false, message: 'tenantId, fromDate, batchCodes are required' });
    }
    const records = await SchoolAttendance.find({ tenantId, batchCode: { $in: batchCodes }, date: { $gte: fromDate, $lte: toDate }, isdeleted: false }, { batchCode: 1, type: 1 }).lean();
    const markedBatchCodes = [...new Set(records.filter((r) => r.type === 'ATTENDANCE').map((r) => r.batchCode))];
    const holidayBatchCodes = [...new Set(records.filter((r) => HOLIDAY_TYPES.includes(r.type)).map((r) => r.batchCode))];
    return res.status(200).json({ status: true, markedBatchCodes, holidayBatchCodes });
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
      return res.status(400).json({ status: false, message: 'tenantId, batchCode, month, year are required' });
    }
    const fromDate = Date.UTC(year, month - 1, 1);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const toDate = Date.UTC(year, month - 1, lastDay);
    const batch = await Batch.findOne({ tenantId, batchCode, isdeleted: false }, { batchId: 1, batchName: 1, section: 1, classNo: 1 }).lean();
    if (!batch) return res.status(404).json({ status: false, message: 'Batch not found' });
    const [studentProfiles, allRecords] = await Promise.all([
      StudentProfile.find({ tenantId, isdeleted: false, batchId: batch.batchId }, { studentId: 1, admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).lean(),
      SchoolAttendance.find({ tenantId, batchCode, date: { $gte: fromDate, $lte: toDate }, isdeleted: false })
        .sort({ date: 1 })
        .lean()
    ]);
    const attendanceRecords = allRecords.filter((r) => r.type === 'ATTENDANCE');
    const holidayRecords = allRecords.filter((r) => HOLIDAY_TYPES.includes(r.type));
    const dateAttMap = new Map();
    const holidayDateMap = new Map();
    attendanceRecords.forEach((rec) => {
      const stuMap = new Map();
      (rec.students || []).forEach((s) => stuMap.set(safeTrim(s.studentId), s.status));
      dateAttMap.set(rec.date, stuMap);
    });
    holidayRecords.forEach((rec) => holidayDateMap.set(rec.date, { name: rec.holidayName || rec.type, type: rec.type }));
    const days = Array.from({ length: lastDay }, (_, i) => i + 1);
    const workingDays = attendanceRecords.length;
    const rows = studentProfiles.map((stu) => {
      const studentId = safeTrim(stu.studentId);
      let presentCount = 0,
        absentCount = 0,
        lateCount = 0;
      const attendance = days.map((day) => {
        const dateMs = Date.UTC(year, month - 1, day);
        if (holidayDateMap.has(dateMs)) return 'H';
        const stuMap = dateAttMap.get(dateMs);
        if (!stuMap) return '';
        const status = stuMap.get(studentId) || 'ABSENT';
        if (status === 'PRESENT') {
          presentCount++;
          return 'P';
        }
        if (status === 'LATE') {
          presentCount++;
          lateCount++;
          return 'L';
        }
        absentCount++;
        return 'A';
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
        absentCount,
        percentage: pct
      };
    });
    const holidays = Array.from(holidayDateMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([date, h]) => ({ date, name: h.name, type: h.type }));
    return res.status(200).json({
      status: true,
      data: {
        batchCode,
        month,
        year,
        lastDay,
        days,
        workingDays,
        totalDaysInMonth: lastDay,
        holidayCount: holidays.length,
        holidays,
        rows
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  listBatchesForSchoolAttendance,
  getSchoolAttendanceStudents,
  markSchoolAttendance,
  declareHoliday,
  declareHolidayForAllBatches,
  removeHoliday,
  listHolidays,
  getSchoolAttendanceSummary,
  checkMarkedBatches,
  getMonthlyAttendanceReport
};
