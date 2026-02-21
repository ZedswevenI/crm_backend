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

const markAttendance = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const userId = safeTrim(req.body?.userId);
    const { batchCode, timetableId, date, periodNo, facultyId, subjectId, topicTaught, feedback, students } = req.body;
    if (!tenantId || !batchCode || !timetableId || !date || !periodNo || !facultyId) {
      return res.status(400).json({ status: false, message: 'Missing required fields' });
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
      $unwind: {
        path: '$studentProfileDoc',
        preserveNullAndEmptyArrays: true
      }
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
    if (!tenantId || !date) return res.status(400).json({ status: false, message: 'tenantId and date are required' });
    const d = new Date(date);
    const dayStr = DAYS[d.getDay()];
    const ttQuery = { tenantId, isdeleted: false, 'week.day': dayStr };
    if (batchCode) ttQuery.batchCode = batchCode;
    const timetables = await TimeTable.find(ttQuery).lean();
    const attQuery = { tenantId, date, isdeleted: false };
    if (batchCode) attQuery.batchCode = batchCode;
    const completedAtt = await Attendance.find(attQuery, { batchCode: 1, periodNo: 1 }).lean();
    const completedSet = new Set(completedAtt.map((a) => `${a.batchCode}_${a.periodNo}`));
    const pending = [];
    for (const tt of timetables) {
      const daySchedule = tt.week.find((w) => w.day === dayStr);
      if (!daySchedule) continue;

      for (const period of daySchedule.periods) {
        if (period.isCancelled) continue;
        const key = `${tt.batchCode}_${period.periodNo}`;
        if (!completedSet.has(key)) {
          pending.push({
            batchCode: tt.batchCode,
            timetableId: tt._id,
            periodNo: period.periodNo,
            facultyId: period.facultyId,
            facultyName: period.facultyName,
            subjectId: period.subjectId
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
    if (!tenantId || !facultyId || !date) return res.status(400).json({ status: false, message: 'Missing fields' });
    const d = new Date(date);
    const dayStr = DAYS[d.getDay()];
    const timetables = await TimeTable.find({ tenantId, isdeleted: false, 'week.day': dayStr }).lean();
    let myClasses = [];
    for (const tt of timetables) {
      const daySchedule = tt.week.find((w) => w.day === dayStr);
      if (!daySchedule) continue;
      const periods = daySchedule.periods.filter((p) => p.facultyId === facultyId && !p.isCancelled);
      periods.forEach((p) => {
        myClasses.push({
          batchCode: tt.batchCode,
          timetableId: tt._id,
          ...p
        });
      });
    }
    return res.status(200).json({ status: true, data: myClasses });
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
      studentId,
      status: 'ACTIVE',
      isdeleted: false
    }).lean();
    if (!student || !student.batchCode) {
      return res.status(200).json({
        status: true,
        data: [],
        message: 'Student not found or not currently assigned to a batch'
      });
    }
    const d = new Date(date);
    const dayStr = DAYS[d.getDay()];
    const tt = await TimeTable.findOne({
      tenantId,
      batchCode: student.batchCode,
      isdeleted: false,
      'week.day': dayStr
    }).lean();
    if (!tt) return res.status(200).json({ status: true, data: [] });
    const daySchedule = tt.week.find((w) => w.day === dayStr);
    return res.status(200).json({
      status: true,
      batchCode: student.batchCode,
      data: daySchedule ? daySchedule.periods : []
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
      return res.status(400).json({ status: false, message: 'tenantId, batchCode, date, and periodNo are required' });
    }
    const students = await StudentProfile.find({ tenantId, batchCode, status: 'ACTIVE', isdeleted: false }, { studentId: 1, admissionNo: 1, 'student.name': 1 }).sort({ 'student.name': 1 }).lean();
    if (!students.length) {
      return res.status(200).json({ status: true, data: [], message: 'No active students found in this batch' });
    }
    const existingAttendance = await Attendance.findOne({
      tenantId,
      batchCode,
      date: toInt(date, 0),
      periodNo: toInt(periodNo, 0),
      isdeleted: false
    }).lean();
    const result = students.map((st) => {
      let currentStatus = 'PRESENT';
      let remarks = null;
      if (existingAttendance) {
        const savedRecord = existingAttendance.students.find((s) => s.studentId === st.studentId);
        if (savedRecord) {
          currentStatus = savedRecord.status;
          remarks = savedRecord.remarks;
        }
      }
      return {
        studentId: st.studentId,
        admissionNo: st.admissionNo,
        name: st.student?.name,
        status: currentStatus,
        remarks: remarks
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

export default { markAttendance, getAbsenteesReport, getPendingAttendance, getStaffSchedule, getStudentSchedule, getStudentsForAttendance };
