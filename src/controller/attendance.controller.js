import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import Attendance from '../models/attandence.model.js';
import TimeTable from '../models/timetable.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();

const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// FIX #2: UTC-based Monday calc — no local timezone involved
const getPreviousMonday = (dateMs) => {
  const d = new Date(dateMs);
  const utcDay = d.getUTCDay(); // 0=Sun
  const diffDays = utcDay === 0 ? -6 : 1 - utcDay;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffDays);
};

// FIX #1, #3, #8, #9: Complete rewrite of getEffectivePeriods
// - Reads dayOverrides + periodOverrides (split model)
// - UTC day and UTC midnight for all date comparisons
// - Handles REPLACE_DAY
// - Correct MOVE_PERIOD swap using toPeriodNo
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
  for (const ov of periodOvs) {
    const fromNo = Number(ov.periodNo);
    if (!fromNo) continue;
    if (ov.action === 'CANCEL_PERIOD') {
      baseMap.delete(fromNo);
    }
    if (ov.action === 'REPLACE_PERIOD' && ov.period) {
      baseMap.set(fromNo, { ...ov.period, periodNo: fromNo });
    }
    if (ov.action === 'ADD_PERIOD' && ov.period) {
      baseMap.set(fromNo, { ...ov.period, periodNo: fromNo });
    }
  }
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

const markAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { batchCode, timetableId, date, periodNo, facultyId, subjectId, topicTaught, feedback, students } = req.body;
    if (!tenantId || !batchCode || !timetableId || !date || !periodNo || !facultyId || !subjectId) {
      return res.status(400).json({
        status: false,
        message: 'tenantId, batchCode, timetableId, date, periodNo, facultyId and subjectId are required'
      });
    }
    const parsedDate = toInt(date, 0);
    const parsedPeriod = toInt(periodNo, 0);
    const inputStudents = Array.isArray(students) ? students : [];
    const lateLogs = await LateEntryLog.find({
      tenantId,
      batchCode,
      date: parsedDate,
      periodNo: parsedPeriod,
      type: 'STUDENT',
      isdeleted: false
    }).lean();
    const lateStudentIds = new Set(lateLogs.map((log) => log.personId));
    const processedStudents = inputStudents.map((student) => {
      if (lateStudentIds.has(student.studentId)) {
        return { ...student, status: 'LATE' };
      }
      return student;
    });
    const doc = await Attendance.findOneAndUpdate(
      { tenantId, batchCode, date: parsedDate, periodNo: parsedPeriod, isdeleted: false },
      {
        $set: {
          timetableId,
          facultyId,
          subjectId,
          topicTaught: safeTrim(topicTaught),
          feedback: safeTrim(feedback),
          students: processedStudents,
          updatedBy: userId
        },
        $setOnInsert: { createdBy: userId }
      },
      { new: true, upsert: true }
    );
    return res.status(200).json({ status: true, message: 'Attendance saved successfully', data: doc });
  } catch (err) {
    return next(err);
  }
};

const getAbsenteesReport = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { batchCode, studentId, dateFrom, dateTo } = req.body;
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (dateFrom && dateTo && toInt(dateFrom) > toInt(dateTo)) {
      return res.status(400).json({ status: false, message: 'dateFrom must be before or equal to dateTo' });
    }
    const matchQuery = { tenantId, isdeleted: false };
    if (batchCode) matchQuery.batchCode = safeTrim(batchCode);
    if (dateFrom) matchQuery.date = { ...matchQuery.date, $gte: toInt(dateFrom, 0) };
    if (dateTo) matchQuery.date = { ...matchQuery.date, $lte: toInt(dateTo, 0) };
    const pipeline = [{ $match: matchQuery }, { $unwind: '$students' }, { $match: { 'students.status': 'ABSENT' } }];
    if (studentId) {
      pipeline.push({ $match: { 'students.studentId': safeTrim(studentId) } });
    }

    pipeline.push({
      $lookup: {
        from: 'studentprofiles',
        localField: 'students.studentId',
        foreignField: 'studentId',
        as: 'studentProfileDoc'
      }
    });

    pipeline.push({
      $unwind: { path: '$studentProfileDoc', preserveNullAndEmptyArrays: true }
    });

    pipeline.push({
      $project: {
        _id: 0,
        attendanceId: 1,
        date: 1,
        periodNo: 1,
        batchCode: 1,
        subjectId: 1,
        studentId: '$students.studentId',
        admissionNo: '$students.admissionNo',
        remarks: '$students.remarks',
        studentName: '$studentProfileDoc.student.name',
        registrationNumber: '$studentProfileDoc.registrationNumber',
        studentPhone: '$studentProfileDoc.student.phone',
        parentPhone: '$studentProfileDoc.student.parentPhone'
      }
    });

    const absentees = await Attendance.aggregate(pipeline);
    return res.status(200).json({ status: true, data: absentees, count: absentees.length });
  } catch (err) {
    return next(err);
  }
};

