import mongoose from 'mongoose';
import constants from '../helpers/constants.js';
import Staff from '../models/staff.model.js';
import User from '../models/users.model.js';
import Batch from '../models/batch.model.js';
import BatchAssignEnable from '../models/batchenabledAssignment.model.js';
import StudyMaterial from '../models/studymaterial.model.js';
import StudentPerformance from '../models/studentperformance.model.js';
import TimeTable from '../models/timetable.model.js';
import Attendance from '../models/attandence.model.js';
import Task from '../models/task.model.js';
import { triggerCommunicationEventSafe } from '../services/communicationEvent.service.js';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const getPreviousMonday = (dateMs) => {
  const d = new Date(dateMs);
  const utcDay = d.getUTCDay();
  const diff = utcDay === 0 ? -6 : 1 - utcDay;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff);
};

const getEffectivePeriods = (tt, dateMs) => {
  if (!tt || !Array.isArray(tt.week)) return [];
  const targetMs = Number(dateMs);
  if (isNaN(targetMs)) return [];
  const targetDate = new Date(targetMs);
  const utcDay = targetDate.getUTCDay();
  const dayStr = DAYS[utcDay];
  const targetUTC = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
  const matchesDate = (oDateMs) => {
    const od = new Date(Number(oDateMs));
    const ovUTC = Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), od.getUTCDate());
    return ovUTC === targetUTC;
  };
  const baseDay = (tt.week || []).find((w) => String(w.day).toUpperCase() === dayStr);
  let periods = baseDay && Array.isArray(baseDay.periods) ? JSON.parse(JSON.stringify(baseDay.periods)) : [];
  for (const ov of tt.dayOverrides || []) {
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
  const periodOvs = (tt.periodOverrides || []).filter((o) => matchesDate(o.date));
  for (const ov of periodOvs) {
    const fromNo = Number(ov.periodNo);
    if (!fromNo) continue;
    if (ov.action === 'CANCEL_PERIOD') baseMap.delete(fromNo);
    if (ov.action === 'REPLACE_PERIOD' && ov.period) baseMap.set(fromNo, { ...ov.period, periodNo: fromNo });
    if (ov.action === 'ADD_PERIOD' && ov.period) baseMap.set(fromNo, { ...ov.period, periodNo: fromNo });
  }
  const moves = periodOvs.filter((o) => o.action === 'MOVE_PERIOD');
  if (moves.length) {
    const snapshot = new Map(baseMap);
    const appliedMoves = new Set();
    for (const ov of moves) {
      const fromNo = Number(ov.periodNo),
        toNo = Number(ov.toPeriodNo);
      if (!fromNo || !toNo || fromNo === toNo) continue;
      const key = `${Math.min(fromNo, toNo)}-${Math.max(fromNo, toNo)}`;
      if (appliedMoves.has(key)) continue;
      appliedMoves.add(key);
      const fp = snapshot.get(fromNo),
        tp = snapshot.get(toNo);
      if (fp) baseMap.set(toNo, { ...fp, periodNo: toNo, time: tp?.time ?? fp.time });
      else baseMap.delete(toNo);
      if (tp) baseMap.set(fromNo, { ...tp, periodNo: fromNo, time: fp?.time ?? tp.time });
      else baseMap.delete(fromNo);
    }
  }
  return Array.from(baseMap.values()).sort((a, b) => (a.periodNo || 0) - (b.periodNo || 0));
};

const pickTenantId = (req) => String(req?.body?.tenantId || req?.body?.entiId || '').trim();
const safeTrim = (v) => (v === undefined || v === null ? '' : String(v).trim());
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

// API 1: List Teaching Staff
const listTeachingStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId is required' });

    const search = safeTrim(req.query.search || req.body.search);
    const centerId = safeTrim(req.query.centerId || req.body.centerId);

    const page = Math.max(toInt(req.query.page || req.body.page, 1), 1);
    const limit = Math.min(Math.max(toInt(req.query.limit || req.body.limit, 20), 1), 200);
    const skip = (page - 1) * limit;

    // Filter strictly by TEACHING faculty type
    const query = { tenantId, isdeleted: false, facultyType: 'TEACHING' };

    if (centerId) query.centerId = centerId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ staffName: rx }, { staffCode: rx }, { phone: rx }, { email: rx }];
    }

    const [rows, count] = await Promise.all([Staff.find(query).populate('subject', 'subjectName').populate('department', 'departmentName').sort({ staffName: 1 }).skip(skip).limit(limit).lean(), Staff.countDocuments(query)]);

    return res.status(200).json({
      status: true,
      message: 'Teaching staff list loaded',
      data: rows,
      count,
      page,
      limit
    });
  } catch (err) {
    return next(err);
  }
};

