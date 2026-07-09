import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import Attendance from '../models/attandence.model.js';
import TimeTable from '../models/timetable.model.js';
import StudentProfile from '../models/studentProfile.model.js';
import LateEntryLog from '../models/lateEntrylog.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();

const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const getPreviousMonday = (dateMs) => {
  const d = new Date(dateMs);
  const utcDay = d.getUTCDay();
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

const buildAttendanceSummary = (attDoc) => {
  if (!attDoc) return null;
  const students = Array.isArray(attDoc.students) ? attDoc.students : [];
  const presentCount = students.filter((s) => s.status === 'PRESENT').length;
  const absentCount = students.filter((s) => s.status === 'ABSENT').length;
  const lateCount = students.filter((s) => s.status === 'LATE').length;
  const totalCount = students.length;
  return {
    attendanceId: attDoc._id,
    isMarked: true,
    markedAt: attDoc.updatedAt || attDoc.createdAt || null,
    markedBy: attDoc.updatedBy || attDoc.createdBy || null,
    topicTaught: attDoc.topicTaught || null,
    feedback: attDoc.feedback || null,
    totalCount,
    presentCount,
    absentCount,
    lateCount
  };
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
    const processedStudents = inputStudents.map((student) => ({
      ...student,
      status: lateStudentIds.has(student.studentId) ? 'LATE' : student.status
    }));
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

const getPendingAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const date = toInt(req.body?.date, 0);
    const batchCode = safeTrim(req.body?.batchCode);
    if (!tenantId || !date) {
      return res.status(400).json({ status: false, message: 'tenantId and date are required' });
    }
    const mondayMs = getPreviousMonday(date);
    const ttQuery = { tenantId, isdeleted: false, status: 'Active', wkStartOn: { $lte: mondayMs } };
    if (batchCode) ttQuery.batchCode = batchCode;
    const timetables = await TimeTable.find(ttQuery).lean();
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
            subjectCode: period.subjectCode,
            venue: period.venue,
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

const getStaffSchedule = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const facultyId = safeTrim(req.body?.facultyId);
    const date = toInt(req.body?.date, 0);
    if (!tenantId || !facultyId || !date) {
      return res.status(400).json({ status: false, message: 'tenantId, facultyId and date are required' });
    }
    const mondayMs = getPreviousMonday(date);
    const allTimetables = await TimeTable.find({
      tenantId,
      isdeleted: false,
      status: 'Active',
      wkStartOn: mondayMs
    }).lean();
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
    if (!myClasses.length) {
      return res.status(200).json({ status: true, data: [], count: 0 });
    }
    const batchCodes = [...new Set(myClasses.map((c) => c.batchCode))];
    const periodNos = [...new Set(myClasses.map((c) => c.periodNo))];
    const attRecords = await Attendance.find({
      tenantId,
      batchCode: { $in: batchCodes },
      date,
      periodNo: { $in: periodNos },
      isdeleted: false
    }).lean();
    const attMap = new Map(attRecords.map((a) => [`${a.batchCode}_${a.periodNo}`, a]));
    const data = myClasses.map((cls) => {
      const attDoc = attMap.get(`${cls.batchCode}_${cls.periodNo}`) || null;
      const summary = buildAttendanceSummary(attDoc);
      return {
        ...cls,
        attendance: summary || {
          isMarked: false,
          attendanceId: null,
          markedAt: null,
          markedBy: null,
          topicTaught: null,
          feedback: null,
          totalCount: null,
          presentCount: null,
          absentCount: null,
          lateCount: null
        }
      };
    });
    return res.status(200).json({ status: true, data, count: data.length });
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

const listAttendanceByDate = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const date = toInt(req.body?.date, 0);
    const batchCode = safeTrim(req.body?.batchCode);
    const periodNo = req.body?.periodNo !== undefined ? toInt(req.body.periodNo, 0) : null;
    const facultyId = safeTrim(req.body?.facultyId);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!date) return res.status(400).json({ status: false, message: 'date is required' });
    const attQuery = { tenantId, date, isdeleted: false };
    if (batchCode) attQuery.batchCode = safeTrim(batchCode);
    if (periodNo) attQuery.periodNo = periodNo;
    if (facultyId) attQuery.facultyId = facultyId;
    const attRecords = await Attendance.find(attQuery).lean();
    if (!attRecords.length) {
      return res.status(200).json({ status: true, message: 'No attendance records found for this date', data: [], count: 0 });
    }
    const mondayMs = getPreviousMonday(date);
    const batchCodes = [...new Set(attRecords.map((a) => a.batchCode))];
    const timetables = await TimeTable.find({
      tenantId,
      isdeleted: false,
      batchCode: { $in: batchCodes },
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
    const periodDetailMap = new Map();
    for (const tt of ttByBatch.values()) {
      const activePeriods = getEffectivePeriods(tt, date);
      for (const p of activePeriods) {
        periodDetailMap.set(`${tt.batchCode}_${p.periodNo}`, p);
      }
    }
    const data = attRecords.map((att) => {
      const periodDetail = periodDetailMap.get(`${att.batchCode}_${att.periodNo}`) || null;
      const students = Array.isArray(att.students) ? att.students : [];
      const totalCount = students.length;
      const presentCount = students.filter((s) => s.status === 'PRESENT').length;
      const absentCount = students.filter((s) => s.status === 'ABSENT').length;
      const lateCount = students.filter((s) => s.status === 'LATE').length;
      return {
        _id: att._id,
        batchCode: att.batchCode,
        date: att.date,
        periodNo: att.periodNo,
        facultyId: att.facultyId,
        subjectId: att.subjectId,
        topicTaught: att.topicTaught || null,
        feedback: att.feedback || null,
        markedAt: att.updatedAt || att.createdAt || null,
        markedBy: att.updatedBy || att.createdBy || null,
        totalCount,
        presentCount,
        absentCount,
        lateCount,
        periodDetails: periodDetail
          ? {
              periodType: periodDetail.periodType || null,
              mode: periodDetail.mode || null,
              time: periodDetail.time || null,
              subjectName: periodDetail.subjectName || null,
              subjectCode: periodDetail.subjectCode || null,
              facultyName: periodDetail.facultyName || null,
              venue: periodDetail.venue || null,
              topic: periodDetail.topic || null,
              zoomUrl: periodDetail.zoomUrl || null,
              phaseId: periodDetail.phaseId || null,
              phaseName: periodDetail.phaseName || null
            }
          : null,
        students
      };
    });
    data.sort((a, b) => (a.periodNo || 0) - (b.periodNo || 0));
    return res.status(200).json({
      status: true,
      message: 'Attendance records loaded',
      date,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const getScheduleWithAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const date = toInt(req.body?.date, 0);
    const batchCode = safeTrim(req.body?.batchCode);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });
    if (!date) return res.status(400).json({ status: false, message: 'date is required' });
    const mondayMs = getPreviousMonday(date);
    const ttQuery = {
      tenantId,
      isdeleted: false,
      status: 'Active',
      wkStartOn: mondayMs
    };
    if (batchCode) ttQuery.batchCode = batchCode;
    const allTimetables = await TimeTable.find(ttQuery).lean();
    const ttByBatch = new Map();
    for (const tt of allTimetables) {
      const existing = ttByBatch.get(tt.batchCode);
      if (!existing || toInt(tt.wkStartOn) > toInt(existing.wkStartOn)) {
        ttByBatch.set(tt.batchCode, tt);
      }
    }
    if (!ttByBatch.size) {
      return res.status(200).json({ status: true, message: 'No timetable scheduled for this date', data: [], count: 0 });
    }
    const allPeriods = [];
    for (const tt of ttByBatch.values()) {
      const periods = getEffectivePeriods(tt, date);
      for (const p of periods) {
        allPeriods.push({
          batchCode: tt.batchCode,
          timetableId: tt._id,
          ...p
        });
      }
    }
    if (!allPeriods.length) {
      return res.status(200).json({ status: true, message: 'No periods scheduled for this date', data: [], count: 0 });
    }
    const batchCodes = [...new Set(allPeriods.map((p) => p.batchCode))];
    const periodNos = [...new Set(allPeriods.map((p) => p.periodNo))];
    const attRecords = await Attendance.find({
      tenantId,
      batchCode: { $in: batchCodes },
      periodNo: { $in: periodNos },
      date,
      isdeleted: false
    }).lean();
    const attMap = new Map(attRecords.map((a) => [`${a.batchCode}_${a.periodNo}`, a]));
    const data = allPeriods.map((period) => {
      const attDoc = attMap.get(`${period.batchCode}_${period.periodNo}`) || null;
      const students = Array.isArray(attDoc?.students) ? attDoc.students : [];
      const attendance = attDoc
        ? {
            isMarked: true,
            attendanceId: attDoc._id,
            markedAt: attDoc.updatedAt || attDoc.createdAt || null,
            markedBy: attDoc.updatedBy || attDoc.createdBy || null,
            topicTaught: attDoc.topicTaught || null,
            feedback: attDoc.feedback || null,
            totalCount: students.length,
            presentCount: students.filter((s) => s.status === 'PRESENT').length,
            absentCount: students.filter((s) => s.status === 'ABSENT').length,
            lateCount: students.filter((s) => s.status === 'LATE').length
          }
        : {
            isMarked: false,
            attendanceId: null,
            markedAt: null,
            markedBy: null,
            topicTaught: null,
            feedback: null,
            totalCount: null,
            presentCount: null,
            absentCount: null,
            lateCount: null
          };
      return {
        batchCode: period.batchCode,
        timetableId: period.timetableId,
        periodNo: period.periodNo,
        periodType: period.periodType || null,
        mode: period.mode || null,
        time: period.time || null,
        facultyId: period.replacementFacultyId || period.facultyId || null,
        facultyName: period.facultyName || null,
        subjectId: period.subjectId || null,
        subjectName: period.subjectName || null,
        subjectCode: period.subjectCode || null,
        venue: period.venue || null,
        topic: period.topic || null,
        zoomUrl: period.zoomUrl || null,
        phaseId: period.phaseId || null,
        phaseName: period.phaseName || null,
        attendance
      };
    });
    data.sort((a, b) => a.batchCode.localeCompare(b.batchCode) || (a.periodNo || 0) - (b.periodNo || 0));
    return res.status(200).json({
      status: true,
      message: 'Schedule with attendance loaded',
      date,
      count: data.length,
      data
    });
  } catch (err) {
    return next(err);
  }
};

const updatePeriodAttendanceRemarks = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const attendanceId = safeTrim(req.body?.attendanceId);
    const studentId = safeTrim(req.body?.studentId);
    const remarks = safeTrim(req.body?.remarks);
    if (!tenantId || !attendanceId || !studentId) {
      return res.status(400).json({ status: false, message: 'tenantId, attendanceId and studentId are required' });
    }
    const record = await Attendance.findOne({ tenantId, attendanceId, isdeleted: false }).lean();
    if (!record) return res.status(404).json({ status: false, message: 'Attendance record not found' });
    const student = (record.students || []).find((s) => s.studentId === studentId);
    if (!student) return res.status(404).json({ status: false, message: 'Student not found in this attendance record' });
    if (student.status !== 'ABSENT') return res.status(400).json({ status: false, message: 'Remarks can only be added for absent students' });
    const updated = await Attendance.findOneAndUpdate({ tenantId, attendanceId, isdeleted: false, 'students.studentId': studentId }, { $set: { 'students.$.remarks': remarks || null } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Failed to update remarks' });
    return res.status(200).json({ status: true, message: 'Remarks updated successfully' });
  } catch (err) {
    return next(err);
  }
};

const updateSchoolAttendanceRemarks = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const attendanceId = safeTrim(req.body?.attendanceId);
    const studentId = safeTrim(req.body?.studentId);
    const remarks = safeTrim(req.body?.remarks);
    if (!tenantId || !attendanceId || !studentId) {
      return res.status(400).json({ status: false, message: 'tenantId, attendanceId and studentId are required' });
    }
    const SchoolAttendance = (await import('../models/schoolAttendance.model.js')).default;
    const record = await SchoolAttendance.findOne({ tenantId, attendanceId, isdeleted: false }).lean();
    if (!record) return res.status(404).json({ status: false, message: 'School attendance record not found' });
    const student = (record.students || []).find((s) => s.studentId === studentId);
    if (!student) return res.status(404).json({ status: false, message: 'Student not found in this attendance record' });
    if (student.status !== 'ABSENT') return res.status(400).json({ status: false, message: 'Remarks can only be added for absent students' });
    const updated = await SchoolAttendance.findOneAndUpdate({ tenantId, attendanceId, isdeleted: false, 'students.studentId': studentId }, { $set: { 'students.$.remarks': remarks || null } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ status: false, message: 'Failed to update remarks' });
    return res.status(200).json({ status: true, message: 'Remarks updated successfully' });
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
  getStudentsForAttendance,
  listAttendanceByDate,
  getScheduleWithAttendance,
  updatePeriodAttendanceRemarks,
  updateSchoolAttendanceRemarks
};