// const getPendingAttendance = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const date = toInt(req.body?.date, 0);
//     const batchCode = safeTrim(req.body?.batchCode);
//     if (!tenantId || !date) {
//       return res.status(400).json({ status: false, message: 'tenantId and date are required' });
//     }
//     const mondayMs = getPreviousMonday(date);
//     const ttQuery = { tenantId, isdeleted: false, wkStartOn: mondayMs };
//     if (batchCode) ttQuery.batchCode = batchCode;
//     const timetables = await TimeTable.find(ttQuery).lean();
//     const attQuery = { tenantId, date, isdeleted: false, status: 'Active' };
//     if (batchCode) attQuery.batchCode = batchCode;
//     const completedAtt = await Attendance.find(attQuery, { batchCode: 1, periodNo: 1, date: 1 }).lean();
//     const completedSet = new Set(completedAtt.map((a) => `${a.batchCode}_${a.periodNo}_${a.date}`));
//     const pending = [];
//     for (const tt of timetables) {
//       const activePeriods = getEffectivePeriods(tt, date);
//       for (const period of activePeriods) {
//         const key = `${tt.batchCode}_${period.periodNo}_${date}`;
//         if (!completedSet.has(key)) {
//           pending.push({
//             batchCode: tt.batchCode,
//             timetableId: tt._id,
//             periodNo: period.periodNo,
//             periodType: period.periodType,
//             mode: period.mode,
//             facultyId: period.facultyId,
//             facultyName: period.facultyName,
//             subjectId: period.subjectId,
//             subjectName: period.subjectName,
//             time: period.time || null
//           });
//         }
//       }
//     }
//     return res.status(200).json({ status: true, data: pending, count: pending.length });
//   } catch (err) {
//     return next(err);
//   }
// };

const getPendingAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const date = toInt(req.body?.date, 0);
    const batchCode = safeTrim(req.body?.batchCode);
    if (!tenantId || !date) {
      return res.status(400).json({ status: false, message: 'tenantId and date are required' });
    }
    const mondayMs = getPreviousMonday(date);
    const ttQuery = { tenantId, isdeleted: false };
    if (batchCode) ttQuery.batchCode = batchCode;
    const timetables = await TimeTable.find({
      ...ttQuery,
      status: 'Active',
      wkStartOn: { $lte: mondayMs }
    }).lean();
    const ttByBatch = new Map();
    for (const tt of timetables) {
      const existing = ttByBatch.get(tt.batchCode);
      if (!existing || toInt(tt.wkStartOn) > toInt(existing.wkStartOn)) {
        ttByBatch.set(tt.batchCode, tt);
      }
    }

    const attQuery = { tenantId, date, isdeleted: false };
    if (batchCode) attQuery.batchCode = batchCode;
    const completedAtt = await Attendance.find(attQuery, { batchCode: 1, periodNo: 1, date: 1 }).lean();
    const completedSet = new Set(completedAtt.map((a) => `${a.batchCode}_${a.periodNo}_${a.date}`));

    const pending = [];
    for (const tt of ttByBatch.values()) {
      const activePeriods = getEffectivePeriods(tt, date);
      for (const period of activePeriods) {
        const key = `${tt.batchCode}_${period.periodNo}_${date}`;
        if (!completedSet.has(key)) {
          pending.push({
            batchCode: tt.batchCode,
            timetableId: tt._id,
            periodNo: period.periodNo,
            periodType: period.periodType,
            mode: period.mode,
            facultyId: period.facultyId,
            facultyName: period.facultyName,
            subjectId: period.subjectId,
            subjectName: period.subjectName,
            subjectCode: period.subjectCode, // ADD: useful for display
            venue: period.venue, // ADD: useful for display
            time: period.time || null
          });
        }
      }
    }
    return res.status(200).json({ status: true, data: pending, count: pending.length });
  } catch (err) {
    return next(err);
  }
};