// API 2: View Teaching Staff Comprehensive Details
const viewTeachingStaff = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    const staffId = safeTrim(req.body?.staffId || req.query?.staffId || req.body?.facultyId);

    if (!tenantId || !staffId) {
      return res.status(400).json({ status: false, message: 'tenantId and staffId are required' });
    }
    const staff = await Staff.findOne({ tenantId, staffId, isdeleted: false }).populate('subject', 'subjectName subjectCode').populate('department', 'departmentName').lean();
    if (!staff) {
      return res.status(404).json({ status: false, message: 'Staff profile not found' });
    }
    const user = await User.findOne({ tenantId, staffId, isdeleted: false }, { userId: 1 }).lean();
    const resolvedUserId = user ? user.userId : null;
    const authorIds = [staffId];
    if (resolvedUserId) authorIds.push(resolvedUserId);
    const assignedBatches = await Batch.find(
      {
        tenantId,
        isdeleted: false,
        status: 'ACTIVE',
        'staffMap.staffId': staffId
      },
      { batchId: 1, batchName: 1, batchCode: 1, programName: 1, centerName: 1, staffMap: 1 }
    ).lean();
    const formattedBatches = assignedBatches.map((b) => ({
      batchId: b.batchId,
      batchName: b.batchName,
      batchCode: b.batchCode,
      programName: b.programName,
      centerName: b.centerName,
      subjectsAssigned: b.staffMap.filter((s) => s.staffId === staffId).map((s) => s.subjectName)
    }));
    const enabledAssignments = await BatchAssignEnable.find(
      {
        tenantId,
        isdeleted: false,
        enabledBy: { $in: authorIds }
      },
      { testId: 1, testNo: 1, batchId: 1, subjectId: 1, status: 1, enabledAt: 1 }
    ).lean();
    const uploadedMaterials = await StudyMaterial.find(
      {
        tenantId,
        isdeleted: false,
        createdBy: { $in: authorIds }
      },
      { materialId: 1, title: 1, classNo: 1, status: 1, createdAt: 1 }
    ).lean();
    const studentFeedbacks = await StudentPerformance.aggregate([
      { $match: { tenantId, isdeleted: false, 'staffFeedback.staffId': staffId } },
      { $unwind: '$staffFeedback' },
      { $match: { 'staffFeedback.staffId': staffId } },
      {
        $project: {
          _id: 0,
          studentId: 1,
          admissionNo: 1,
          academicYear: 1,
          feedbackId: '$staffFeedback.feedbackId',
          remarks: '$staffFeedback.remarks',
          addedAt: '$staffFeedback.addedAt'
        }
      },
      { $sort: { addedAt: -1 } }
    ]);
    return res.status(200).json({
      status: true,
      message: 'Staff details retrieved successfully',
      data: {
        basicInfo: staff,
        assignedBatches: formattedBatches,
        stats: {
          activeBatchesCount: formattedBatches.length,
          assignmentsEnabledCount: enabledAssignments.length,
          materialsUploadedCount: uploadedMaterials.length,
          feedbacksGivenCount: studentFeedbacks.length
        },
        enabledAssignments,
        uploadedMaterials,
        studentFeedbacks
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getTeacherBatches = async (req, res, next) => {
  try {
    const tenantId = pickTenantId(req);
    if (!tenantId) return res.status(400).json({ status: false, message: 'tenantId (entiId) is required' });
    const staffId = safeTrim(req.body?.staffId || req.body?.facultyId);
    if (!staffId) return res.status(400).json({ status: false, message: 'staffId is required' });
    // ── Fetch staff ───────────────────────────────────────────────────────────
    const staffDoc = await Staff.findOne({ tenantId, staffId, isdeleted: false }, { staffId: 1, staffName: 1, staffCode: 1, subject: 1, facultyType: 1 }).lean();
    if (!staffDoc) return res.status(404).json({ status: false, message: 'Staff not found' });
    // ── Find ACTIVE batches where this staff is in staffMap ───────────────────
    const batches = await Batch.find(
      {
        tenantId,
        isdeleted: false,
        status: 'ACTIVE',
        staffMap: { $elemMatch: { staffId } }
      },
      {
        batchId: 1,
        batchCode: 1,
        batchName: 1,
        classNo: 1,
        yearNo: 1,
        academicYear: 1,
        programId: 1,
        programName: 1,
        centerId: 1,
        centerName: 1,
        studentCount: 1,
        startDate: 1,
        endDate: 1,
        status: 1,
        staffMap: 1
      }
    )
      .sort({ classNo: 1, batchName: 1 })
      .lean();

    // ── Early return ──────────────────────────────────────────────────────────
    if (!batches.length) {
      return res.json({
        status: true,
        message: 'No active batches assigned to this teacher',
        data: {
          staffId,
          staffName: staffDoc.staffName || null,
          staffCode: staffDoc.staffCode || null,
          batches: [],
          subjects: [],
          classes: []
        }
      });
    }

    // ── Build batches array ───────────────────────────────────────────────────
    // Each entry is one batch — includes the subjects this teacher
    // handles in that specific batch (from staffMap rows matching staffId)
    const batchList = batches.map((b) => {
      const myStaffMapRows = (Array.isArray(b.staffMap) ? b.staffMap : []).filter((row) => safeTrim(row?.staffId) === staffId);

      const batchSubjects = myStaffMapRows
        .map((row) => ({
          subjectId: safeTrim(row?.subjectId || ''),
          subjectName: safeTrim(row?.subjectName || '')
        }))
        .filter((s) => s.subjectId);

      return {
        batchId: b.batchId,
        batchCode: b.batchCode,
        batchName: b.batchName,
        classNo: b.classNo ?? null,
        yearNo: b.yearNo ?? null,
        academicYear: b.academicYear || null,
        programId: b.programId || null,
        programName: b.programName || null,
        centerId: b.centerId || null,
        centerName: b.centerName || null,
        studentCount: b.studentCount ?? 0,
        startDate: b.startDate ?? null,
        endDate: b.endDate ?? null,
        status: b.status || null,
        subjects: batchSubjects // subjects teacher handles in THIS batch
      };
    });

    // ── Build subjects array — unique across all batches ──────────────────────
    const subjectMap = new Map();
    for (const b of batches) {
      const myRows = (Array.isArray(b.staffMap) ? b.staffMap : []).filter((row) => safeTrim(row?.staffId) === staffId);
      for (const row of myRows) {
        const sid = safeTrim(row?.subjectId || '');
        if (sid && !subjectMap.has(sid)) {
          subjectMap.set(sid, {
            subjectId: sid,
            subjectName: safeTrim(row?.subjectName || '')
          });
        }
      }
    }
    const subjects = Array.from(subjectMap.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    // ── Build classes array — unique classNo across all batches ───────────────
    const classMap = new Map();
    for (const b of batches) {
      const cn = b.classNo ?? null;
      if (cn !== null && !classMap.has(cn)) {
        classMap.set(cn, {
          classNo: cn,
          academicYear: b.academicYear || null // AY for this class level
        });
      }
    }
    const classes = Array.from(classMap.values()).sort((a, b) => Number(a.classNo) - Number(b.classNo));

    return res.json({
      status: true,
      message: 'Teacher batches loaded',
      data: {
        staffId,
        staffName: staffDoc.staffName || null,
        staffCode: staffDoc.staffCode || null,
        batches: batchList,
        subjects,
        classes
      }
    });
  } catch (err) {
    return next(err);
  }
};

const getTeacherDashboard = async (req, res, next) => {
  try {
    const tenantId = safeTrim(req.body?.tenantId || req.body?.entiId);
    const facultyId = safeTrim(req.body?.staffId);
    const staffId = safeTrim(req.body?.staffId || facultyId); // tasks use staffId
    const nowMs = Date.now();

    if (!tenantId || !facultyId) {
      return res.status(400).json({
        status: false,
        message: 'tenantId and facultyId are required'
      });
    }

    // Today's UTC midnight
    const now = new Date(nowMs);
    const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const mondayMs = getPreviousMonday(todayMs);

    // Current time in minutes from midnight (local device time used for "next class")
    const currentMin = now.getUTCHours() * 60 + now.getUTCMinutes();

    // ── 1. Fetch today's timetables for this teacher ───────────────────────────
    const allTimetables = await TimeTable.find({
      tenantId,
      isdeleted: false,
      status: 'Active',
      wkStartOn: mondayMs
    }).lean();

    // Deduplicate by batchCode — pick latest wkStartOn
    const ttByBatch = new Map();
    for (const tt of allTimetables) {
      const ex = ttByBatch.get(tt.batchCode);
      if (!ex || toInt(tt.wkStartOn) > toInt(ex.wkStartOn)) {
        ttByBatch.set(tt.batchCode, tt);
      }
    }

    // Collect all periods assigned to this teacher today
    const myPeriods = [];
    for (const tt of ttByBatch.values()) {
      const periods = getEffectivePeriods(tt, todayMs);
      for (const p of periods) {
        if (safeTrim(p.facultyId) === facultyId || safeTrim(p.replacementFacultyId) === facultyId) {
          myPeriods.push({
            batchCode: tt.batchCode,
            timetableId: String(tt._id),
            periodNo: p.periodNo,
            periodType: p.periodType || null,
            mode: p.mode || null,
            subjectId: p.subjectId || null,
            subjectName: p.subjectName || null,
            subjectCode: p.subjectCode || null,
            venue: p.venue || null,
            time: p.time || null
          });
        }
      }
    }

    // Sort by startMin
    myPeriods.sort((a, b) => (a.time?.startMin || 0) - (b.time?.startMin || 0));

    // ── 2. Fetch attendance records for these periods today ───────────────────
    let nextClass = null;
    let attendanceNotTaken = 0;

    if (myPeriods.length) {
      const batchCodes = [...new Set(myPeriods.map((p) => p.batchCode))];
      const periodNos = [...new Set(myPeriods.map((p) => p.periodNo))];

      const attRecords = await Attendance.find(
        {
          tenantId,
          batchCode: { $in: batchCodes },
          periodNo: { $in: periodNos },
          date: todayMs,
          isdeleted: false
        },
        { batchCode: 1, periodNo: 1 }
      ).lean();

      const markedSet = new Set(attRecords.map((a) => `${a.batchCode}_${a.periodNo}`));

      // Count attendance not taken
      attendanceNotTaken = myPeriods.filter((p) => !markedSet.has(`${p.batchCode}_${p.periodNo}`)).length;

      // Next class — first period whose startMin > currentMin
      // If none upcoming, show the last period of today (most recent)
      const upcoming = myPeriods.filter((p) => (p.time?.startMin || 0) > currentMin);

      if (upcoming.length) {
        nextClass = upcoming[0];
      } else if (myPeriods.length) {
        // All classes done — show last one as context
        nextClass = myPeriods[myPeriods.length - 1];
        nextClass = { ...nextClass, _allDone: true };
      }
    }

    // ── 3. Pending tasks for this staff ───────────────────────────────────────
    const pendingTaskCount = await Task.countDocuments({
      tenantId,
      staffId,
      isdeleted: false,
      status: { $in: ['PENDING', 'IN_PROGRESS'] }
    });

    // ── 4. Build response ─────────────────────────────────────────────────────
    return res.status(200).json({
      status: true,
      data: {
        // Next class
        nextClass: nextClass
          ? {
              batchCode: nextClass.batchCode,
              timetableId: nextClass.timetableId,
              periodNo: nextClass.periodNo,
              subjectName: nextClass.subjectName || null,
              subjectCode: nextClass.subjectCode || null,
              startTime: nextClass.time?.startLabel || null,
              endTime: nextClass.time?.endLabel || null,
              startMin: nextClass.time?.startMin || null,
              mode: nextClass.mode || null,
              venue: nextClass.venue || null,
              allDone: nextClass._allDone === true
            }
          : null,

        // Attendance
        attendanceNotTaken,
        totalPeriodsToday: myPeriods.length,

        // Tasks
        pendingTasks: pendingTaskCount
      }
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  listTeachingStaff,
  viewTeachingStaff,
  getTeacherBatches,
  getTeacherDashboard
};