// const getStaffSchedule = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const facultyId = safeTrim(req.body?.facultyId);
//     const date = toInt(req.body?.date, 0);
//     if (!tenantId || !facultyId || !date) {
//       return res.status(400).json({ status: false, message: 'tenantId, facultyId and date are required' });
//     }
//     const mondayMs = getPreviousMonday(date);
//     const timetables = await TimeTable.find({ tenantId, isdeleted: false, wkStartOn: mondayMs }).lean();
//     const myClasses = [];
//     for (const tt of timetables) {
//       const activePeriods = getEffectivePeriods(tt, date);
//       const myPeriods = activePeriods.filter((p) => safeTrim(p.facultyId) === facultyId || safeTrim(p.replacementFacultyId) === facultyId);
//       myPeriods.forEach((p) => {
//         myClasses.push({
//           batchCode: tt.batchCode,
//           timetableId: tt._id,
//           ...p
//         });
//       });
//     }
//     return res.status(200).json({ status: true, data: myClasses });
//   } catch (err) {
//     return next(err);
//   }
// };

// const getStudentSchedule = async (req, res, next) => {
//   try {
//     const tenantId = pickTenantId(req);
//     const studentId = safeTrim(req.body?.studentId);
//     const date = toInt(req.body?.date, 0);
//     if (!tenantId || !studentId || !date) {
//       return res.status(400).json({ status: false, message: 'tenantId, studentId, and date are required' });
//     }
//     const student = await StudentProfile.findOne({
//       tenantId,
//       status: 'ACTIVE',
//       isdeleted: false,
//       $or: [{ studentId }, { admissionNo: studentId }, { registrationNumber: studentId }]
//     }).lean();
//     if (!student || !student.batchCode) {
//       return res.status(200).json({
//         status: true,
//         data: [],
//         message: 'Student not found or not assigned to a batch'
//       });
//     }
//     const mondayMs = getPreviousMonday(date);
//     const tt = await TimeTable.findOne({
//       tenantId,
//       batchCode: student.batchCode,
//       wkStartOn: mondayMs,
//       isdeleted: false
//     }).lean();
//     if (!tt) return res.status(200).json({ status: true, data: [] });
//     const activePeriods = getEffectivePeriods(tt, date);
//     return res.status(200).json({
//       status: true,
//       batchCode: student.batchCode,
//       data: activePeriods
//     });
//   } catch (err) {
//     return next(err);
//   }
// };

const getStaffSchedule = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const facultyId = safeTrim(req.body?.facultyId);
    const date = toInt(req.body?.date, 0);

    if (!tenantId || !facultyId || !date) {
      return res.status(400).json({ status: false, message: 'tenantId, facultyId and date are required' });
    }

    const mondayMs = getPreviousMonday(date);

    // FIX: find DRAFT for this exact week OR any published timetable active up to this week
    const allTimetables = await TimeTable.find({
      tenantId,
      isdeleted: false,
      status: 'Active',
      wkStartOn: { $lte: mondayMs }
    }).lean();

    // Deduplicate — one timetable per batchCode, prefer most recent wkStartOn
    const ttByBatch = new Map();
    for (const tt of allTimetables) {
      const existing = ttByBatch.get(tt.batchCode);
      if (!existing || toInt(tt.wkStartOn) > toInt(existing.wkStartOn)) {
        ttByBatch.set(tt.batchCode, tt);
      }
    }

    const myClasses = [];
    for (const tt of ttByBatch.values()) {
      const activePeriods = getEffectivePeriods(tt, date);
      // FIX: after our REPLACE_PERIOD change staff fix, new facultyId is set directly on period
      // replacementFacultyId check kept for backward compat with old data
      const myPeriods = activePeriods.filter((p) => safeTrim(p.facultyId) === facultyId || safeTrim(p.replacementFacultyId) === facultyId);
      myPeriods.forEach((p) => {
        myClasses.push({
          batchCode: tt.batchCode,
          timetableId: tt._id,
          ...p
        });
      });
    }

    myClasses.sort((a, b) => (a.time?.startMin || 0) - (b.time?.startMin || 0));

    return res.status(200).json({ status: true, data: myClasses, count: myClasses.length });
  } catch (err) {
    return next(err);
  }
};

const getStudentSchedule = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const studentId = safeTrim(req.body?.studentId);
    const date = toInt(req.body?.date, 0);

    if (!tenantId || !studentId || !date) {
      return res.status(400).json({ status: false, message: 'tenantId, studentId, and date are required' });
    }

    // Accept studentId, admissionNo, or registrationNumber
    const student = await StudentProfile.findOne({
      tenantId,
      status: 'ACTIVE',
      isdeleted: false,
      $or: [{ studentId }, { admissionNo: studentId }, { registrationNumber: studentId }]
    }).lean();

    if (!student || !student.batchCode) {
      return res.status(200).json({
        status: true,
        data: [],
        message: 'Student not found or not assigned to a batch'
      });
    }

    const mondayMs = getPreviousMonday(date);
    const tt = await TimeTable.findOne({
      tenantId,
      batchCode: student.batchCode,
      isdeleted: false,
      $or: [{ wkStartOn: mondayMs }, { status: 'Active', wkStartOn: { $lte: mondayMs } }]
    })
      .sort({ wkStartOn: -1 })
      .lean();

    if (!tt) {
      return res.status(200).json({ status: true, data: [], message: 'No timetable found for this week' });
    }
    const activePeriods = getEffectivePeriods(tt, date);
    return res.status(200).json({
      status: true,
      batchCode: student.batchCode,
      timetableId: tt._id,
      timetableStatus: tt.status,
      data: activePeriods
    });
  } catch (err) {
    return next(err);
  }
};

const getStudentsForAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const { batchCode, date, periodNo } = req.body;
    if (!tenantId || !batchCode || !date || !periodNo) {
      return res.status(400).json({
        status: false,
        message: 'tenantId, batchCode, date, and periodNo are required'
      });
    }
    const students = await StudentProfile.find({ tenantId, batchCode, status: 'ACTIVE', isdeleted: false }, { studentId: 1, admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).lean();
    if (!students.length) {
      return res.status(200).json({
        status: true,
        data: [],
        message: 'No active students found in this batch'
      });
    }
    const existingAttendance = await Attendance.findOne({
      tenantId,
      batchCode,
      date: toInt(date, 0),
      periodNo: toInt(periodNo, 0),
      isdeleted: false
    }).lean();
    const result = students.map((st) => {
      let currentStatus = 'NOT_MARKED';
      let remarks = null;
      if (existingAttendance) {
        const savedRecord = existingAttendance.students.find((s) => s.studentId === st.studentId);
        if (savedRecord) {
          currentStatus = savedRecord.status;
          remarks = savedRecord.remarks;
        } else {
          currentStatus = 'PRESENT';
        }
      }
      return {
        studentId: st.studentId,
        admissionNo: st.admissionNo,
        name: st.student?.name,
        status: currentStatus,
        remarks
      };
    });
    return res.status(200).json({
      status: true,
      data: result,
      isEditMode: !!existingAttendance,
      existingFeedback: existingAttendance?.feedback || '',
      existingTopicTaught: existingAttendance?.topicTaught || ''
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  markAttendance,
  getAbsenteesReport,
  getPendingAttendance,
  getStaffSchedule,
  getStudentSchedule,
  getStudentsForAttendance
};
